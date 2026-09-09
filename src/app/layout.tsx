import { GameEngine } from "@/features/game-engine";
import { useEffect, useRef, useState } from "react";

export default function Layout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showHud, setShowHud] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new GameEngine(canvasRef.current);

    game.on = (event) => {
      if (event.type === "hud:visible") setShowHud(event.visible);
    };

    game.start();

    return () => {
      game.stop();
    };
  }, []);

  return (
    <div className="w-full min-h-dvh flex justify-center items-center">
      <div className="relative">
        <canvas ref={canvasRef}></canvas>

        {showHud && (
          <div className="absolute inset-x-4 bottom-4 h-28 rounded-lg border-4 border-black bg-white p-4 text-black text-lg"></div>
        )}
      </div>
    </div>
  );
}
