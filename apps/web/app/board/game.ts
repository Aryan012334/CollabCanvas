import { getToolTypeFromString, Shape, ToolType, ZoomContext } from "./types";
import { repaintRect, repaintCircle, repaintLine, repaintDiamond, repaintArrow, repaintText } from "./repaint";
import { getAllShapesInRoom } from "@/actions/action";

export let allDrawings: Shape[] = [];

/** Call this when leaving a room to prevent stale shapes on next mount. */
export function clearAllDrawings() {
    allDrawings = [];
}

export function drawSelectionBox(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();

    const transform = ctx.getTransform();
    const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);

    ctx.strokeStyle = "#4F46E5";
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);

    const padding = 10;
    const minX = Math.min(shape.startX, shape.startX + shape.width);
    const maxX = Math.max(shape.startX, shape.startX + shape.width);
    const minY = Math.min(shape.startY, shape.startY + shape.height);
    const maxY = Math.max(shape.startY, shape.startY + shape.height);

    ctx.strokeRect(
        minX - padding,
        minY - padding,
        Math.abs(shape.width) + padding * 2,
        Math.abs(shape.height) + padding * 2
    );

    const handleSize = 8 / scale;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#4F46E5";
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([]);

    const corners = [
        { x: minX - padding, y: minY - padding },
        { x: maxX + padding, y: minY - padding },
        { x: maxX + padding, y: maxY + padding },
        { x: minX - padding, y: maxY + padding },
    ];

    corners.forEach(corner => {
        ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    });

    ctx.restore();
}

function renderPreviousShapes(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    drawings: Shape[],
    zoomContext: ZoomContext,
    selectedId: number | null = null
) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const zoom = zoomContext.getZoom();
    const pan = zoomContext.getPanOffset();

    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    drawings.forEach((shape) => {
        switch (shape.type) {
            case "RECTANGLE": repaintRect(ctx, shape); break;
            case "CIRCLE":    repaintCircle(ctx, shape); break;
            case "LINE":      repaintLine(ctx, shape); break;
            case "DIAMOND":   repaintDiamond(ctx, shape); break;
            case "ARROW":     repaintArrow(ctx, shape); break;
            case "TEXT":      repaintText(ctx, shape); break;
            default: break;
        }

        if (shape.id === selectedId) {
            drawSelectionBox(ctx, shape);
        }
    });

    ctx.restore();
}

