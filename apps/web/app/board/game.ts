import { getToolTypeFromString, Shape, ToolType, ZoomContext } from "./types";
import { repaintRect, repaintCircle, repaintLine, repaintDiamond, repaintArrow, repaintPencil, repaintText } from "./repaint";
import { getAllShapesInRoom } from "@/actions/action";
import { v4 as uuidv4 } from "uuid";

export let allDrawings: Shape[] = [];
let currentPoints: { x: number; y: number }[] = [];


function drawSelectionBox(ctx: CanvasRenderingContext2D, shape: Shape) {
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
    selectedIndex: number | null = null
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

        if (index === selectedIndex) {
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
    onShapeCreated: (index: number) => void,
    onShapeSelected: (index: number | null) => void,
    onTextEdit: (index: number, shape: Shape) => void,
    panZoomHandlers: {
        onPanStart: (isPanning: boolean) => void;
        onPanMove: (offset: { x: number; y: number }) => void;
        onZoom: (newZoom: number, newPan: { x: number; y: number }) => void;
    }
) {

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    //get all shapes in the room
    async function getAllShapes() {
        const res = await getAllShapesInRoom(roomId);

        console.log("first", res)
        allDrawings = res
        console.log("allDrawings", allDrawings)
        if (!ctx || !canvas) return;
        renderPreviousShapes(canvas, ctx, allDrawings, zoomContext);
        send({
            type: "join-room",
            roomId
        })
    }

    await getAllShapes();

    //get all shapes in the room 

    let drawing = false;
    let dragging = false;
    let panning = false;
    let draggedShapeIndex: number | null = null;
    let dragStartPos = { x: 0, y: 0 };
    let shapeStartPos = { x: 0, y: 0 };
    let panStart = { x: 0, y: 0 };
    let startX = 0;
    let startY = 0;



    // Convert screen coordinates to canvas coordinates (accounting for zoom/pan)
    const screenToCanvas = (screenX: number, screenY: number) => {
        const rect = canvas.getBoundingClientRect();
        const zoom = zoomContext.getZoom();
        const pan = zoomContext.getPanOffset();

        const canvasX = (screenX - rect.left - pan.x) / zoom;
        const canvasY = (screenY - rect.top - pan.y) / zoom;

        return { x: canvasX, y: canvasY };
    };


    // In game.ts - replace getShapeAtPosition
    const getShapeAtPosition = (x: number, y: number): number | null => {
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
                    return i;
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
                    return i;
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
                    return i;
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
            const shapeIndex = getShapeAtPosition(coords.x, coords.y);

            if (shapeIndex !== null) {
                draggedShapeIndex = shapeIndex;
                dragging = true;
                dragStartPos = coords;
                shapeStartPos = {
                    x: allDrawings[shapeIndex]!.startX,
                    y: allDrawings[shapeIndex]!.startY,
                };
                onShapeSelected(shapeIndex);
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
        if (dragging && draggedShapeIndex !== null && getSelectedTool() === "select") {
            const dx = coords.x - dragStartPos.x;
            const dy = coords.y - dragStartPos.y;

            allDrawings[draggedShapeIndex]!.startX = shapeStartPos.x + dx;
            allDrawings[draggedShapeIndex]!.startY = shapeStartPos.y + dy;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, draggedShapeIndex);
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
            id: uuidv4(),
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

        // End panning
        if (panning) {
            panning = false;
            canvas.style.cursor = "grab";
            panZoomHandlers.onPanStart(false);
            return;
        }

        // End dragging - DON'T clear draggedShapeIndex yet
        if (dragging) {
            dragging = false;
            // Keep the shape selected - don't set draggedShapeIndex to null here
            renderPreviousShapes(canvas, ctx, allDrawings, zoomContext, draggedShapeIndex);
            draggedShapeIndex = null; // Clear after rendering
            return;
        }

        if (!drawing || selectedTool === "hand" || selectedTool === "select") return;

        drawing = false;
        const coords = screenToCanvas(e.clientX, e.clientY);

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
            const currentProperties = getCurrentProperties();
            // allDrawings.push({
            //     startX,
            //     startY,
            //     width,
            //     height,
            //     type: getToolTypeFromString(selectedTool),
            //     ...currentProperties,
            // });
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

            // renderPreviousShapes(canvas, ctx, allDrawings, zoomContext);

            const newIndex = allDrawings.length - 1;
            onShapeCreated(newIndex);
        }

        //update the shapes in backend
    };


    const handleDoubleClick = (e: MouseEvent) => {
        const selectedTool = getSelectedTool();
        if (selectedTool !== "select") return;

        e.preventDefault();
        e.stopPropagation();

        const coords = screenToCanvas(e.clientX, e.clientY);
        const shapeIndex = getShapeAtPosition(coords.x, coords.y);

        if (shapeIndex !== null && allDrawings[shapeIndex]!.type === "text") {
            onTextEdit(shapeIndex, allDrawings[shapeIndex]!);
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

export function getShape(shapeIndex: number): Shape | null {
    if (shapeIndex >= 0 && shapeIndex < allDrawings.length) {
        return allDrawings[shapeIndex]!;
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
export function updateShapeProperty(shapeIndex: number, property: keyof Shape, value: any, send: (data: any) => void, roomId: number) {
    if (shapeIndex >= 0 && shapeIndex < allDrawings.length) {
        const shape = { ...allDrawings[shapeIndex] };
        if (property in shape) {
            // Assuming that 'Shape' defines all optional properties as non-optional
            shape[property] = value;
            allDrawings[shapeIndex] = shape as Shape; // Cast the updated shape back to Shape type
        }
    }
}
