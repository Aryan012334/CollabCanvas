import { Shape } from "@/app/board/types";
import React, { useEffect } from "react";

/**
 * TextOnCanvas
 *
 * An absolutely-positioned textarea overlay that appears on top of the canvas
 * exactly where the user clicked. The font, size, letter-spacing, line-height,
 * and color must match repaintText() in repaint.ts so there is no visual jump
 * when the textarea is replaced by the rendered canvas text.
 *
 * Position: `textPosition.screen` is the raw screen pixel coordinate of the
 * click (clientX - canvasRect.left, clientY - canvasRect.top). We do NOT add
 * any additional offsets here — the textarea top-left should be exactly at
 * the click point, which is where repaintText() will draw.
 */
const TextOnCanvas = ({
  textPosition,
  currentText,
  currentProperties,
  setCurrentText,
  textInputRef,
  handleAddText,
  setIsEditingText,
  zoom,
}: {
  textPosition: {
    screen: { x: number; y: number };
    canvas: { x: number; y: number };
  };
  currentText: string;
  currentProperties: Partial<Shape>;
  setCurrentText: React.Dispatch<React.SetStateAction<string>>;
  textInputRef: React.RefObject<HTMLTextAreaElement>;
  handleAddText: (x: number, y: number, text: string) => void;
  setIsEditingText: React.Dispatch<React.SetStateAction<boolean>>;
  isEditingText: boolean;
  zoom: number;
}) => {
  // Font size displayed in the textarea must match what repaintText() will draw.
  // repaintText uses shape.fontSize which handleAddText sets to Math.round(20 / zoom).
  // We apply the same value here (in screen pixels, so multiply by zoom to undo the
  // canvas-space normalisation and get back to screen pixels).
  const displayFontSize = Math.round(20); // 20px at 100% zoom in screen space

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = textInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, displayFontSize * 1.4) + "px";
    el.style.width = "auto";
    el.style.width = Math.max(120, el.scrollWidth + 4) + "px";
  }, [currentText, textInputRef, displayFontSize]);

  const commit = () => {
    if (currentText.trim()) {
      handleAddText(textPosition.canvas.x, textPosition.canvas.y, currentText);
    }
    setIsEditingText(false);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${textPosition.screen.x}px`,
        top:  `${textPosition.screen.y}px`,
        zIndex: 100,
        // Scale the whole overlay by the current zoom so the textarea sits at
        // the same visual size as the canvas text will appear
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
      }}
    >
      <textarea
        ref={textInputRef}
        value={currentText}
        placeholder="Type here…"
        onChange={(e) => {
          setCurrentText(e.target.value);
          // Resize is handled by the useEffect above
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          // Escape — cancel without saving
          if (e.key === "Escape") {
            e.preventDefault();
            setCurrentText("");
            setIsEditingText(false);
            return;
          }
          // Ctrl/Cmd+Enter — commit
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commit();
            return;
          }
          // Prevent canvas keyboard shortcuts (Delete, Backspace, etc.)
          // from firing while the user is typing
          e.stopPropagation();
        }}
        style={{
          // Must exactly match repaintText() in repaint.ts
          fontFamily:    "Virgil, cursive",
          fontSize:      `${displayFontSize}px`,
          lineHeight:    1.4,
          letterSpacing: "3px",
          color: currentProperties.strokeColor || "#000000",

          // Layout
          padding:    "0",
          margin:     "0",
          border:     "none",
          outline:    "none",
          resize:     "none",
          background: "transparent",
          overflow:   "hidden",
          whiteSpace: "pre",

          // Minimum usable size
          minWidth:  "4px",
          minHeight: `${displayFontSize * 1.4}px`,

          // Caret visible against any background
          caretColor: currentProperties.strokeColor || "#000000",
        }}
        className="dark:caret-white"
        rows={1}
        autoFocus
        spellCheck={false}
      />
      {/* Subtle underline so the user can see the edit area */}
      <div
        style={{
          position:  "absolute",
          bottom:    -2,
          left:      0,
          right:     0,
          height:    2,
          background: currentProperties.strokeColor || "#000000",
          opacity:   0.3,
          borderRadius: 1,
        }}
      />
    </div>
  );
};

export default TextOnCanvas;
