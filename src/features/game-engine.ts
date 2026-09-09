import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/game-settings";
import { Controller } from "@/features/controller";
import { assetsReady, GAME_STATE } from "@/features/game-state";
import type { Scene, SceneEvent, SceneName } from "@/features/scene";
import { battleScene } from "@/features/scenes/battle";
import { overworldScene } from "@/features/scenes/overworld";
import { DIALOGUE, dialogueFontReady } from "@/lib/canvas/dialogue";
import { FADE } from "@/lib/canvas/fade-transition";

const SCENES: Record<SceneName, Scene> = {
  overworld: overworldScene,
  battle: battleScene,
};

function enterScene(from: SceneName, to: SceneName) {
  const showDuration = SCENES[from].fadeOut ?? 0;
  const hideDuration = SCENES[to].fadeIn ?? 0;
  GAME_STATE.sceneName = to;
  GAME_STATE.sceneElapsed = 0;
  FADE.start(showDuration, hideDuration);
}

export class GameEngine {
  /** Overwrite this to listen for scene-emitted events (e.g. `game.on = (event) => {...}`). */
  on: (event: SceneEvent) => void = () => {};

  private ctx: CanvasRenderingContext2D;
  /** The game controls input by user */
  private controller: Controller;
  /** Stores the rAF id (requestAnimationFrame) */
  private gameLoopId = 0;
  /**
   * Used as elapsed time or delta time to sync devices via
   * time-based instead of frame-rate
   */
  private lastTime = performance.now();
  private cancelled = false;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("2D context not supported");
    this.ctx = ctx;

    // Spawn player at a specific tile
    // GAME_STATE.player.position = getPosSpawnTile({
    //   tile: [25, 20],
    //   spriteSize: GAME_STATE.player.size,
    //   origin: GAME_STATE.background.position,
    // });

    // Spawn player at center of canvas
    GAME_STATE.player.position = {
      x: CANVAS_WIDTH / 2 - GAME_STATE.player.width / 2,
      y: CANVAS_HEIGHT / 2 - GAME_STATE.player.height / 2,
    };

    this.controller = new Controller(GAME_STATE.keys);
  }

  start() {
    window.addEventListener("keydown", this.controller.keydown);
    window.addEventListener("keyup", this.controller.keyup);
    window.addEventListener("blur", this.controller.blur);

    Promise.all([assetsReady, dialogueFontReady])
      .then(() => {
        if (this.cancelled) return;
        this.gameLoopId = requestAnimationFrame(this.tick);
      })
      .catch((err) => console.error(err));
  }

  stop() {
    this.cancelled = true;
    cancelAnimationFrame(this.gameLoopId);
    window.removeEventListener("keydown", this.controller.keydown);
    window.removeEventListener("keyup", this.controller.keyup);
    window.removeEventListener("blur", this.controller.blur);
  }

  // class-field arrow: `this` stays bound without a manual .bind() call
  // if not arrow, then in constructor we need to manually bind:
  // `this.tick = this.tick.bind(this);`
  private tick = (time: number) => {
    this.gameLoopId = requestAnimationFrame(this.tick);
    const dt = (time - this.lastTime) / 1000; // delta time in seconds
    this.lastTime = time;

    const sceneName = GAME_STATE.sceneName;
    const scene = SCENES[sceneName];
    scene.on = this.on;
    scene.update(dt);
    GAME_STATE.sceneElapsed += dt;

    const sceneChanged = GAME_STATE.sceneName !== sceneName;
    const sceneExpired = scene.duration !== undefined && GAME_STATE.sceneElapsed >= scene.duration;

    if (sceneChanged) enterScene(sceneName, GAME_STATE.sceneName);
    else if (sceneExpired) enterScene(sceneName, scene.next);

    FADE.update(dt);
    DIALOGUE.update(dt);

    // Skip drawing while still showing the overlay — otherwise whatever this
    // scene draws bleeds through the still-transparent overlay before the
    // swap is actually hidden. The canvas just keeps the last painted
    // (frozen) frame in the meantime, since nothing draws over it.
    if (FADE.phase !== "show") {
      scene.draw(this.ctx);
      DIALOGUE.draw(this.ctx);
    }

    FADE.draw(this.ctx);

    // DEBUG: Center of the canvas
    // this.ctx.fillStyle = "rgba(255, 0, 0, 1)";
    // this.ctx.fillRect(CANVAS_WIDTH / 2 - 5, CANVAS_HEIGHT / 2 - 5, 10, 10);
  };
}