export async function initDrawing(
    canvas: HTMLCanvasElement,
    send: (data: Record<string, unknown>) => void,
    roomId: number,
    getSelectedTool: () => ToolType,
    getCurrentProperties: () => Partial<Shape>,
    zoomContext: ZoomContext,
    onShapeSelected: (id: number | null) => void,
    onTextEdit: (index: number, shape: Shape) => void,
    panZoomHandlers: {
        onPanStart: (isPanning: boolean) => void;
        onPanMove: (offset: { x: number; y: number }) => void;
        onZoom: (newZoom: number, newPan: { x: number; y: number }) => void;
    },
    onShapeDeleted?: (shapeId: number) => void
) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    async function getAllShapes() {
        const res = await getAllShapesInRoom(roomId);
        allDrawings = (res ?? []).map((s: Shape & {
            startX?: number | null; startY?: number | null;
            width?: number | null; height?: number | null
        }) => ({
            ...s,
            startX: s.startX ?? 0,
            startY: s.startY ?? 0,
            width: s.width ?? 0,
            height: s.height ?? 0,
        }));
        if (!ctx || !canvas) return;
        renderPreviousShapes(canvas, ctx, allDrawings, zoomContext);
    }

    await getAllShapes();

    let drawing = false;
    let dragging = false;
    let panning = false;
    let draggedShapeId: number | null = null;
    let dragStartPos = { x: 0, y: 0 };
    let shapeStartPos = { x: 0, y: 0 };
    let panStart = { x: 0, y: 0 };
    let startX = 0;
    let startY = 0;
    let currentlySelectedId: number | null = null;

    const screenToCanvas = (screenX: number, screenY: number) => {
        const rect = canvas.getBoundingClientRect();
        const zoom = zoomContext.getZoom();
        const pan = zoomContext.getPanOffset();
        return {
            x: (screenX - rect.left - pan.x) / zoom,
            y: (screenY - rect.top - pan.y) / zoom,
        };
    };

    const getShapeAtPosition = (x: number, y: number): Shape | null => {
        for (let i = allDrawings.length - 1; i >= 0; i--) {
            const shape = allDrawings[i];
            // FIX: was `return null` instead of `continue` — caused early exit on first falsy item
            if (!shape) continue;

            const shapeType = shape.type?.toUpperCase();

            if (shapeType === "LINE" || shapeType === "ARROW") {
                const tolerance = 10;
                const x1 = shape.startX, y1 = shape.startY;
                const x2 = shape.startX + shape.width, y2 = shape.startY + shape.height;
                const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                const param = lenSq !== 0 ? dot / lenSq : -1;
                const xx = param < 0 ? x1 : param > 1 ? x2 : x1 + param * C;
                const yy = param < 0 ? y1 : param > 1 ? y2 : y1 + param * D;
                const distance = Math.sqrt((x - xx) ** 2 + (y - yy) ** 2);
                if (distance < tolerance) return shape;
            } else if (shapeType === "TEXT" && shape.text) {
                const textWidth = shape.width || 300;
                const textHeight = shape.height || 30;
                if (x >= shape.startX && x <= shape.startX + textWidth &&
                    y >= shape.startY && y <= shape.startY + textHeight) {
                    return shape;
                }
            } else {
                const minX = Math.min(shape.startX, shape.startX + shape.width);
                const maxX = Math.max(shape.startX, shape.startX + shape.width);
                const minY = Math.min(shape.startY, shape.startY + shape.height);
                const maxY = Math.max(shape.startY, shape.startY + shape.height);
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) return shape;
            }
        }
        return null;
    };

    // ─── Keyboard: Delete/Backspace → delete selected shape ─────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
        // Don't intercept when user is typing in a textarea/input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT") return;

        if ((e.key === "Delete" || e.key === "Backspace") && currentlySelectedId !== null) {
            e.preventDefault();
            const shapeId = currentlySelectedId;

            // Remove from local array
            const idx = allDrawings.findIndex(s => s.id === shapeId);
            if (idx >= 0) allDrawings.splice(idx, 1);

            // Re-render without the shape
            renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, null);

            // Notify server and other clients
            send({ type: "shape:delete", roomId, shapeId });

            currentlySelectedId = null;
            onShapeSelected(null);
            onShapeDeleted?.(shapeId);
        }

        // Keyboard shortcuts: tool switching
        switch (e.key.toLowerCase()) {
            case "v": if (getSelectedTool() !== "text") { /* handled by page */ } break;
            default: break;
        }
    };

    window.addEventListener("keydown", handleKeyDown);

    const handleMouseDown = (e: MouseEvent) => {
        const selectedTool = getSelectedTool();

        if (selectedTool === "hand") {
            panning = true;
            const pan = zoomContext.getPanOffset();
            panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            canvas.style.cursor = "grabbing";
            panZoomHandlers.onPanStart(true);
            return;
        }

        const coords = screenToCanvas(e.clientX, e.clientY);

        // Text tool: single click opens input at that position.
        // Pass both the raw screen position (for positioning the textarea overlay)
        // and the canvas position (for storing in the shape).
        if (selectedTool === "text") {
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            onTextEdit(-1, {
                id: -1,
                startX: coords.x,   // canvas coords — stored in the shape
                startY: coords.y,
                width: 0,
                height: 0,
                type: "TEXT",
                text: "",
                // Attach screen coords as extra data the callback can use
                // (Shape interface allows extra fields via spread)
            });
            // We need the screen position — pass it via a side-channel on the shape object
            // by temporarily storing it. The callback reads it.
            (window as any).__textScreenPos = { x: screenX, y: screenY };
            return;
        }

        if (selectedTool === "select") {
            const shape = getShapeAtPosition(coords.x, coords.y);
            if (shape && shape.id !== null) {
                if (currentlySelectedId !== shape.id) {
                    currentlySelectedId = shape.id;
                    renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, shape.id);
                }
                draggedShapeId = Number(shape.id);
                dragging = true;
                dragStartPos = coords;
                shapeStartPos = { x: shape.startX, y: shape.startY };
                onShapeSelected(Number(shape.id));
            } else {
                // Click on empty space — deselect
                currentlySelectedId = null;
                onShapeSelected(null);
                renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, null);
            }
            return;
        }

        // Eraser: click/drag to erase the shape under the cursor
        if (selectedTool === "eraser") {
            const shape = getShapeAtPosition(coords.x, coords.y);
            if (shape && shape.id !== null) {
                const shapeId = Number(shape.id);
                const idx = allDrawings.findIndex(s => s.id === shapeId);
                if (idx >= 0) allDrawings.splice(idx, 1);
                renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, null);
                send({ type: "shape:delete", roomId, shapeId });
                onShapeDeleted?.(shapeId);
            }
            return;
        }

        drawing = true;
        startX = coords.x;
        startY = coords.y;
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (panning && getSelectedTool() === "hand") {
            const newPan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
            panZoomHandlers.onPanMove(newPan);
            return;
        }

        const coords = screenToCanvas(e.clientX, e.clientY);

        // Eraser: erase while dragging
        if (getSelectedTool() === "eraser") {
            const shape = getShapeAtPosition(coords.x, coords.y);
            if (shape && shape.id !== null) {
                const shapeId = Number(shape.id);
                const idx = allDrawings.findIndex(s => s.id === shapeId);
                if (idx >= 0) {
                    allDrawings.splice(idx, 1);
                    renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, null);
                    send({ type: "shape:delete", roomId, shapeId });
                    onShapeDeleted?.(shapeId);
                }
            }
            return;
        }

        if (dragging && draggedShapeId !== null && getSelectedTool() === "select") {
            const dx = coords.x - dragStartPos.x;
            const dy = coords.y - dragStartPos.y;
            const shape = allDrawings.find(d => d.id === draggedShapeId);
            if (shape) {
                shape.startX = shapeStartPos.x + dx;
                shape.startY = shapeStartPos.y + dy;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, draggedShapeId);
            }
            return;
        }

        if (!drawing || getSelectedTool() === "hand" || getSelectedTool() === "select") return;

        const width = coords.x - startX;
        const height = coords.y - startY;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderPreviousShapes(canvas, ctx, allDrawings, zoomContext);

        ctx.save();
        const zoom = zoomContext.getZoom();
        const pan = zoomContext.getPanOffset();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);

        const currentShape: Shape = {
            id: -1, startX, startY, width, height,
            type: getToolTypeFromString(getSelectedTool()),
            ...getCurrentProperties()
        };

        switch (getSelectedTool()) {
            case "rect":    repaintRect(ctx, currentShape); break;
            case "circle":  repaintCircle(ctx, currentShape); break;
            case "line":    repaintLine(ctx, currentShape); break;
            case "diamond": repaintDiamond(ctx, currentShape); break;
            case "arrow":   repaintArrow(ctx, currentShape); break;
            default: break;
        }

        ctx.restore();
    };

    const handleMouseUp = (e: MouseEvent) => {
        const selectedTool = getSelectedTool();

        if (panning) {
            panning = false;
            canvas.style.cursor = "grab";
            panZoomHandlers.onPanStart(false);
            return;
        }

        const coords = screenToCanvas(e.clientX, e.clientY);

        if (dragging) {
            dragging = false;
            const dx = coords.x - dragStartPos.x;
            const dy = coords.y - dragStartPos.y;
            const shape = allDrawings.find(d => d.id === draggedShapeId);

            if (!shape) {
                draggedShapeId = null;
                return;
            }

            const newX = shapeStartPos.x + dx;
            const newY = shapeStartPos.y + dy;
            const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

            if (moved) {
                shape.startX = newX;
                shape.startY = newY;
                send({
                    type: "shape:update",
                    roomId,
                    shape: { ...shape, startX: newX, startY: newY },
                });
            }
            draggedShapeId = null;
            return;
        }

        if (!drawing || selectedTool === "hand" || selectedTool === "select" || selectedTool === "eraser") return;
        drawing = false;

        const width = coords.x - startX;
        const height = coords.y - startY;

        if (Math.abs(width) > 1 || Math.abs(height) > 1) {
            send({
                type: "shape:create",
                roomId,
                shape: {
                    startX, startY, width, height,
                    type: getToolTypeFromString(selectedTool),
                    ...getCurrentProperties(),
                }
            });
        }
    };

    const handleDoubleClick = (e: MouseEvent) => {
        const selectedTool = getSelectedTool();
        if (selectedTool !== "select") return;
        e.preventDefault();
        e.stopPropagation();
        const coords = screenToCanvas(e.clientX, e.clientY);
        const shape = getShapeAtPosition(coords.x, coords.y);
        if (!shape || shape.id === null) return;
        // For editing existing text, capture screen position from the shape's stored coords
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        (window as any).__textScreenPos = { x: screenX, y: screenY };
        onTextEdit(shape.id, shape);
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("dblclick", handleDoubleClick);

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const currentZoom = zoomContext.getZoom();
        const currentPan = zoomContext.getPanOffset();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.1), 10);
        const scale = newZoom / currentZoom;
        const newPan = {
            x: mouseX - (mouseX - currentPan.x) * scale,
            y: mouseY - (mouseY - currentPan.y) * scale,
        };
        panZoomHandlers.onZoom(newZoom, newPan);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("dblclick", handleDoubleClick);
        canvas.removeEventListener("wheel", handleWheel);
        window.removeEventListener("keydown", handleKeyDown);
    };
}

