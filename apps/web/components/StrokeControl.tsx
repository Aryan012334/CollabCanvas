"use client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Shape } from "@/app/board/types";

export function StrokeControls({
  properties,
  onPropertyChange,
}: {
  properties: Partial<Shape>;
  onPropertyChange: (property: string, value: any) => void;
}) {
  const strokeWidths = [1, 2, 4];
  const strokeStyles = ["solid", "dashed", "dotted"];

  return (
    <div className='space-y-8'>
      {/* Stroke Width */}
      <div>
        <h3 className='text-sm font-medium mb-3 text-foreground/80'>
          Stroke Width
        </h3>
        <div className='flex gap-3'>
          {strokeWidths.map((width) => {
            const selected = properties.strokeWidth === width;
            return (
              <button
                key={width}
                onClick={() => onPropertyChange("strokeWidth", width)}
                className={cn(
                  "relative flex-1 h-12 rounded-xl border transition-all duration-300 overflow-hidden",
                  "flex items-center justify-center group",
                  selected
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                    : "bg-secondary border-border hover:bg-accent hover:border-accent-foreground/40"
                )}>
                {/* Animated Indicator */}
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      layoutId='strokeWidthGlow'
                      className='absolute inset-0 rounded-xl bg-primary/20'
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Stroke Preview */}
                <motion.div
                  layout
                  className='bg-current rounded-full'
                  style={{
                    width: "32px",
                    height: `${width * 2}px`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Stroke Style */}
      <div>
        <h3 className='text-sm font-medium mb-3 text-foreground/80'>
          Stroke Style
        </h3>
        <div className='flex gap-3'>
          {strokeStyles.map((style) => {
            const selected = properties.strokeStyle === style;
            return (
              <button
                key={style}
                onClick={() => onPropertyChange("strokeStyle", style)}
                className={cn(
                  "relative flex-1 h-10 rounded-xl border transition-all duration-300 overflow-hidden",
                  "flex items-center justify-center group",
                  selected
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                    : "bg-secondary border-border hover:bg-accent hover:border-accent-foreground/40"
                )}>
                {/* Animated Background */}
                <AnimatePresence>
                  {selected && (
                    <motion.span
                      layoutId='strokeStyleGlow'
                      className='absolute inset-0 rounded-xl bg-primary/20'
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Style Preview */}
                <svg width='40' height='3' className='relative z-10'>
                  <line
                    x1='0'
                    y1='1.5'
                    x2='40'
                    y2='1.5'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeDasharray={
                      style === "dashed"
                        ? "6 4"
                        : style === "dotted"
                          ? "2 3"
                          : "0"
                    }
                    strokeLinecap='round'
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
