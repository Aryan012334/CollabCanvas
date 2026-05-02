import {
    Hand,
    MousePointer2,
    RectangleHorizontal,
    Diamond,
    Circle,
    MoveRight,
    Minus,
    PencilLine,
    Eraser,
    Plus,
    ZoomIn,
    ZoomOut,
    Sun,
    MoreHorizontal,
    Menu,
    Trash,
    Moon,
    Computer,
    Github,
    Twitter,
    Instagram,
    Type,
} from "lucide-react";

import { ShapeType } from "@repo/db/client";

export interface Shape {
    id: number,
    startX: number;
    startY: number;
    width: number;
    height: number;
    type: string;
    strokeWidth?: number;
    strokeColor?: string;
    fillColor?: string;
    strokeStyle?: "solid" | "dotted" | "dashed";
    fillStyle?: "solid" | "hachure" | "cross-hatch";
    points?: { x: number; y: number }[];
    text?: string;
    fontSize?: number;
}

export interface ZoomContext {
    getZoom: () => number;
    getPanOffset: () => { x: number; y: number };
}



export type ToolType = "hand" | "select" | "rect" | "diamond" | "circle" | "arrow" | "line" | "eraser" | "text";



//make tooltype to enum converter 
export function getToolTypeFromString(toolType: string): ShapeType {
    switch (toolType) {
        case "rect":
            return ShapeType.RECTANGLE;
        case "circle":
            return ShapeType.CIRCLE;
        case "line":
            return ShapeType.LINE;
        case "diamond":
            return ShapeType.DIAMOND;
        case "arrow":
            return ShapeType.ARROW;
        case "text":
            return ShapeType.TEXT;
        default:
            return ShapeType.RECTANGLE;
    }
}

export const tools = [
    { id: "hand", icon: Hand, label: "Hand" },
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "rect", icon: RectangleHorizontal, label: "Rectangle" },
    { id: "diamond", icon: Diamond, label: "Diamond" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "arrow", icon: MoveRight, label: "Arrow" },
    { id: "line", icon: Minus, label: "Line" },
    // { id: "pencil", icon: PencilLine, label: "Pencil" },
    { id: "text", icon: Type, label: "Text" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
];




export const pastelColors = [
    { name: "Default", value: "#f5f5f5", class: "bg-gray-100" },
    { name: "Peach", value: "#ffedd5", class: "bg-orange-100" },
    { name: "Mint", value: "#dcfce7", class: "bg-green-100" },
    { name: "Lavender", value: "#ede9fe", class: "bg-violet-100" },
    { name: "Sky", value: "#e0f2fe", class: "bg-sky-100" },
    { name: "Cream", value: "#fef9c3", class: "bg-yellow-100" },
    { name: "Rose", value: "#ffe4e6", class: "bg-rose-100" },
    { name: "Azure", value: "#cffafe", class: "bg-cyan-100" },
    { name: "Lilac", value: "#f3e8ff", class: "bg-purple-100" },
    { name: "Moss", value: "#f0fdf4", class: "bg-lime-100" },
    { name: "Charcoal", value: "#1e1e1e", class: "bg-neutral-900" },
    { name: "Light Charcoal", value: "#525252", class: "bg-neutral-600" },
    { name: "Deep Teal", value: "#0f3d3e", class: "bg-teal-900" },
    { name: "Midnight Blue", value: "#1e3a5f", class: "bg-blue-900" },
    { name: "Moss Green", value: "#1b3a2e", class: "bg-emerald-900" },
];