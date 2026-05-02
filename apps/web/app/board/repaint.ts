import { Shape } from "./types";

export function repaintRect(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();
    ctx.beginPath();

    ctx.strokeStyle = shape.strokeColor || "#000000";
    ctx.fillStyle = shape.fillColor || "transparent";

    const transform = ctx.getTransform();
    const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
    ctx.lineWidth = (shape.strokeWidth || 2) / scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Apply stroke style
    if (shape.strokeStyle === 'dashed') {
        ctx.setLineDash([10 / scale, 5 / scale]);
    } else if (shape.strokeStyle === 'dotted') {
        ctx.setLineDash([2 / scale, 4 / scale]);
    } else {
        ctx.setLineDash([]);
    }

    const x = shape.startX;
    const y = shape.startY;
    const w = shape.width;
    const h = shape.height;
    const radius = Math.min(Math.abs(w), Math.abs(h)) * 0.05;

    // Draw rounded rectangle
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();

    // Fill if color is set
    if (shape.fillColor && shape.fillColor !== 'transparent') {
        // Apply fill style
        if (shape.fillStyle === 'hachure') {
            // Draw hachure pattern
            ctx.save();
            ctx.clip();
            const spacing = 5;
            for (let i = x - h; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y);
                ctx.lineTo(i + h, y + h);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            ctx.restore();
        } else if (shape.fillStyle === 'cross-hatch') {
            // Draw cross-hatch pattern
            ctx.save();
            ctx.clip();
            const spacing = 5;
            for (let i = x - h; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y);
                ctx.lineTo(i + h, y + h);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            for (let i = x; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y + h);
                ctx.lineTo(i - h, y);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            ctx.restore();
        } else {
            // Solid fill
            ctx.fill();
        }
    }

    ctx.stroke();
    ctx.restore();
}

export function repaintCircle(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();
    ctx.beginPath();

    ctx.strokeStyle = shape.strokeColor || "#000000";
    ctx.fillStyle = shape.fillColor || "transparent";

    const transform = ctx.getTransform();
    const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
    ctx.lineWidth = (shape.strokeWidth || 2) / scale;
    ctx.lineCap = "round";

    // Apply stroke style
    if (shape.strokeStyle === 'dashed') {
        ctx.setLineDash([10 / scale, 5 / scale]);
    } else if (shape.strokeStyle === 'dotted') {
        ctx.setLineDash([2 / scale, 4 / scale]);
    } else {
        ctx.setLineDash([]);
    }

    const centerX = shape.startX + shape.width / 2;
    const centerY = shape.startY + shape.height / 2;
    const radiusX = Math.abs(shape.width / 2);
    const radiusY = Math.abs(shape.height / 2);

    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

    // Fill if color is set
    if (shape.fillColor && shape.fillColor !== 'transparent') {
        if (shape.fillStyle === 'hachure') {
            ctx.save();
            ctx.clip();
            const spacing = 5;
            const x = shape.startX;
            const y = shape.startY;
            const w = shape.width;
            const h = shape.height;
            for (let i = x - h; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y);
                ctx.lineTo(i + h, y + h);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            ctx.restore();
        } else if (shape.fillStyle === 'cross-hatch') {
            ctx.save();
            ctx.clip();
            const spacing = 5;
            const x = shape.startX;
            const y = shape.startY;
            const w = shape.width;
            const h = shape.height;
            for (let i = x - h; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y);
                ctx.lineTo(i + h, y + h);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            for (let i = x; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y + h);
                ctx.lineTo(i - h, y);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            ctx.restore();
        } else {
            ctx.fill();
        }
    }

    ctx.stroke();
    ctx.restore();
}

