import React from "react";

import { Shape } from "@/app/board/types";
import { StrokeControls } from "./StrokeControl";

interface PropertyPanelProps {
  properties: Partial<Shape>;
  onPropertyChange: (property: string, value: any) => void;
  onClose: () => void;
}

const strokeColors = [
  { name: "Black", value: "#262626" }, // neutral-800
  { name: "Rose", value: "#fb7185" }, // rose-400
  { name: "Mint", value: "#4ade80" }, // green-400
  { name: "Sky", value: "#38bdf8" }, // sky-400
  { name: "Peach", value: "#fca5a5" }, // red-300 / light coral
  { name: "Lavender", value: "#a78bfa" }, // violet-400
  { name: "Amber", value: "#fbbf24" }, // amber-400
  { name: "Slate", value: "#94a3b8" }, // slate-400
];

const fillColors = [
  { name: "Transparent", value: "transparent" },
  { name: "Peach", value: "#ffe4e6" }, // rose-100
  { name: "Mint", value: "#dcfce7" }, // green-100
  { name: "Sky", value: "#e0f2fe" }, // sky-100
  { name: "Lavender", value: "#ede9fe" }, // violet-100

  { name: "Azure", value: "#cffafe" }, // cyan-100
  { name: "Lilac", value: "#f3e8ff" }, // purple-100
  { name: "Sand", value: "#fef3c7" }, // amber-100
];

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  properties,
  onPropertyChange,
  onClose,
}) => {
  return (
    <div className='fixed left-6 top-1/2 -translate-y-1/2 z-50 w-68 rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-lg px-6 py-8 max-h-[calc(100vh-100px)] overflow-y-auto'>
      {/* Stroke Color */}
      <div className='mb-6'>
        <h3 className='text-sm font-medium mb-3'>Stroke</h3>
        <div className='flex gap-4 flex-wrap'>
          {strokeColors.map((color) => (
            <button
              key={color.value}
              onClick={() => onPropertyChange("strokeColor", color.value)}
              className={`w-10 h-10 rounded-lg transition-all hover:scale-105 ${
                properties.strokeColor === color.value
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border-2 border-border"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Fill Color */}
      <div className='mb-6'>
        <h3 className='text-sm font-medium mb-3'>Background</h3>
        <div className='flex gap-4 flex-wrap'>
          {fillColors.map((color) => (
            <button
              key={color.value}
              onClick={() => onPropertyChange("fillColor", color.value)}
              className={`w-10 h-10 rounded-lg transition-all hover:scale-105 ${
                properties.fillColor === color.value
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border-2 border-border"
              }`}
              style={{
                backgroundColor:
                  color.value === "transparent" ? "#AARRGGBB" : color.value,
                backgroundImage:
                  color.value === "transparent"
                    ? "repeating-conic-gradient(#AARRGGBB 0% 25%, transparent 0% 50%) 50% / 8px 8px"
                    : "none",
              }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <StrokeControls
        properties={properties}
        onPropertyChange={onPropertyChange}
      />
    </div>
  );
};

export default PropertyPanel;