export function getShape(shapeId: number): Shape | null {
    if (shapeId >= 0) {
        return allDrawings.find(d => Number(d.id) === shapeId) ?? null;
    }
    return null;
}

export function getShapeByIndex(shapeIndex: number): Shape | null {
    return allDrawings[shapeIndex] ?? null;
}

export function addShape(shape: Shape) {
    allDrawings.push(shape);
}

export function addTextShape(shape: Shape) {
    allDrawings.push(shape);
}

export function getAllDrawings() {
    return [...allDrawings];
}

export function removeShapeById(shapeId: number) {
    const idx = allDrawings.findIndex(s => s.id === shapeId);
    if (idx >= 0) allDrawings.splice(idx, 1);
}

export function renderCanvas(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    zoomContext: ZoomContext,
    selectedIndex: number | null = null
) {
    renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, selectedIndex);
}

/**
 * FIX (Task 2): updateShapeProperty now ALSO updates the local allDrawings array
 * immediately so the canvas reflects the change for the user who made it.
 * Previously it only sent the WS message and waited for the echo — but the echo
 * was filtered out for own-user updates, so the change was never applied locally.
 */
export function updateShapeProperty(
    shapeId: number,
    property: keyof Shape,
    value: unknown,
    send: (data: Record<string, unknown>) => void,
    roomId: number
) {
    if (shapeId < 0) return;
    const shape = allDrawings.find(d => d.id === shapeId);
    if (!shape) return;
    if (!(property in shape)) return;

    // Apply locally first so the canvas updates immediately
    (shape as unknown as Record<string, unknown>)[property] = value;

    // Then sync to server/peers
    send({
        type: "shape:update",
        roomId,
        shape: { ...shape, [property]: value },
    });
}

export function updateShapeById(
    shape: Shape,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    zoomContext: ZoomContext,
) {
    const shapeIndex = allDrawings.findIndex(s => s.id === shape.id);
    if (shapeIndex >= 0) {
        allDrawings.splice(shapeIndex, 1, shape);
        renderCanvas(canvas, ctx, zoomContext);
    }
}
