import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/src/lib/utils";
import { Brush, Eraser, Highlighter, PenLine, Pencil, RotateCcw, Trash2 } from "lucide-react";

type SketchTool = "pencil" | "ink" | "marker" | "charcoal" | "eraser";
type SketchBackgroundTheme = "plain" | "paper" | "graph" | "notebook" | "crosshatch" | "blueprint" | "charcoal";

interface DrawingData {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  size: number;
  tool?: SketchTool;
  isEraser?: boolean; // Backward-compat for older payloads
}

const CANVAS_THEME_STORAGE_KEY = "sketchguess.canvasBackgroundTheme";
const SKETCH_BACKGROUND_THEMES: Array<{ id: SketchBackgroundTheme; label: string }> = [
  { id: "plain", label: "Plain" },
  { id: "paper", label: "Paper" },
  { id: "graph", label: "Graph" },
  { id: "notebook", label: "Notebook" },
  { id: "crosshatch", label: "Crosshatch" },
  { id: "blueprint", label: "Blueprint" },
  { id: "charcoal", label: "Charcoal" },
];

function isSketchBackgroundTheme(value: string): value is SketchBackgroundTheme {
  return SKETCH_BACKGROUND_THEMES.some((t) => t.id === value);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSegment(prevX: number, prevY: number, x: number, y: number) {
  // Quantize so tiny float differences don't affect the result.
  const q = (v: number) => Math.round(v * 10);
  let h = 2166136261;
  const ints = [q(prevX), q(prevY), q(x), q(y)];
  for (const n of ints) {
    h ^= n;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function strokeLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function renderSegment(ctx: CanvasRenderingContext2D, data: DrawingData) {
  const tool: SketchTool = data.tool ?? (data.isEraser ? "eraser" : "pencil");

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.lineWidth = data.size;
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    strokeLine(ctx, data.prevX, data.prevY, data.x, data.y);
    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = data.color;

  const dx = data.x - data.prevX;
  const dy = data.y - data.prevY;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const rand = mulberry32(hashSegment(data.prevX, data.prevY, data.x, data.y));

  switch (tool) {
    case "ink": {
      ctx.globalAlpha = 1;
      ctx.lineWidth = data.size;
      strokeLine(ctx, data.prevX, data.prevY, data.x, data.y);
      break;
    }
    case "marker": {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = data.size * 1.4;
      ctx.lineCap = "square";
      strokeLine(ctx, data.prevX, data.prevY, data.x, data.y);
      break;
    }
    case "charcoal": {
      // Rough, textured look via multiple soft passes with deterministic offsets.
      const passes = 5;
      for (let i = 0; i < passes; i++) {
        const ox = (rand() - 0.5) * data.size * 0.9;
        const oy = (rand() - 0.5) * data.size * 0.9;
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = data.size * 2.1;
        strokeLine(ctx, data.prevX + ox, data.prevY + oy, data.x + ox, data.y + oy);
      }
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = data.size * 1.2;
      strokeLine(ctx, data.prevX, data.prevY, data.x, data.y);
      break;
    }
    case "pencil":
    default: {
      // Slight wobble + double-pass to mimic graphite texture.
      const jitter = (rand() - 0.5) * data.size * 0.6;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = data.size * 1.15;
      strokeLine(
        ctx,
        data.prevX + perpX * jitter,
        data.prevY + perpY * jitter,
        data.x + perpX * jitter,
        data.y + perpY * jitter
      );
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = data.size * 0.95;
      strokeLine(ctx, data.prevX, data.prevY, data.x, data.y);
      break;
    }
  }

  ctx.restore();
}

interface CanvasProps {
  isDrawer: boolean;
  onDraw: (data: any) => void;
  onClear: () => void;
  roomCode: string;
  socket: any;
}

export default function Canvas({ isDrawer, onDraw, onClear, roomCode, socket }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<SketchTool>("pencil");
  const [backgroundTheme, setBackgroundTheme] = useState<SketchBackgroundTheme>(() => {
    if (typeof window === "undefined") return "paper";
    const saved = window.localStorage.getItem(CANVAS_THEME_STORAGE_KEY);
    if (saved && isSketchBackgroundTheme(saved)) return saved;
    return "paper";
  });
  const lastX = useRef<number | null>(null);
  const lastY = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CANVAS_THEME_STORAGE_KEY, backgroundTheme);
  }, [backgroundTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle incoming drawing data
    const handleDrawUpdate = (data: any) => {
      renderSegment(ctx, data as DrawingData);
    };

    const handleCanvasCleared = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("draw-update", handleDrawUpdate);
    socket.on("canvas-cleared", handleCanvasCleared);

    return () => {
      socket.off("draw-update", handleDrawUpdate);
      socket.off("canvas-cleared", handleCanvasCleared);
    };
  }, [socket]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    
    // Set initial coordinates
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      lastX.current = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      lastY.current = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    } else {
      lastX.current = (e.clientX - rect.left) * (canvas.width / rect.width);
      lastY.current = (e.clientY - rect.top) * (canvas.height / rect.height);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ("touches" in e) {
      x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    } else {
      x = (e.clientX - rect.left) * (canvas.width / rect.width);
      y = (e.clientY - rect.top) * (canvas.height / rect.height);
    }

    if (lastX.current !== null && lastY.current !== null) {
      const payload: DrawingData = {
        x,
        y,
        prevX: lastX.current,
        prevY: lastY.current,
        color,
        size: brushSize,
        tool,
        isEraser: tool === "eraser",
      };

      renderSegment(ctx, payload);

      onDraw(payload);
    }

    lastX.current = x;
    lastY.current = y;
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    lastX.current = null;
    lastY.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div
        className={cn(
          "relative flex-1 rounded-xl shadow-inner border-2 overflow-hidden cursor-crosshair",
          `sketch-bg-${backgroundTheme}`,
          backgroundTheme === "blueprint" || backgroundTheme === "charcoal" ? "border-slate-700" : "border-slate-200"
        )}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-full touch-none"
          onMouseDown={startDrawing}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={startDrawing}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
        {!isDrawer && (
          <div className="absolute inset-0 bg-transparent pointer-events-none" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {isDrawer ? (
            <>
              <button
                onClick={() => setTool("pencil")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  tool === "pencil" ? "bg-indigo-600 text-white" : "hover:bg-slate-200 text-slate-600"
                )}
                title="Pencil"
              >
                <Pencil size={20} />
              </button>
              <button
                onClick={() => setTool("ink")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  tool === "ink" ? "bg-indigo-600 text-white" : "hover:bg-slate-200 text-slate-600"
                )}
                title="Ink"
              >
                <PenLine size={20} />
              </button>
              <button
                onClick={() => setTool("marker")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  tool === "marker" ? "bg-indigo-600 text-white" : "hover:bg-slate-200 text-slate-600"
                )}
                title="Marker"
              >
                <Highlighter size={20} />
              </button>
              <button
                onClick={() => setTool("charcoal")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  tool === "charcoal" ? "bg-indigo-600 text-white" : "hover:bg-slate-200 text-slate-600"
                )}
                title="Charcoal"
              >
                <Brush size={20} />
              </button>
              <button
                onClick={() => setTool("eraser")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  tool === "eraser" ? "bg-indigo-600 text-white" : "hover:bg-slate-200 text-slate-600"
                )}
                title="Eraser"
              >
                <Eraser size={20} />
              </button>
              <div className="h-8 w-px bg-slate-300 mx-1" />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
              />
              <select
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {[2, 5, 10, 15, 20].map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">View only</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Theme</span>
            <select
              value={backgroundTheme}
              onChange={(e) => {
                const value = e.target.value;
                if (isSketchBackgroundTheme(value)) setBackgroundTheme(value);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              title="Canvas background theme"
            >
              {SKETCH_BACKGROUND_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isDrawer && (
            <button
              onClick={clearCanvas}
              className="flex items-center gap-2 px-3 py-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-colors text-sm font-medium"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
