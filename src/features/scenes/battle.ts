import { GAME_STATE } from "@/features/game-state";
import type { Scene } from "@/features/scene";

export const battleScene: Scene = {
  duration: 5, // demo only — leaves battle automatically
  next: "overworld",

  update() {},

  draw(ctx) {
    GAME_STATE.battleBackground.draw(ctx);
  },
};
