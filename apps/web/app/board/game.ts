import { getToolTypeFromString, Shape, ToolType, ZoomContext } from "./types";
import { repaintRect, repaintCircle, repaintLine, repaintDiamond, repaintArrow, repaintPencil, repaintText } from "./repaint";
import { getAllShapesInRoom } from "@/actions/action";
import { v4 as uuidv4 } from "uuid";

export let allDrawings: Shape[] = [];
let currentPoints: { x: number; y: number }[] = [];


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

    // Draw bounding box
    ctx.strokeRect(
        minX - padding,
        minY - padding,
        Math.abs(shape.width) + padding * 2,
        Math.abs(shape.height) + padding * 2
    );

    // Draw corner handles for resizing
    const handleSize = 8 / scale;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#4F46E5";
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([]);

    const corners = [
        { x: minX - padding, y: minY - padding, cursor: "nwse-resize" },
        { x: maxX + padding, y: minY - padding, cursor: "nesw-resize" },
        { x: maxX + padding, y: maxY + padding, cursor: "nwse-resize" },
        { x: minX - padding, y: maxY + padding, cursor: "nesw-resize" },
    ];

    corners.forEach(corner => {
        ctx.fillRect(
            corner.x - handleSize / 2,
            corner.y - handleSize / 2,
            handleSize,
            handleSize
        );
        ctx.strokeRect(
            corner.x - handleSize / 2,
            corner.y - handleSize / 2,
            handleSize,
            handleSize
        );
    });

    // Draw rotation handle
    // const rotationHandleY = minY - padding - 30 / scale;
    // const centerX = (minX + maxX) / 2;

    // // Line to rotation handle
    // ctx.beginPath();
    // ctx.moveTo(centerX, minY - padding);
    // ctx.lineTo(centerX, rotationHandleY);
    // ctx.stroke();

    // // Rotation handle circle
    // ctx.beginPath();
    // ctx.arc(centerX, rotationHandleY, handleSize / 2, 0, 2 * Math.PI);
    // ctx.fillStyle = "#FFFFFF";
    // ctx.fill();
    // ctx.strokeStyle = "#4F46E5";
    // ctx.stroke();

    ctx.restore();
}
function renderPreviousShapes(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    allDrawings: Shape[],
    zoomContext: ZoomContext,
    selectedId: number | null = null
) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan transformation
    ctx.save();
    const zoom = zoomContext.getZoom();
    const pan = zoomContext.getPanOffset();

    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw all shapes
    allDrawings.forEach((shape, index) => {
        switch (shape.type) {
            case "RECTANGLE":
                repaintRect(ctx, shape);
                break;
            case "CIRCLE":
                repaintCircle(ctx, shape);
                break;
            case "LINE":
                repaintLine(ctx, shape);
                break;
            case "DIAMOND":
                repaintDiamond(ctx, shape);
                break;
            case "ARROW":
                repaintArrow(ctx, shape);
                break;
            // case "pencil":
            //     repaintPencil(ctx, shape);
            //     break;
            case "TEXT":
                repaintText(ctx, shape);
                break;
            default:
                break;
        }

        if (shape.id === selectedId) {
            drawSelectionBox(ctx, shape);
        }
    });

    ctx.restore();
}



