"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost } from "./ui";

export function SignaturePad({ name = "dataUrl" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [data, setData] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.width = 640;
    canvas.height = 200;
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.strokeStyle = "#163026";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function end() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setData(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setData("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-36 w-full touch-none rounded-2xl border border-line bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <input type="hidden" name={name} value={data} />
      <button type="button" className={`${btnGhost} mt-2`} onClick={clear}>
        Unterschrift löschen
      </button>
    </div>
  );
}
