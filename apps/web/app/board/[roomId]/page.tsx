"use client";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  getToolTypeFromString,
  pastelColors,
  Shape,
  tools,
  ToolType,
} from "../types";
import {
  allDrawings,
  drawSelectionBox,
  getShape,
  initDrawing,
  removeShapeById,
  renderCanvas,
  updateShapeById,
  updateShapeProperty,
  clearAllDrawings,
} from "../game";
import PropertyPanel from "@/components/Propertypanel";
import TextOnCanvas from "@/components/TextOnCanvas";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, Minus, Plus, Trash, Download } from "lucide-react";
import { CanvasDropdown } from "@/components/CanvasDropdown";
import { useParams, useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Badge } from "@/components/ui/badge";
import { Context } from "@/components/providers/ContextProvider";
import { getRoomBySlug } from "@/actions/action";
import { toast } from "sonner";

// ── Collaborator cursor display ────────────────────────────────────────────
interface RemoteCursor {
  userId: string;
  name: string;
  x: number;
  y: number;
}

const CURSOR_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#e91e63",
];

function cursorColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]!;
}

const Room = () => {
  const [selectedTool, setSelectedTool] = useState<ToolType>("select");
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [canvasBg, setCanvasBg] = useState("#f5f5f5");
  const [isEditingText, setIsEditingText] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
  const [connectTimeout, setConnectTimeout] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());

  const { roomId } = useParams();
  const router = useRouter();

  const [resolvedRoomId, setResolvedRoomId] = useState<number | null>(null);

  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [currentProperties, setCurrentProperties] = useState<Partial<Shape>>({
    strokeColor: "#000000",
    fillColor: "transparent",
    strokeWidth: 2,
    strokeStyle: "solid",
    fillStyle: "solid",
  });
  const [textPosition, setTextPosition] = useState<{
    screen: { x: number; y: number };
    canvas: { x: number; y: number };
  }>({ screen: { x: 0, y: 0 }, canvas: { x: 0, y: 0 } });
  const [editingTextId, setEditingTextId] = useState<number | null>(null);

  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(zoom);
  const panOffsetRef = useRef(panOffset);
  const selectedToolRef = useRef(selectedTool);
  const currentPropertiesRef = useRef(currentProperties);
  const selectedShapeIndexRef = useRef(selectedShapeId);

  // Throttle cursor broadcasts — at most every 50ms
  const lastCursorSendRef = useRef(0);

  const { user } = useContext(Context);

  const { send, isConnected } = useWebSocket(
    useCallback((eventData: Record<string, unknown>) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const zoomCtx = { getZoom: () => zoomRef.current, getPanOffset: () => panOffsetRef.current };

      switch (eventData.type) {

        case "shape:create": {
          // Server broadcasts shape:create with a tempId immediately.
          // Only add to allDrawings if we don't already have this id.
          const incoming = eventData.shape as Shape;
          const existing = allDrawings.findIndex(s => s.id === incoming.id);
          if (existing === -1) {
            allDrawings.push(incoming);
          }
          if (canvas && ctx) renderCanvas(canvas, ctx, zoomCtx);
          break;
        }

        case "shape:id_assigned": {
          // DB write completed — replace tempId with real DB id in allDrawings
          const { tempId, realId } = eventData as { tempId: number; realId: number };
          const idx = allDrawings.findIndex(s => s.id === tempId);
          if (idx >= 0) {
            allDrawings[idx]!.id = realId;
          }
          break;
        }

        case "shape:update": {
          const shape = eventData.shape as Shape;
          // FIX: removed the own-user filter — updateShapeProperty now applies
          // changes locally before sending, so the WS echo just confirms the DB id.
          // We still need to update for incoming peer updates.
          if (eventData.userId !== user?.id && canvas && ctx) {
            updateShapeById(shape, canvas, ctx, zoomCtx);
            setSelectedShapeId((eventData.shape as Shape).id);
            setSelectedTool("select");
            if ((eventData.shape as Shape).type === "TEXT") {
              setEditingTextId(null);
            }
          }
          break;
        }

        case "shape:delete": {
          const shapeId = Number(eventData.shapeId);
          // Only process echoes from other users — our own deletes are already applied locally
          if (eventData.userId !== user?.id) {
            removeShapeById(shapeId);
            if (canvas && ctx) renderCanvas(canvas, ctx, zoomCtx);
          }
          break;
        }

        case "canvas:clear": {
          // Always clear regardless of source — it's an admin action
          clearAllDrawings();
          if (canvas && ctx) renderCanvas(canvas, ctx, zoomCtx);
          if (eventData.userId !== user?.id) {
            toast.info("Canvas was cleared by the room owner");
          }
          break;
        }

        case "cursor:move": {
          const { userId, name, x, y } = eventData as {
            userId: string; name: string; x: number; y: number;
          };
          setRemoteCursors(prev => {
            const next = new Map(prev);
            next.set(userId, { userId, name, x, y });
            return next;
          });
          break;
        }

        case "user_joined": {
          toast.success(`${eventData.userId} joined the room`, { duration: 2000 });
          break;
        }

        case "user_left": {
          const leftUserId = String(eventData.userId);
          toast.info(`${eventData.username || leftUserId} left the room`, { duration: 2000 });
          // Remove their cursor
          setRemoteCursors(prev => {
            const next = new Map(prev);
            next.delete(leftUserId);
            return next;
          });
          break;
        }

        default:
          break;
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!user?.token) router.replace("/login");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token, router]);

  // Resolve roomId param → numeric ID
  useEffect(() => {
    if (!roomId) return;
    const param = Array.isArray(roomId) ? roomId[0] : roomId;
    if (!param) return;
    const asNumber = Number(param);
    if (!isNaN(asNumber) && asNumber > 0) {
      setResolvedRoomId(asNumber);
    } else {
      getRoomBySlug(param)
        .then((room) => {
          if (room?.id) setResolvedRoomId(room.id);
          else router.replace("/dashboard");
        })
        .catch(() => router.replace("/dashboard"));
    }
  }, [roomId, router]);

  // Connection timeout
  useEffect(() => {
    if (isConnected) { setConnectTimeout(false); return; }
    const t = setTimeout(() => setConnectTimeout(true), 15000);
    return () => clearTimeout(t);
  }, [isConnected]);

  // Keep refs in sync
  useEffect(() => {
    zoomRef.current = zoom;
    panOffsetRef.current = panOffset;
    selectedToolRef.current = selectedTool;
    currentPropertiesRef.current = currentProperties;
    selectedShapeIndexRef.current = selectedShapeId;
  }, [zoom, panOffset, selectedTool, currentProperties, selectedShapeId]);

  // Mouse-move → broadcast cursor position (throttled to 50ms)
  useEffect(() => {
    if (!resolvedRoomId || !isConnected) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorSendRef.current < 50) return;
      lastCursorSendRef.current = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - panOffsetRef.current.x) / zoomRef.current;
      const y = (e.clientY - rect.top - panOffsetRef.current.y) / zoomRef.current;

      send({ type: "cursor:move", roomId: resolvedRoomId, x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [resolvedRoomId, isConnected, send]);

  const handleCanvasBgChange = (color: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCanvasBg(color);
  };

  const handleToolSelect = (toolId: ToolType) => {
    setSelectedTool(toolId);
    if (toolId === "select") setShowPropertyPanel(true);
  };

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const newZoom = Math.min(zoom * 1.2, 10);
    const scale = newZoom / zoom;
    setZoom(newZoom);
    setPanOffset({ x: cx - (cx - panOffset.x) * scale, y: cy - (cy - panOffset.y) * scale });
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const newZoom = Math.max(zoom / 1.2, 0.1);
    const scale = newZoom / zoom;
    setZoom(newZoom);
    setPanOffset({ x: cx - (cx - panOffset.x) * scale, y: cy - (cy - panOffset.y) * scale });
  };

  const handleResetZoom = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };

  // ── Export Canvas as PNG ────────────────────────────────────────────────
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create an offscreen canvas at the same size with the background color applied
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    // Fill background
    offCtx.fillStyle = canvasBg;
    offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw the main canvas content on top
    offCtx.drawImage(canvas, 0, 0);

    // Trigger download
    const link = document.createElement("a");
    link.download = `collabdraw-${Date.now()}.png`;
    link.href = offscreen.toDataURL("image/png");
    link.click();
    toast.success("Canvas exported as PNG");
  };

  // ── Reset Canvas (clears DB via WS) ─────────────────────────────────────
  const handleResetCanvas = () => {
    if (!resolvedRoomId) return;
    // Clear locally
    clearAllDrawings();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      renderCanvas(canvas, ctx, {
        getZoom: () => zoomRef.current,
        getPanOffset: () => panOffsetRef.current,
      });
    }
    // Send canvas:clear to delete from DB and notify all users
    send({ type: "canvas:clear", roomId: resolvedRoomId });
    toast.success("Canvas cleared");
  };

  const handleAddText = (x: number, y: number, text: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const normalizedFontSize = 20 / zoom;
    ctx.save();
    ctx.font = `${normalizedFontSize}px Virgil, cursive`;
    const lines = text.split("\n");
    const lineHeight = normalizedFontSize * 1.4;
    let maxWidth = 0;
    lines.forEach((line) => {
      maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
    });
    const textWidth = Math.round(maxWidth + 130);
    const textHeight = Math.round(lines.length * lineHeight);
    ctx.restore();

    if (editingTextId !== null) {
      const shape = getShape(editingTextId);
      send({
        type: "shape:update",
        roomId: resolvedRoomId,
        shape: {
          ...shape,
          text,
          width: textWidth,
          height: textHeight,
          fontSize: Math.round(normalizedFontSize),
        },
      });
    } else {
      send({
        type: "shape:create",
        roomId: resolvedRoomId,
        shape: {
          startX: x,
          startY: y,
          width: textWidth,
          height: textHeight,
          type: getToolTypeFromString("text"),
          strokeColor: currentProperties.strokeColor || "#000000",
          text,
          fontSize: Math.round(normalizedFontSize),
        },
      });
    }
    setCurrentText("");
  };

  const handlePropertyChange = (property: string, value: unknown) => {
    setCurrentProperties((prev) => ({ ...prev, [property]: value }));
    if (selectedShapeId !== null && resolvedRoomId !== null) {
      updateShapeProperty(
        selectedShapeId,
        property as keyof Shape,
        value,
        send,
        resolvedRoomId
      );
      // Re-render so the change is visible immediately
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        renderCanvas(canvas, ctx, {
          getZoom: () => zoomRef.current,
          getPanOffset: () => panOffsetRef.current,
        }, selectedShapeId);
      }
    }
  };

  // Re-render when zoom/pan changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderCanvas(canvas, ctx, {
      getZoom: () => zoomRef.current,
      getPanOffset: () => panOffsetRef.current,
    }, selectedShapeIndexRef.current);
  }, [zoom, panOffset]);

  // Main canvas init effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !resolvedRoomId || !isConnected) return;

    const timer = setTimeout(() => {
      send({ type: "join-room", roomId: resolvedRoomId });
    }, 100);

    // Check for imported canvas from QuickActions
    const importedRaw = sessionStorage.getItem("importedCanvas");
    if (importedRaw) {
      try {
        const imported: Shape[] = JSON.parse(importedRaw);
        if (Array.isArray(imported)) {
          imported.forEach(shape => {
            send({ type: "shape:create", roomId: resolvedRoomId, shape });
          });
          toast.success(`Imported ${imported.length} shapes onto the canvas`);
        }
      } catch {
        toast.error("Failed to parse imported canvas");
      }
      sessionStorage.removeItem("importedCanvas");
    }

    let cleanup: (() => void) | undefined;
    let innerCleanup: (() => void) | undefined;
    let isSubscribed = true;

    const ctx = canvas.getContext("2d");

    async function initializeCanvas() {
      if (!resolvedRoomId || !canvas) return;

      const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          renderCanvas(canvas, ctx, {
            getZoom: () => zoomRef.current,
            getPanOffset: () => panOffsetRef.current,
          }, selectedShapeIndexRef.current);
        }
      };
      resizeCanvas();

      // FIX (Task 11): The dblclick for text-mode was registered TWICE —
      // once here and once inside initDrawing. The inner one (inside initDrawing)
      // now only handles select-mode text editing (double-clicking existing shapes).
      // This outer one handles text-mode new text creation on double-click.
      const handleTextDoubleClick = (e: MouseEvent) => {
        if (selectedToolRef.current !== "text") return;
        const rect = canvas.getBoundingClientRect();
        const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const canvasPos = {
          x: (e.clientX - rect.left - panOffsetRef.current.x) / zoomRef.current,
          y: (e.clientY - rect.top - panOffsetRef.current.y) / zoomRef.current,
        };
        setTextPosition({ screen: screenPos, canvas: canvasPos });
        setCurrentText("");
        setIsEditingText(true);
        setTimeout(() => textInputRef.current?.focus(), 0);
      };

      canvas.addEventListener("dblclick", handleTextDoubleClick);

      try {
        cleanup = await initDrawing(
          canvas,
          send,
          resolvedRoomId,
          () => selectedToolRef.current,
          () => currentPropertiesRef.current,
          {
            getZoom: () => zoomRef.current,
            getPanOffset: () => panOffsetRef.current,
          },
          (shapeId) => {
            if (!isSubscribed) return;
            setSelectedShapeId(shapeId);
            if (shapeId !== null) {
              const shape = getShape(shapeId);
              if (shape) {
                setCurrentProperties({
                  strokeColor: shape.strokeColor || "#000000",
                  fillColor: shape.fillColor || "transparent",
                  strokeWidth: shape.strokeWidth || 2,
                  strokeStyle: shape.strokeStyle || "solid",
                  fillStyle: shape.fillStyle || "solid",
                });
              }
              if (canvas && ctx && shape) drawSelectionBox(ctx, shape);
              setShowPropertyPanel(true);
            } else {
              setShowPropertyPanel(false);
            }
          },
          (shapeId, shape) => {
            if (!isSubscribed) return;
            setEditingTextId(Number(shape.id));
            const z = zoomRef.current;
            const pan = panOffsetRef.current;
            setTextPosition({
              screen: {
                x: shape.startX * z + pan.x + 10,
                y: shape.startY * z + pan.y + 10,
              },
              canvas: { x: shape.startX, y: shape.startY },
            });
            setCurrentText(shape.text || "");
            setIsEditingText(true);
            setTimeout(() => textInputRef.current?.focus(), 0);
          },
          {
            onPanStart: (_: boolean) => { /* intentional noop */ },
            onPanMove: (offset: { x: number; y: number }) => {
              if (!isSubscribed) return;
              setPanOffset(offset);
            },
            onZoom: (newZoom: number, newPan: { x: number; y: number }) => {
              if (!isSubscribed) return;
              setZoom(newZoom);
              setPanOffset(newPan);
            },
          },
          // onShapeDeleted callback (task 3): clear selection if deleted shape was selected
          (shapeId) => {
            if (!isSubscribed) return;
            setSelectedShapeId((prev) => (prev === shapeId ? null : prev));
            setShowPropertyPanel(false);
          }
        );
      } catch (error) {
        console.error("Failed to initialize drawing:", error);
      }

      window.addEventListener("resize", resizeCanvas);
      return () => {
        window.removeEventListener("resize", resizeCanvas);
        canvas.removeEventListener("dblclick", handleTextDoubleClick);
      };
    }

    initializeCanvas().then((cleanupFn) => {
      if (cleanupFn) innerCleanup = cleanupFn;
    });

    return () => {
      clearTimeout(timer);
      try {
        if (isConnected) send({ type: "leave-room", roomId: resolvedRoomId });
      } catch {}
      isSubscribed = false;
      clearAllDrawings();
      if (innerCleanup) innerCleanup();
      if (cleanup) cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, send, resolvedRoomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor =
      selectedTool === "hand" ? "grab" :
      selectedTool === "select" ? "pointer" :
      selectedTool === "eraser" ? "cell" :
      "crosshair";
  }, [selectedTool]);

  useEffect(() => {
    if (isEditingText && textInputRef.current) {
      const textarea = textInputRef.current;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(0, 0);
        textarea.style.height = "auto";
        textarea.style.height = Math.max(textarea.scrollHeight, 30) + "px";
        textarea.style.width = "auto";
        textarea.style.width = Math.max(200, textarea.scrollWidth + 10) + "px";
      }, 10);
    }
  }, [isEditingText]);

  // ── Loading/connecting states ──────────────────────────────────────────
  if (!resolvedRoomId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          {connectTimeout ? (
            <>
              <p className="text-destructive font-semibold mb-2">Could not connect to room</p>
              <p className="text-muted-foreground text-sm mb-4">
                Check that the server is running and try again.
              </p>
              <Button onClick={() => router.replace("/dashboard")} variant="outline">
                Back to Dashboard
              </Button>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Connecting to room...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* ── Connection status badge ────────────────────────────────────── */}
      <Badge
        variant="default"
        className="absolute rounded-xl px-3 py-2 top-2 right-3 z-50"
        aria-live="polite"
        aria-label={isConnected ? "Connected" : "Offline"}
      >
        <div className="flex gap-2 items-center">
          <span className={`size-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-center font-bold">{isConnected ? "Online" : "Offline"}</span>
        </div>
      </Badge>

      {/* ── Collaborator count badge ────────────────────────────────────── */}
      {remoteCursors.size > 0 && (
        <Badge
          variant="secondary"
          className="absolute rounded-xl px-3 py-2 top-2 right-28 z-50"
          aria-label={`${remoteCursors.size + 1} people drawing`}
        >
          {remoteCursors.size + 1} drawing
        </Badge>
      )}

      {/* ── Property panel ────────────────────────────────────────────── */}
      {showPropertyPanel && (
        <PropertyPanel
          properties={currentProperties}
          onPropertyChange={handlePropertyChange}
          onClose={() => setShowPropertyPanel(false)}
        />
      )}

      {/* ── Text editing overlay ──────────────────────────────────────── */}
      {isEditingText && (
        <TextOnCanvas
          currentText={currentText}
          currentProperties={currentProperties}
          setCurrentText={setCurrentText}
          textInputRef={textInputRef as React.RefObject<HTMLTextAreaElement>}
          handleAddText={handleAddText}
          setIsEditingText={setIsEditingText}
          isEditingText={isEditingText}
          textPosition={textPosition}
        />
      )}

      {/* ── Remote cursors ────────────────────────────────────────────── */}
      {Array.from(remoteCursors.values()).map((cursor) => {
        const color = cursorColorForUser(cursor.userId);
        const screenX = cursor.x * zoomRef.current + panOffsetRef.current.x;
        const screenY = cursor.y * zoomRef.current + panOffsetRef.current.y;
        return (
          <div
            key={cursor.userId}
            className="pointer-events-none absolute z-40 transition-transform duration-[50ms]"
            style={{ left: screenX, top: screenY, transform: "translate(-2px, -2px)" }}
            aria-hidden="true"
          >
            {/* SVG cursor */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M0 0 L0 14 L4 10 L7 17 L9 16 L6 9 L11 9 Z"
                fill={color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <span
              className="absolute left-4 top-0 text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{ backgroundColor: color, color: "#fff" }}
            >
              {cursor.name}
            </span>
          </div>
        );
      })}

      {/* ── Menu (top-left) ───────────────────────────────────────────── */}
      <div className="fixed top-6 left-6 z-50">
        <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg overflow-hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-accent hover:text-accent-foreground"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56 rounded-2xl p-3 py-5 bg-background/95 backdrop-blur-sm"
            >
              {/* Reset Canvas */}
              <DropdownMenuItem
                className="flex items-center gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer"
                onSelect={(e) => { e.preventDefault(); handleResetCanvas(); }}
              >
                <Trash className="w-4 h-4 text-destructive" />
                <span>Reset Canvas</span>
              </DropdownMenuItem>

              {/* Export PNG */}
              <DropdownMenuItem
                className="flex items-center gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer"
                onSelect={(e) => { e.preventDefault(); handleExportPNG(); }}
              >
                <Download className="w-4 h-4" />
                <span>Export as PNG</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <CanvasDropdown />
              <DropdownMenuSeparator />

              {/* Canvas background */}
              <DropdownMenuItem
                className="flex flex-col items-start gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <span className="text-sm font-medium">Canvas Background</span>
                <div className="grid grid-cols-5 gap-2 w-full">
                  {pastelColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={(e) => handleCanvasBgChange(color.value, e)}
                      className={`h-8 w-8 rounded-md border transition-all hover:scale-105 ${
                        canvasBg === color.value
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border"
                      } ${color.class}`}
                      title={color.name}
                      aria-label={`Background: ${color.name}`}
                    />
                  ))}
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Tool toolbar (top-center) ────────────────────────────────── */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
        <div className="rounded-2xl bg-background/95 backdrop-blur-sm shadow-lg">
          <div className="flex items-center gap-1 p-1" role="toolbar" aria-label="Drawing tools">
            {tools.map(({ id, icon: Icon, label }) => (
              <Button
                key={id}
                variant={selectedTool === id ? "default" : "ghost"}
                size="icon"
                title={label}
                aria-label={label}
                aria-pressed={selectedTool === id}
                className={`h-10 w-10 rounded-3xl transition-all ${
                  selectedTool === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={() => handleToolSelect(id as ToolType)}
              >
                <Icon className="w-5 h-5" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Zoom controls (bottom-left) ──────────────────────────────── */}
      <div className="fixed bottom-6 left-6 z-50">
        <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg overflow-hidden">
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              title="Zoom In (scroll up)"
              aria-label="Zoom In"
              onClick={handleZoomIn}
              className="h-10 w-12 rounded-none hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <button
              onClick={handleResetZoom}
              className="h-10 w-12 flex items-center justify-center text-sm font-semibold tabular-nums hover:bg-accent hover:text-accent-foreground transition-colors text-foreground"
              title="Reset zoom"
              aria-label={`Zoom ${Math.round(zoom * 100)}%, click to reset`}
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon"
              title="Zoom Out (scroll down)"
              aria-label="Zoom Out"
              onClick={handleZoomOut}
              className="h-10 w-12 rounded-none hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Minus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        style={{ backgroundColor: canvasBg }}
        className="absolute h-full w-full inset-0"
        aria-label="Drawing canvas"
      />
    </div>
  );
};

export default Room;
