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
  renderCanvas,
  updateShapeById,
  updateShapeProperty,
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
import { Menu, Minus, Plus, Trash } from "lucide-react";
import { CanvasDropdown } from "@/components/CanvasDropdown";
import { useParams } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { Context } from "@/components/providers/ContextProvider";

const Room = () => {
  const [selectedTool, setSelectedTool] = useState<ToolType>("select");
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [canvasBg, setCanvasBg] = useState("#f5f5f5");
  const [isEditingText, setIsEditingText] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
  const { roomId } = useParams();
  // console.log(roomId);

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
  const { theme } = useTheme();
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(zoom);
  const panOffsetRef = useRef(panOffset);
  const selectedToolRef = useRef(selectedTool);
  const currentPropertiesRef = useRef(currentProperties);
  const selectedShapeIndexRef = useRef(selectedShapeId);

  const { user } = useContext(Context);

  const { send, isConnected } = useWebSocket(
    useCallback((eventData: any) => {
      switch (eventData.type) {
        case "shape:create":
          allDrawings.push(eventData.shape);
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx) {
            renderCanvas(canvas, ctx, {
              getZoom: () => zoomRef.current,
              getPanOffset: () => panOffsetRef.current,
            });

            // setSelectedShapeId(eventData.shape.id);

            setSelectedTool("select");

            const shape = eventData.shape;
            if (shape) {
              setCurrentProperties({
                strokeColor: shape.strokeColor || "#000000",
                fillColor: shape.fillColor || "transparent",
                strokeWidth: shape.strokeWidth || 2,
                strokeStyle: shape.strokeStyle || "solid",
                fillStyle: shape.fillStyle || "solid",
              });
            }
          }
          break;

        case "shape:update":
          const { shape } = eventData;

          if (eventData.userId === user?.id) {
            return;
          }
          const canvas2 = canvasRef.current;
          const ctx2 = canvas2?.getContext("2d");
          if (canvas2 && ctx2) {
            updateShapeById(shape, canvas2, ctx2, {
              getZoom: () => zoomRef.current,
              getPanOffset: () => panOffsetRef.current,
            });

            setSelectedShapeId(eventData.shape.id);
            setSelectedTool("select");
            if (eventData.shape.type === "text") {
              setEditingTextId(null);
            }
          }
          break;

        default:
          break;
      }
    }, [])
  );

  useEffect(() => {
    zoomRef.current = zoom;
    panOffsetRef.current = panOffset;
    selectedToolRef.current = selectedTool;
    currentPropertiesRef.current = currentProperties;
    selectedShapeIndexRef.current = selectedShapeId;
  }, [zoom, panOffset, selectedTool, currentProperties, selectedShapeId]);

  const handleCanvasBgChange = (color: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCanvasBg(color);
  };

  const handleToolSelect = (toolId: ToolType) => {
    setSelectedTool(toolId);
    if (toolId === "select") {
      setShowPropertyPanel(true);
    }
  };

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const newZoom = Math.min(zoom * 1.2, 10);
    const scale = newZoom / zoom;

    const newPanX = centerX - (centerX - panOffset.x) * scale;
    const newPanY = centerY - (centerY - panOffset.y) * scale;

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const newZoom = Math.max(zoom / 1.2, 0.1);
    const scale = newZoom / zoom;

    const newPanX = centerX - (centerX - panOffset.x) * scale;
    const newPanY = centerY - (centerY - panOffset.y) * scale;

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
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
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    });

    const textWidth = Math.round(maxWidth + 130);
    const textHeight = Math.round(lines.length * lineHeight);

    ctx.restore();

    if (editingTextId !== null) {
      const shape = getShape(editingTextId);
      //add new data for the shape add a property with three values
      send({
        type: "shape:update",
        roomId: Number(roomId),
        shape: {
          ...shape,
          text: text,
          width: textWidth,
          height: textHeight,
          fontSize: Math.round(normalizedFontSize),
        },
      });
    } else {
      send({
        type: "shape:create",
        roomId: Number(roomId),
        shape: {
          startX: x,
          startY: y,
          width: textWidth,
          height: textHeight,
          type: getToolTypeFromString("text"),
          strokeColor: currentProperties.strokeColor || "#000000",
          text: text,
          fontSize: Math.round(normalizedFontSize),
        },
      });
    }

    setCurrentText("");
  };

  const handlePropertyChange = (property: string, value: any) => {
    setCurrentProperties((prev) => ({ ...prev, [property]: value }));
    console.log(selectedShapeId, "id");
    if (selectedShapeId !== null) {
      updateShapeProperty(
        selectedShapeId,
        property as keyof Shape,
        value,
        send,
        Number(roomId)
      );
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderCanvas(
      canvas,
      ctx,
      {
        getZoom: () => zoomRef.current,
        getPanOffset: () => panOffsetRef.current,
      },
      selectedShapeIndexRef.current
    );
  }, [zoom, panOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId || !isConnected) return;

    const timer = setTimeout(() => {
      console.log(" Joining room:", roomId);
      send({
        type: "join-room",
        roomId: Number(roomId),
      });
    }, 100);

    let cleanup: (() => void) | undefined;
    let isSubscribed = true; // Prevent state updates after unmount

    const ctx = canvas.getContext("2d");

    async function initializeCanvas() {
      if (!roomId) return;
      if (!canvas) return;

      const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          renderCanvas(
            canvas,
            ctx,
            {
              getZoom: () => zoomRef.current,
              getPanOffset: () => panOffsetRef.current,
            },
            selectedShapeIndexRef.current
          );
        }
      };

      resizeCanvas();

      const handleTextDoubleClick = (e: MouseEvent) => {
        if (selectedToolRef.current !== "text") return;

        const rect = canvas.getBoundingClientRect();
        const screenPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };

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
        // Await async initDrawing
        cleanup = await initDrawing(
          canvas,
          send,
          Number(roomId),
          () => selectedToolRef.current,
          () => currentPropertiesRef.current,
          {
            getZoom: () => zoomRef.current,
            getPanOffset: () => panOffsetRef.current,
          },
          // (shapeId: number) => {
          //   if (!isSubscribed) return; // Prevent state updates after unmount

          //   setSelectedShapeId(shapeId);
          //   setSelectedTool("select");
          //   setShowPropertyPanel(true);

          //   const shape = getShape(shapeId);
          //   if (shape) {
          //     setCurrentProperties({
          //       strokeColor: shape.strokeColor || "#000000",
          //       fillColor: shape.fillColor || "transparent",
          //       strokeWidth: shape.strokeWidth || 2,
          //       strokeStyle: shape.strokeStyle || "solid",
          //       fillStyle: shape.fillStyle || "solid",
          //     });
          //   }
          // },
          (shapeId) => {
            if (!isSubscribed) return;

            setSelectedShapeId(shapeId);
            console.log("shapeId", shapeId);
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
              if (canvas && ctx && shape) {
                drawSelectionBox(ctx, shape);
              }
              setShowPropertyPanel(true);
            } else {
              setShowPropertyPanel(false);
            }

            // if (canvas && ctx) {
            //   renderCanvas(
            //     canvas,
            //     ctx,
            //     {
            //       getZoom: () => zoomRef.current,
            //       getPanOffset: () => panOffsetRef.current,
            //     },
            //     shapeId
            //   );
            // }
          },
          (shapeId, shape) => {
            if (!isSubscribed) return;

            setEditingTextId(Number(shape.id));
            const zoom = zoomRef.current;
            const pan = panOffsetRef.current;

            setTextPosition({
              screen: {
                x: shape.startX + 250 * zoom + pan.x,
                y: shape.startY + 50 * zoom + pan.y,
              },
              canvas: { x: shape.startX + 250, y: shape.startY + 50 },
            });
            setCurrentText(shape.text || "");
            setIsEditingText(true);
            setTimeout(() => textInputRef.current?.focus(), 0);
          },
          {
            onPanStart: (isPanning: boolean) => {
              if (!isSubscribed) return;
              setIsPanning(isPanning);
            },
            onPanMove: (offset: { x: number; y: number }) => {
              if (!isSubscribed) return;
              setPanOffset(offset);
            },
            onZoom: (newZoom: number, newPan: { x: number; y: number }) => {
              if (!isSubscribed) return;
              setZoom(newZoom);
              setPanOffset(newPan);
            },
          }
        );
      } catch (error) {
        console.error("Failed to initialize drawing:", error);
      }

      const handleResize = () => {
        resizeCanvas();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        canvas.removeEventListener("dblclick", handleTextDoubleClick);
      };
    }

    initializeCanvas().then((cleanupFn) => {
      if (cleanupFn) {
        cleanup = cleanupFn;
      }
    });

    return () => {
      clearTimeout(timer);
      try {
        if (isConnected) {
          console.log(" Leaving room:", roomId);
          send({
            type: "leave-room",
            roomId: Number(roomId),
          });
        }
      } catch (error) {
        console.log("Could not send leave-room:", error);
      }

      isSubscribed = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, [isConnected, send]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.cursor =
      selectedTool === "hand"
        ? "grab"
        : selectedTool === "select"
          ? "pointer"
          : "crosshair";
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

  if (!isConnected) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>Connecting to room...</p>
        </div>
      </div>
    );
  }
  return (
    <div className='relative w-screen h-screen overflow-hidden'>
      {/* Text Input Overlay */}

      <Badge
        variant={"default"}
        className='absolute rounded-xl px-3 py-2 top-2 right-3 z-50'>
        <div className='flex gap-2 items-center'>
          {isConnected ? (
            <>
              <span className='size-3 rounded-full bg-green-500'></span>
              <div className='text-center font-bold '>Online</div>
            </>
          ) : (
            <>
              <span className='size-3 rounded-full bg-red-500'></span>
              <div className='text-center font-bold '>Offline</div>
            </>
          )}
        </div>
      </Badge>
      {showPropertyPanel && (
        <PropertyPanel
          properties={currentProperties}
          onPropertyChange={(property: string, value) => {
            setCurrentProperties((prev) => ({ ...prev, [property]: value }));
            // If a shape is selected, update it
            console.log(selectedShapeId, "id");
            if (selectedShapeId !== null) {
              handlePropertyChange(property, value);
            }
          }}
          onClose={() => setShowPropertyPanel(false)}
        />
      )}
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
      {/*Floating Dropdown menu  */}
      <div className='fixed top-6 left-6 z-50'>
        <div className='rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg overflow-hidden'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-10 w-10 hover:bg-accent hover:text-accent-foreground'>
                <Menu className='w-5 h-5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='start'
              className='w-56 rounded-2xl p-3 py-5 bg-background/95 backdrop-blur-sm'>
              <DropdownMenuItem
                className='flex items-center gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer'
                onSelect={(e) => e.preventDefault()}>
                <Trash className='w-4 h-4 text-destructive' />
                <span>Reset Canvas</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <CanvasDropdown />

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className='flex flex-col items-start gap-2'
                onSelect={(e) => e.preventDefault()}>
                <span className='text-sm font-medium'>Canvas Background</span>
                <div className='grid grid-cols-5 gap-2 w-full'>
                  {pastelColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={(e) => handleCanvasBgChange(color.value, e)}
                      className={`
                        h-8 w-8 rounded-md border transition-all hover:scale-105
                        ${canvasBg === color.value ? "border-primary ring-2 ring-primary/20" : "border-border"}
                        ${color.class}
                      `}
                      title={color.name}
                    />
                  ))}
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Floating Toolbar */}
      <div className='fixed top-6 left-1/2 -translate-x-1/2 z-50'>
        <div className='rounded-2xl  bg-background/95 backdrop-blur-sm shadow-lg'>
          <div className='flex items-center gap-1 p-1'>
            {tools.map(({ id, icon: Icon, label }) => (
              <Button
                key={id}
                variant={selectedTool === id ? "default" : "ghost"}
                size='icon'
                title={label}
                className={`
            h-10 w-10 rounded-3xl transition-all
            ${
              selectedTool === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-accent hover:text-accent-foreground"
            }
          `}
                onClick={() => handleToolSelect(id as ToolType)}>
                <Icon className='w-5 h-5' />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Zoom Controls - Bottom Left */}
      <div className='fixed bottom-6 left-6 z-50'>
        <div className='rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg overflow-hidden'>
          <div className='flex  '>
            <Button
              variant='ghost'
              size='icon'
              title='Zoom In (Ctrl +)'
              aria-label='Zoom In'
              onClick={handleZoomIn}
              className='h-10 w-12 rounded-none hover:bg-accent hover:text-accent-foreground transition-colors'>
              <Plus className='w-4 h-4' />
            </Button>

            <button
              onClick={handleResetZoom}
              className='
          h-10 w-12 flex items-center justify-center
          text-sm font-semibold tabular-nums
          hover:bg-accent hover:text-accent-foreground 
          transition-colors border-none
          text-foreground
        '
              title='Reset Zoom (Ctrl 0)'>
              {Math.round(zoom * 100)}%
            </button>

            <Button
              variant='ghost'
              size='icon'
              title='Zoom Out (Ctrl -)'
              aria-label='Zoom Out'
              onClick={handleZoomOut}
              className='h-10 w-12 rounded-none hover:bg-accent hover:text-accent-foreground transition-colors'>
              <Minus className='w-4 h-4' />
            </Button>
          </div>
        </div>
      </div>

      {/* Full Screen Canvas */}
      <canvas
        ref={canvasRef}
        style={{ backgroundColor: canvasBg }}
        className='absolute h-full w-full inset-0 '
      />
    </div>
  );
};

export default Room;
