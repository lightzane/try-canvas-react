// @refresh reset

import { GameEngine } from "@/features/game-engine";
import { useEffect, useRef } from "react";

export default function Layout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new GameEngine(canvasRef.current);
    game.start();

    return () => {
      game.stop();
    };
  }, []);

  return (
    <div className="w-full min-h-dvh flex justify-center items-center">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
