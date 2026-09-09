import { GAME_STATE } from "@/features/game-state";
import type { Scene } from "@/features/scene";
import { DIALOGUE } from "@/lib/canvas/dialogue";

let isHudShown = false;

export const battleScene: Scene = {
  // duration: 5, // demo only — leaves battle automatically
  // next: "overworld",

  update(_dt) {
    if (GAME_STATE.sceneElapsed === 0) {
      DIALOGUE.show("A wild Pokémon appeared!");
      DIALOGUE.queue({ color: "blue", text: "PROF. OAK: I want to test a conversation" });
      DIALOGUE.queue({
        color: "red",
        text: ["YOU: OH we almost forgot this!", "Alright, I think I got this! I remember now! 🎉"],
      });
      DIALOGUE.queue("Prepare for battle...");
      DIALOGUE.queue("End of message");
      isHudShown = false;
    }

    // once the intro dialogue closes, reveal the HUD
    if (!isHudShown && !DIALOGUE.isActive) {
      isHudShown = true;
      this.on?.({ type: "hud:visible", visible: true });
    }

    GAME_STATE.sprites.draggle.step();
    GAME_STATE.sprites.emby.step();
  },

  draw(ctx) {
    GAME_STATE.battleBackground.draw(ctx);
    GAME_STATE.sprites.draggle.draw(ctx);
    GAME_STATE.sprites.emby.draw(ctx);
  },
};
