import { GAME_STATE } from "@/features/game-state";
import type { Scene } from "@/features/scene";

export const battleScene: Scene = {
  duration: 5, // demo only — leaves battle automatically
  next: "overworld",

  update(dt) {
    GAME_STATE.sprites.draggle.step();
    GAME_STATE.sprites.emby.step();
  },

  draw(ctx) {
    GAME_STATE.battleBackground.draw(ctx);
    GAME_STATE.sprites.draggle.draw(ctx);
    GAME_STATE.sprites.emby.draw(ctx);
  },
};
