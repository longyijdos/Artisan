"use client";

import { useEffect, useRef, useState } from "react";

interface SlideViewerProps {
  content: string;
}

interface TextStyle {
  fontColor?: string;
  fontSize?: string;
}

interface Theme {
  headline?: TextStyle;
  "sub-headline"?: TextStyle;
  body?: TextStyle;
  caption?: TextStyle;
}

interface Shape {
  id: string;
  type: string;
  width: number;
  height: number;
  x: number;
  y: number;
  text: string;
  textType: keyof Theme;
  fontSize?: number;
  fontColor?: string;
}

interface Slide {
  id: string;
  bgColor: string;
  shapes: Shape[];
}

interface Presentation {
  width: number;
  height: number;
  slides: Slide[];
}

export function SlideViewer({ content }: SlideViewerProps) {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, "text/xml");
      const presEl = xmlDoc.getElementsByTagName("presentation")[0];
      if (!presEl) return;

      const presWidth = parseInt(presEl.getAttribute("width") || "960");
      const presHeight = parseInt(presEl.getAttribute("height") || "540");

      const themeEl = xmlDoc.getElementsByTagName("theme")[0];
      const theme: Theme = {};
      if (themeEl) {
        const textStyles = themeEl.getElementsByTagName("textStyles")[0];
        if (textStyles) {
          ["headline", "sub-headline", "body", "caption"].forEach((type) => {
            const el = textStyles.getElementsByTagName(type)[0];
            if (el) {
              theme[type as keyof Theme] = {
                fontColor: el.getAttribute("fontColor") || undefined,
                fontSize: el.getAttribute("fontSize") || undefined,
              };
            }
          });
        }
      }

      const slides: Slide[] = [];
      const slideEls = xmlDoc.getElementsByTagName("slide");
      for (let i = 0; i < slideEls.length; i++) {
        const slideEl = slideEls[i];
        const slideId = slideEl.getAttribute("id") || `slide_${i}`;
        
        let bgColor = "rgba(255, 255, 255, 1)";
        const fillEl = slideEl.getElementsByTagName("fill")[0];
        if (fillEl) {
          const solidFill = fillEl.getElementsByTagName("solidFill")[0];
          if (solidFill) {
            bgColor = solidFill.getAttribute("color") || bgColor;
          }
        }

        const shapes: Shape[] = [];
        const shapeEls = slideEl.getElementsByTagName("shape");
        for (let j = 0; j < shapeEls.length; j++) {
          const shapeEl = shapeEls[j];
          const contentEl = shapeEl.getElementsByTagName("content")[0];
          if (!contentEl) continue;

          const textType = (contentEl.getAttribute("textType") || "body") as keyof Theme;
          const themeStyle = theme[textType] || {};

          shapes.push({
            id: shapeEl.getAttribute("id") || `shape_${i}_${j}`,
            type: shapeEl.getAttribute("type") || "text",
            width: parseInt(shapeEl.getAttribute("width") || "0"),
            height: parseInt(shapeEl.getAttribute("height") || "0"),
            x: parseInt(shapeEl.getAttribute("topLeftX") || "0"),
            y: parseInt(shapeEl.getAttribute("topLeftY") || "0"),
            text: contentEl.textContent || "",
            textType,
            fontSize: parseInt(contentEl.getAttribute("fontSize") || themeStyle.fontSize || "18"),
            fontColor: contentEl.getAttribute("fontColor") || themeStyle.fontColor || "rgba(0,0,0,1)",
          });
        }

        slides.push({ id: slideId, bgColor, shapes });
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect -- parse result must be set synchronously
      setPresentation({ width: presWidth, height: presHeight, slides });
      setCurrentSlideIndex(0);
    } catch (e) {
      console.error("Failed to parse SML 2.0 XML", e);
    }
  }, [content]);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && presentation) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        const scaleX = offsetWidth / presentation.width;
        const scaleY = offsetHeight / presentation.height;
        setScale(Math.min(scaleX, scaleY) * 0.9); // 0.9 for some padding
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [presentation]);

  if (!presentation || presentation.slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Parsing presentation...
      </div>
    );
  }

  const currentSlide = presentation.slides[currentSlideIndex];

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center p-8 min-h-0" ref={containerRef}>
        <div
          className="bg-white shadow-2xl relative overflow-hidden transition-all duration-300 rounded-sm"
          style={{
            width: presentation.width,
            height: presentation.height,
            backgroundColor: currentSlide.bgColor,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            flexShrink: 0,
          }}
        >
          {currentSlide.shapes.map((shape) => (
            <div
              key={shape.id}
              className="absolute p-1"
              style={{
                left: shape.x,
                top: shape.y,
                width: shape.width,
                height: shape.height,
                color: shape.fontColor,
                fontSize: shape.fontSize,
                fontWeight: (shape.textType === "headline" || shape.textType === "sub-headline") ? "bold" : "normal",
                lineHeight: 1.4,
                whiteSpace: "pre-wrap",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
              }}
            >
              {shape.text}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div className="text-sm font-medium text-slate-500">
          幻灯片 {currentSlideIndex + 1} / {presentation.slides.length}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentSlideIndex === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
              title="上一页"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.min(presentation.slides.length - 1, prev + 1))}
              disabled={currentSlideIndex === presentation.slides.length - 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
              title="下一页"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <span 
            className="text-xs font-medium text-blue-600 uppercase tracking-wider"
          >
            SML 2.0 Preview
          </span>
        </div>
      </div>
    </div>
  );
}
