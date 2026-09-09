import { GameEngine } from "@/features/game-engine";
import { GAME_STATE } from "@/features/game-state";
import { useEffect, useRef, useState } from "react";

// TEMP: no real HP tracking yet — these are just visual placeholders
const ENEMY = { name: "EMBY", level: 5, hpPercent: 60 };
const ALLY = { name: "DRAGGLE", level: 5, hpPercent: 80 };

function InfoCard({ pokemon }: { pokemon: { name: string; level: number; hpPercent: number } }) {
  return (
    <div className="rounded-xl border-4 border-green-900 bg-[#f8f0d8] px-4 py-2.5 font-game text-green-950 shadow-[4px_4px_0_rgba(0,0,0,0.25)]">
      <div className="mb-1.5 flex items-baseline justify-between gap-6 text-lg">
        <span>{pokemon.name}</span>
        <span>Lv{pokemon.level}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-orange-400 px-2 py-0.5 text-xs font-bold text-white">
          HP
        </span>
        <div className="h-3.5 w-36 overflow-hidden rounded-full border-2 border-green-950 bg-gray-300">
          <div
            className={`h-full rounded-full ${
              pokemon.hpPercent > 50
                ? "bg-green-500"
                : pokemon.hpPercent > 20
                  ? "bg-yellow-400"
                  : "bg-red-500"
            }`}
            style={{ width: `${pokemon.hpPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

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
          <>
            {/* enemy — top-left, near its own sprite */}
            <div className="absolute top-4 left-4">
              <InfoCard pokemon={ENEMY} />
            </div>

            {/* ally — right side, mid-height, near its own sprite (not mirrored at the top) */}
            <div className="absolute top-1/2 right-4 -translate-y-1/2">
              <InfoCard pokemon={ALLY} />
            </div>

            {/* move selection */}
            <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-3 rounded-xl border-4 border-green-900 bg-[#f8f0d8] p-4 font-game text-green-950 shadow-[4px_4px_0_rgba(0,0,0,0.25)]">
              <button className="group flex items-center py-1.5 text-left text-xl hover:text-green-700">
                <span className="mr-2 w-4 opacity-0 group-hover:opacity-100">▶</span>
                TACKLE
              </button>
              <button className="group flex items-center py-1.5 text-left text-xl hover:text-green-700">
                <span className="mr-2 w-4 opacity-0 group-hover:opacity-100">▶</span>
                FIREBALL
              </button>
              <button
                onClick={() => {
                  GAME_STATE.sceneName = "overworld";
                  setShowHud(false);
                }}
                className="group col-span-2 flex items-center py-1.5 text-left text-xl hover:text-green-700"
              >
                <span className="mr-2 w-4 opacity-0 group-hover:opacity-100">▶</span>
                RUN
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
