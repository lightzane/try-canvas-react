import { GAME_STATE } from "@/features/game-state";
import type { Scene } from "@/features/scene";
import { playMusic } from "@/lib/audio";
import { DIALOGUE } from "@/lib/canvas/dialogue";
import { Cues } from "@/lib/cues";

let introduction = true;
let battleCompleteHandled = false;

const cues = new Cues([
  {
    at: 0,
    run: () => {
      DIALOGUE.show("A wild Pokémon appeared!");

      if (introduction) {
        introduction = false;
        DIALOGUE.queue({ color: "blue", text: "PROF. OAK: I want to test a conversation" });
        DIALOGUE.queue({
          color: "red",
          text: [
            "YOU: OH we almost forgot this!",
            "Alright, I think I got this! I remember now! 🎉",
          ],
        });
        DIALOGUE.queue("Prepare for battle...");
        DIALOGUE.queue("End of message");
      }

      DIALOGUE.onComplete = () => {
        battleScene.on?.({ type: "hud:life.visible", visible: true });
        battleScene.on?.({ type: "hud:actions.visible", visible: true });
      };
    },
  },
  { at: 1, run: () => playMusic("battle", { volume: 0.5, seek: 0 }) },
]);

export const battleScene: Scene = {
  // duration: 5, // demo only — leaves battle automatically
  // next: "overworld",

  update(_dt) {
    if (GAME_STATE.sceneElapsed === 0) {
      cues.start();
      battleCompleteHandled = false;
    }

    if (GAME_STATE.battleComplete && !battleCompleteHandled) {
      battleCompleteHandled = true;
      this.on?.({ type: "hud:actions.visible", visible: false });
      DIALOGUE.show("Enemy fainted! 🙌🏻");
      DIALOGUE.onComplete = () => {
        this.on?.({ type: "hud:life.visible", visible: false });
        GAME_STATE.sceneName = "overworld";
      };
    }

    GAME_STATE.sprites.draggle.step();
    GAME_STATE.sprites.emby.step();
  },

  draw(ctx) {
    GAME_STATE.battleBackground.draw(ctx);
    GAME_STATE.sprites.draggle.draw(ctx);

    GAME_STATE.fx.forEach((fx) => {
      fx.draw(ctx);
      fx.step();
    });

    GAME_STATE.sprites.emby.draw(ctx);
  },
};