export async function initDrawing(
    canvas: HTMLCanvasElement,
    send: (data: any) => void,
    roomId: number,
    getSelectedTool: () => ToolType,  // Changed to function
    getCurrentProperties: () => Partial<Shape>,  // Changed to function
    zoomContext: ZoomContext,
    // onShapeCreated: (id: number) => void,
    onShapeSelected: (id: number | null) => void,
    onTextEdit: (index: number, shape: Shape) => void,
    panZoomHandlers: {
        onPanStart: (isPanning: boolean) => void;
        onPanMove: (offset: { x: number; y: number }) => void;
        onZoom: (newZoom: number, newPan: { x: number; y: number }) => void;
    }
) {

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    async function getAllShapes() {
        const res = await getAllShapesInRoom(roomId);

        allDrawings = res
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



    // Convert screen coordinates to canvas coordinates (accounting for zoom/pan)
    const screenToCanvas = (screenX: number, screenY: number) => {
        const rect = canvas.getBoundingClientRect();
        const zoom = zoomContext.getZoom();
        const pan = zoomContext.getPanOffset();

        const canvasX = (screenX - rect.left - pan.x) / zoom;
        const canvasY = (screenY - rect.top - pan.y) / zoom;

        return { x: canvasX, y: canvasY };
    };


    const getShapeAtPosition = (x: number, y: number): Shape | null => {
        for (let i = allDrawings.length - 1; i >= 0; i--) {
            const shape = allDrawings[i];
            if (!shape) return null;

            if (shape.type === 'line' || shape.type === 'arrow') {
                const tolerance = 10;
                const x1 = shape.startX;
                const y1 = shape.startY;
                const x2 = shape.startX + shape.width;
                const y2 = shape.startY + shape.height;

                const A = x - x1;
                const B = y - y1;
                const C = x2 - x1;
                const D = y2 - y1;

                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                const param = lenSq !== 0 ? dot / lenSq : -1;

                let xx, yy;

                if (param < 0) {
                    xx = x1;
                    yy = y1;
                } else if (param > 1) {
                    xx = x2;
                    yy = y2;
                } else {
                    xx = x1 + param * C;
                    yy = y1 + param * D;
                }

                const dx = x - xx;
                const dy = y - yy;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < tolerance) {
                    return shape;
                }
            } // For text - check text bounds with actual stored dimensions
            else if (shape.type === 'text' && shape.text) {
                // Use stored width and height (already calculated properly)
                const textWidth = shape.width || 300;
                const textHeight = shape.height || 30;

                if (
                    x >= shape.startX &&
                    x <= shape.startX + textWidth &&
                    y >= shape.startY &&
                    y <= shape.startY + textHeight
                ) {
                    return shape;
                }
            } else if (shape.type === 'pencil') {
                // if (
                //     x >= shape.startX &&
                //     x <= shape.startX + shape.width &&
                //     y >= shape.startY &&
                //     y <= shape.startY + shape.height
                // ) {
                //     return i;
                // }
            } else {
                const minX = Math.min(shape.startX, shape.startX + shape.width);
                const maxX = Math.max(shape.startX, shape.startX + shape.width);
                const minY = Math.min(shape.startY, shape.startY + shape.height);
                const maxY = Math.max(shape.startY, shape.startY + shape.height);

                if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                    return shape;
                }
            }
        }
        return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
        const selectedTool = getSelectedTool();
        const rect = canvas.getBoundingClientRect();

        // Hand mode - panning
        if (selectedTool === "hand") {
            panning = true;
            const pan = zoomContext.getPanOffset();
            panStart = {
                x: e.clientX - pan.x,
                y: e.clientY - pan.y,
            };
            canvas.style.cursor = "grabbing";
            panZoomHandlers.onPanStart(true);
            return;
        }

        const coords = screenToCanvas(e.clientX, e.clientY);

        // Select mode
        if (selectedTool === "select") {
            const shape = getShapeAtPosition(coords.x, coords.y);
            if (!shape) return
            if (shape.id !== null) {

                if (currentlySelectedId !== shape.id) {
                    currentlySelectedId = shape.id;
                    renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, shape.id);
                }

                draggedShapeId = Number(shape.id);
                dragging = true;
                dragStartPos = coords;
                shapeStartPos = {
                    x: shape!.startX,
                    y: shape!.startY,
                };
                onShapeSelected(Number(shape.id));

            } else {
                // Clicking empty space - deselect
                onShapeSelected(null);
                renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, null);
            }
            return;
        }

        // Drawing mode
        drawing = true;
        startX = coords.x;
        startY = coords.y;

        // if (selectedTool === "pencil") {
        //     currentPoints = [{ x: coords.x, y: coords.y }];
        // }
    };

    const handleMouseMove = (e: MouseEvent) => {
        // Handle panning in hand mode
        if (panning && getSelectedTool() === "hand") {
            const newPan = {
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y,
            };
            panZoomHandlers.onPanMove(newPan);
            return;
        }

        const coords = screenToCanvas(e.clientX, e.clientY);


        // Dragging selected shape
        if (dragging && draggedShapeId !== null && getSelectedTool() === "select") {
            const dx = coords.x - dragStartPos.x;
            const dy = coords.y - dragStartPos.y;

            const shape = allDrawings.find(d => d.id == draggedShapeId)

            shape!.startX = shapeStartPos.x + dx;
            shape!.startY = shapeStartPos.y + dy;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, draggedShapeId);
            return;
        }

        if (!drawing || getSelectedTool() === "hand" || getSelectedTool() === "select") return;

        // if (getSelectedTool() === "pencil") {
        //     const lastPoint = currentPoints[currentPoints.length - 1];
        //     if (!lastPoint) return;
        //     if (!coords.x || !coords.y) return;
        //     const distance = Math.sqrt(
        //         Math.pow(coords?.x - lastPoint.x, 2) +
        //         Math.pow(coords?.y - lastPoint.y, 2)
        //     );

        //     if (distance > 2) {
        //         currentPoints.push({ x: coords.x, y: coords.y });
        //     }

        //     ctx.clearRect(0, 0, canvas.width, canvas.height);
        //     renderPreviousShapes(canvas, ctx, allDrawings, zoomContext);

        //     ctx.save();
        //     const zoom = zoomContext.getZoom();
        //     const pan = zoomContext.getPanOffset();
        //     ctx.translate(pan.x, pan.y);
        //     ctx.scale(zoom, zoom);

        //     repaintPencil(ctx, {
        //         startX: 0,
        //         startY: 0,
        //         width: 0,
        //         height: 0,
        //         type: "pencil",
        //         points: currentPoints,
        //         ...getCurrentProperties()
        //     });

        //     ctx.restore();
        //     return;
        // }

        const width = coords.x - startX;
        const height = coords.y - startY;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderPreviousShapes(canvas, ctx, allDrawings, zoomContext);

        ctx.save();
        const zoom = zoomContext.getZoom();
        const pan = zoomContext.getPanOffset();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);



        const currentShape = {
            id: -1,
            startX,
            startY,
            width,
            height,
            type: getToolTypeFromString(getSelectedTool()),
            ...getCurrentProperties()
        };

        switch (getSelectedTool()) {
            case "rect":
                repaintRect(ctx, currentShape);
                break;
            case "circle":
                repaintCircle(ctx, currentShape);
                break;
            case "line":
                repaintLine(ctx, currentShape);
                break;
            case "diamond":
                repaintDiamond(ctx, currentShape);
                break;
            case "arrow":
                repaintArrow(ctx, currentShape);
                break;
            default:
                break;
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


            const shape = allDrawings.find(d => d.id == draggedShapeId);
            if (!shape) {
                console.warn("drag end: shape not found", { draggedShapeId, coords, dragStartPos });
                draggedShapeId = null;
                return;
            }


            const newX = shapeStartPos.x + dx;
            const newY = shapeStartPos.y + dy;


            const THRESHOLD = 0.5;
            const moved = Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD;

            if (moved) {
                shape.startX = newX;
                shape.startY = newY;


                send({
                    type: "shape:update",
                    roomId,
                    shape: {
                        ...shape,
                        id: shape.id,
                        startX: newX,
                        startY: newY,

                    },
                });
            } else {

                console.debug("drag end: movement below threshold, not sending", { dx, dy });
            }

            draggedShapeId = null;
            return;
        }


        if (!drawing || selectedTool === "hand" || selectedTool === "select") return;

        drawing = false;

        // if (selectedTool === "pencil") {
        //     if (currentPoints.length > 1) {
        //         const xs = currentPoints.map((p) => p.x);
        //         const ys = currentPoints.map((p) => p.y);
        //         const minX = Math.min(...xs);
        //         const minY = Math.min(...ys);
        //         const maxX = Math.max(...xs);
        //         const maxY = Math.max(...ys);

        //         const currentProperties = getCurrentProperties();
        //         allDrawings.push({
        //             startX: minX,
        //             startY: minY,
        //             width: maxX - minX,
        //             height: maxY - minY,
        //             type: "pencil",
        //             points: currentPoints,
        //             ...currentProperties,
        //         });

        //         const newIndex = allDrawings.length - 1;
        //         onShapeCreated(newIndex);
        //     }
        //     currentPoints = [];
        //     renderPreviousShapes(canvas, ctx, allDrawings, zoomContext);
        //     return;
        // }

        const width = coords.x - startX;
        const height = coords.y - startY;

        if (Math.abs(width) > 1 || Math.abs(height) > 1) {

            send({
                type: "shape:create",
                roomId,
                shape: {
                    startX,
                    startY,
                    width,
                    height,
                    type: getToolTypeFromString(selectedTool),
                    ...getCurrentProperties(),
                }
            })

        }

    };


    const handleDoubleClick = (e: MouseEvent) => {
        const selectedTool = getSelectedTool();
        if (selectedTool !== "select") return;

        e.preventDefault();
        e.stopPropagation();

        const coords = screenToCanvas(e.clientX, e.clientY);
        const shape = getShapeAtPosition(coords.x, coords.y);
        if (!shape) return

        if (shape.id !== null) {
            onTextEdit(shape.id, shape);
        }
    };

    // Add event listeners
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("dblclick", handleDoubleClick);

    return () => {
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("dblclick", handleDoubleClick);
    };
}

