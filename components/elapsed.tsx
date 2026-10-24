"use client";

import { useEffect, useState } from "react";

export function Elapsed({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return (
    <span className="tabular-nums">
      {hours}:{String(minutes).padStart(2, "0")}:{String(rest).padStart(2, "0")}
    </span>
  );
}
