import React from "react";
import { Shape } from "@/app/board/types";
import { StrokeControls } from "./StrokeControl";

interface PropertyPanelProps {
  properties: Partial<Shape>;
  onPropertyChange: (property: string, value: unknown) => void;
  onClose: () => void;
}

const strokeColors = [
  { name: "Black",    value: "#262626" },
  { name: "Rose",     value: "#fb7185" },
  { name: "Mint",     value: "#4ade80" },
  { name: "Sky",      value: "#38bdf8" },
  { name: "Peach",    value: "#fca5a5" },
  { name: "Lavender", value: "#a78bfa" },
  { name: "Amber",    value: "#fbbf24" },
  { name: "Slate",    value: "#94a3b8" },
];

const fillColors = [
  { name: "Transparent", value: "transparent" },
  { name: "Peach",       value: "#ffe4e6" },
  { name: "Mint",        value: "#dcfce7" },
  { name: "Sky",         value: "#e0f2fe" },
  { name: "Lavender",    value: "#ede9fe" },
  { name: "Azure",       value: "#cffafe" },
  { name: "Lilac",       value: "#f3e8ff" },
  { name: "Sand",        value: "#fef3c7" },
];

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  properties,
  onPropertyChange,
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
                  color.value === "transparent" ? "#ffffff" : color.value,
                backgroundImage:
                  color.value === "transparent"
                    ? "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 8px 8px"
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