export function getShape(shapeId: number): Shape | null {
    if (shapeId >= 0) {
        const shape = allDrawings.find(d => Number(d.id) === shapeId);
        if (!shape) return null;
        return shape;
    }
    return null;
}

export function getShapeByIndex(shapeIndex: number): Shape | null {
    if (shapeIndex >= 0) {
        const shape = allDrawings[shapeIndex];
        if (!shape) return null;
        return shape;
    }
    return null;
}

export function addTextShape(shape: Shape) {
    allDrawings.push(shape);
}

export function addShape(shape: Shape) {
    allDrawings.push(shape);

}

export function clearAllDrawings() {
    allDrawings = [];
}

export function getAllDrawings() {
    return [...allDrawings];
}

export function renderCanvas(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    zoomContext: ZoomContext,
    selectedIndex: number | null = null
) {
    renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, selectedIndex);
}


// Export function to update a specific shape's property
export function updateShapeProperty(shapeId: number, property: keyof Shape, value: any, send: (data: any) => void, roomId: number) {
    if (shapeId >= 0) {
        const shape = allDrawings.find(d => d.id === shapeId);
        if (!shape) return;
        if (property in shape) {

            send({
                type: "shape:update",
                roomId,
                shape: {
                    ...shape,
                    [property]: value,
                },
            });
        }
    }
}

export function updateShapeById(shape: Shape, canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    zoomContext: ZoomContext,) {
    const shapeId = shape.id;

    const shapeIndex = allDrawings.findIndex(s => s.id === shapeId);
    if (shapeIndex >= 0) {
        allDrawings.splice(shapeIndex, 1, shape);

        renderCanvas(canvas, ctx, zoomContext);
    }


}