import { GameEngine } from "@/features/game-engine";
import { GAME_STATE } from "@/features/game-state";
import { onBattleSpriteChange, type BattleSprite } from "@/features/sprite-battle";
import { useEffect, useReducer, useRef, useState } from "react";

function InfoCard({ pokemon }: { pokemon: BattleSprite }) {
  return (
    <div className="rounded-xl border-4 border-green-900 bg-[#f8f0d8] px-4 py-2.5 font-game text-green-950 shadow-[4px_4px_0_rgba(0,0,0,0.25)]">
      <div className="mb-1.5 flex items-baseline justify-between gap-6 text-lg">
        <span className="uppercase">{pokemon.name}</span>
        <span>Lv5</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gray-400 px-2 py-0.5 text-xs font-bold text-white">
          HP
        </span>
        <div className="h-3.5 w-xs overflow-hidden rounded-full border-2 border-green-950 bg-gray-300">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pokemon.health > 50
                ? "bg-green-500"
                : pokemon.health > 20
                  ? "bg-yellow-400"
                  : "bg-red-500"
            }`}
            style={{ width: `${pokemon.health}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showHudLife, setShowHudLife] = useState(false);
  const [showHudActions, setShowHudActions] = useState(false);
  // GAME_STATE.sprites are plain mutable objects — React can't see .health
  // change on its own, so we subscribe to the shared channel every
  // BattleSprite notifies through, regardless of which ones exist.
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  useEffect(() => onBattleSpriteChange(forceUpdate), []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new GameEngine(canvasRef.current);

    game.on = (event) => {
      if (event.type === "hud:life.visible") setShowHudLife(event.visible);
      if (event.type === "hud:actions.visible") setShowHudActions(event.visible);
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

        {showHudLife && (
          <>
            {/* enemy — top-left, near its own sprite */}
            <div className="absolute top-[10%] left-[8%]">
              <InfoCard pokemon={GAME_STATE.sprites.draggle} />
            </div>

            {/* ally — right side, mid-height, near its own sprite (not mirrored at the top) */}
            <div className="absolute top-[65%] right-3/100 -translate-y-1/2">
              <InfoCard pokemon={GAME_STATE.sprites.emby} />
            </div>
          </>
        )}

        {showHudActions && (
          <>
            {/* move selection */}
            <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-3 rounded-xl border-4 border-green-900 bg-[#f8f0d8] p-4 font-game text-green-950 shadow-[4px_4px_0_rgba(0,0,0,0.25)]">
              <button
                onClick={() => {
                  GAME_STATE.sprites.emby.attack({
                    name: "tackle",
                    receipient: GAME_STATE.sprites.draggle,
                  });
                }}
                className="group flex items-center py-1.5 text-left text-xl hover:text-green-700"
              >
                <span className="mr-2 w-4 opacity-0 group-hover:opacity-100">▶</span>
                TACKLE
              </button>
              <button
                onClick={() => {
                  GAME_STATE.sprites.emby.attack({
                    name: "ember",
                    receipient: GAME_STATE.sprites.draggle,
                  });
                }}
                className="group flex items-center py-1.5 text-left text-xl hover:text-green-700"
              >
                <span className="mr-2 w-4 opacity-0 group-hover:opacity-100">▶</span>
                EMBER
              </button>
              <button
                onClick={() => {
                  GAME_STATE.sceneName = "overworld";
                  setShowHudLife(false);
                  setShowHudActions(false);
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