export function repaintLine(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();
    ctx.beginPath();

    ctx.strokeStyle = shape.strokeColor || "#000000";

    const transform = ctx.getTransform();
    const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
    ctx.lineWidth = (shape.strokeWidth || 2) / scale;
    ctx.lineCap = "round";

    // Apply stroke style
    if (shape.strokeStyle === 'dashed') {
        ctx.setLineDash([10 / scale, 5 / scale]);
    } else if (shape.strokeStyle === 'dotted') {
        ctx.setLineDash([2 / scale, 4 / scale]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.moveTo(shape.startX, shape.startY);
    ctx.lineTo(shape.startX + shape.width, shape.startY + shape.height);
    ctx.stroke();
    ctx.restore();
}

export function repaintDiamond(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();
    ctx.beginPath();

    ctx.strokeStyle = shape.strokeColor || "#000000";
    ctx.fillStyle = shape.fillColor || "transparent";

    const transform = ctx.getTransform();
    const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
    ctx.lineWidth = (shape.strokeWidth || 2) / scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Apply stroke style
    if (shape.strokeStyle === 'dashed') {
        ctx.setLineDash([10 / scale, 5 / scale]);
    } else if (shape.strokeStyle === 'dotted') {
        ctx.setLineDash([2 / scale, 4 / scale]);
    } else {
        ctx.setLineDash([]);
    }

    const x = shape.startX;
    const y = shape.startY;
    const w = shape.width;
    const h = shape.height;
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const radius = Math.min(Math.abs(w), Math.abs(h)) * 0.03;

    const topX = centerX;
    const topY = y;
    const rightX = x + w;
    const rightY = centerY;
    const bottomX = centerX;
    const bottomY = y + h;
    const leftX = x;
    const leftY = centerY;

    // Draw diamond with rounded corners
    ctx.moveTo(topX, topY + radius);
    ctx.arcTo(topX, topY, topX + radius, topY, radius);
    ctx.lineTo(rightX - radius, rightY - radius);
    ctx.arcTo(rightX, rightY, rightX, rightY + radius, radius);
    ctx.lineTo(bottomX + radius, bottomY - radius);
    ctx.arcTo(bottomX, bottomY, bottomX - radius, bottomY, radius);
    ctx.lineTo(leftX + radius, leftY + radius);
    ctx.arcTo(leftX, leftY, leftX, leftY - radius, radius);
    ctx.lineTo(topX - radius, topY + radius);
    ctx.arcTo(topX, topY, topX + radius, topY, radius);
    ctx.closePath();

    // Fill if color is set
    if (shape.fillColor && shape.fillColor !== 'transparent') {
        if (shape.fillStyle === 'hachure') {
            ctx.save();
            ctx.clip();
            const spacing = 5;
            for (let i = x - h; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y);
                ctx.lineTo(i + h, y + h);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            ctx.restore();
        } else if (shape.fillStyle === 'cross-hatch') {
            ctx.save();
            ctx.clip();
            const spacing = 5;
            for (let i = x - h; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y);
                ctx.lineTo(i + h, y + h);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            for (let i = x; i < x + w + h; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, y + h);
                ctx.lineTo(i - h, y);
                ctx.strokeStyle = shape.fillColor;
                ctx.stroke();
            }
            ctx.restore();
        } else {
            ctx.fill();
        }
    }

    ctx.stroke();
    ctx.restore();
}

export function repaintArrow(ctx: CanvasRenderingContext2D, shape: Shape) {
    ctx.save();

    ctx.strokeStyle = shape.strokeColor || "#000000";
    ctx.fillStyle = shape.strokeColor || "#000000";

    const transform = ctx.getTransform();
    const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
    ctx.lineWidth = (shape.strokeWidth || 2) / scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Apply stroke style
    if (shape.strokeStyle === "dashed") {
        ctx.setLineDash([10 / scale, 5 / scale]);
    } else if (shape.strokeStyle === "dotted") {
        ctx.setLineDash([2 / scale, 4 / scale]);
    } else {
        ctx.setLineDash([]);
    }

    const startX = shape.startX;
    const startY = shape.startY;
    const endX = shape.startX + shape.width;
    const endY = shape.startY + shape.height;
    const angle = Math.atan2(shape.height, shape.width);
    const arrowLength = Math.sqrt(shape.width ** 2 + shape.height ** 2);

    // --- HEAD SIZE FIX START ---
    const baseHeadLength = Math.max(10, Math.min(30, arrowLength * 0.15));

    // Clamp scale so arrowhead never becomes ridiculously small when zoomed out
    // (below 1x zoom, treat scale as if it's at least 0.8 visually)
    const visualScale = Math.max(scale, 0.8);

    // headLength grows when zoomed in, shrinks when zoomed out — but never too small
    const headLength = baseHeadLength * visualScale;
    // --- HEAD SIZE FIX END ---

    // Draw main line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    const arrowPoint1X = endX - headLength * Math.cos(angle - Math.PI / 7);
    const arrowPoint1Y = endY - headLength * Math.sin(angle - Math.PI / 7);
    const arrowPoint2X = endX - headLength * Math.cos(angle + Math.PI / 7);
    const arrowPoint2Y = endY - headLength * Math.sin(angle + Math.PI / 7);

    ctx.moveTo(endX, endY);
    ctx.lineTo(arrowPoint1X, arrowPoint1Y);
    ctx.lineTo(arrowPoint2X, arrowPoint2Y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}




export function repaintPencil(ctx: CanvasRenderingContext2D, shape: Shape) {
    if (!shape.points || shape.points.length < 2) return;

    ctx.save();
    ctx.beginPath();

    ctx.strokeStyle = shape.strokeColor || "#000000";

    const transform = ctx.getTransform();
    const scale = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
    ctx.lineWidth = (shape.strokeWidth || 2) / scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Apply stroke style
    if (shape.strokeStyle === 'dashed') {
        ctx.setLineDash([10 / scale, 5 / scale]);
    } else if (shape.strokeStyle === 'dotted') {
        ctx.setLineDash([2 / scale, 4 / scale]);
    } else {
        ctx.setLineDash([]);
    }

    //@ts-ignore
    ctx.moveTo(shape.points[0].x, shape.points[0].y);

    for (let i = 1; i < shape.points.length - 1; i++) {
        //@ts-ignore
        const xc = (shape.points[i].x + shape.points[i + 1].x) / 2;
        //@ts-ignore
        const yc = (shape.points[i].y + shape.points[i + 1].y) / 2;
        //@ts-ignore
        ctx.quadraticCurveTo(shape.points[i].x, shape.points[i].y, xc, yc);
    }

    if (shape.points.length > 1) {
        const lastIdx = shape.points.length - 1;
        //@ts-ignore
        ctx.lineTo(shape.points[lastIdx].x, shape.points[lastIdx].y);
    }

    ctx.stroke();
    ctx.restore();
}

export function repaintText(ctx: CanvasRenderingContext2D, shape: Shape) {
    if (!shape.text) return;
    ctx.save();
    ctx.fillStyle = shape.strokeColor || "#000000";

    const fontSize = shape.fontSize || 20;
    ctx.font = `${fontSize}px Virgil, cursive`;
    ctx.letterSpacing = "3px";
    ctx.textBaseline = "top";

    const lines = shape.text.split('\n');
    const lineHeight = fontSize * 1.4;

    lines.forEach((line, index) => {
        ctx.fillText(line, shape.startX, shape.startY + (index * lineHeight));
    });

    ctx.restore();
}