import { Shape } from "@/app/board/types";
import React from "react";

const TextOnCanvas = ({
  textPosition,
  currentText,
  currentProperties,
  setCurrentText,
  textInputRef,
  handleAddText,
  setIsEditingText,
  isEditingText,
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
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: `${textPosition.screen.x}px`,
        top: `${textPosition.screen.y}px`,
        zIndex: 100,
      }}>
      <div
        style={{
          border: "2px solid rgba(99, 102, 241, 0.5)",
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "4px",
          padding: "2px",
        }}>
        <textarea
          ref={textInputRef}
          value={currentText}
          placeholder='Type here...'
          onChange={(e) => {
            setCurrentText(e.target.value);
            if (textInputRef.current) {
              textInputRef.current.style.height = "auto";
              textInputRef.current.style.height =
                textInputRef.current.scrollHeight + "px";
            }
          }}
          onBlur={() => {
            if (currentText.trim()) {
              handleAddText(
                textPosition.canvas.x,
                textPosition.canvas.y,
                currentText
              );
            }
            setIsEditingText(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsEditingText(false);
              setCurrentText("");
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              if (currentText.trim()) {
                handleAddText(
                  textPosition.canvas.x,
                  textPosition.canvas.y,
                  currentText
                );
              }
              setIsEditingText(false);
            }
          }}
          //hide scrollbar
          style={{
            fontFamily: "Virgil, cursive",
            letterSpacing: "3px",
            fontSize: "20px",
            lineHeight: 1.4,
            padding: "4px",
            minWidth: "400px",
            maxHeight: "400px",
            width: "auto",
            border: "none",
            outline: "none",
            resize: "none",
            overflowY: "scroll",
            overflowX: "hidden",
            scrollbarWidth: "none",

            color: currentProperties.strokeColor || "#000000",
          }}
          className='dark:bg-transparent bg-transparent '
          rows={1}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default TextOnCanvas;
