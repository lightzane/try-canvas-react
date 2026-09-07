import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/game-settings";
import { isColliding, type Rect } from "@/features/collisions";
import { Controller } from "@/features/controller";
import { assetsReady, GAME_STATE } from "@/features/game-state";

export class GameEngine {
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

    assetsReady
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

    this.update(dt);
    this.draw();
  };

  private update(dt: number) {
    const direction = GAME_STATE.keys.pressed.at(-1);
    if (direction) GAME_STATE.player.face(direction);
    else GAME_STATE.player.frames.val = 0; // standing position

    // [Frame rate] if NO delta time, this will be 200px/tick
    // which can be faster in other devices (e.g. 60Hz, 120Hz, 144Hz)
    //
    // Sync with [Time-based]
    // movement 200px/sec — multiply with delta time
    const distance = GAME_STATE.player.moveSpeed * dt;

    if (direction === "w") this.attemptMove(0, distance);
    else if (direction === "a") this.attemptMove(distance, 0);
    else if (direction === "s") this.attemptMove(0, -distance);
    else if (direction === "d") this.attemptMove(-distance, 0);
  }

  private move(dx: number, dy: number) {
    GAME_STATE.background.position.x += dx;
    GAME_STATE.background.position.y += dy;
    GAME_STATE.foreground.position.x += dx;
    GAME_STATE.foreground.position.y += dy;
    [GAME_STATE.boundaries, GAME_STATE.battleZones] //
      .flat()
      .forEach((b) => {
        b.position.x += dx;
        b.position.y += dy;
      });
  }

  private attemptMove(dx: number, dy: number) {
    const { position, width, height } = GAME_STATE.player;
    const playerBox: Rect = {
      width,
      height,
      position: {
        // the player is visually fixed, so test with inversed delta
        x: position.x + -dx,
        y: position.y + -dy,
      },
    };
    const blocked = GAME_STATE.boundaries.some((b) => isColliding(playerBox, b));
    if (!blocked) this.move(dx, dy);
  }

  private draw() {
    GAME_STATE.background.draw(this.ctx);
    // GAME_STATE.boundaries.forEach((b) => b.draw(this.ctx)); // for debugging and boundary visibility
    // GAME_STATE.battleZones.forEach((b) => b.draw(this.ctx)); // for debugging
    GAME_STATE.player.draw(this.ctx);
    GAME_STATE.foreground.draw(this.ctx);

    // DEBUG: Center of the canvas
    // this.ctx.fillStyle = "rgba(255, 0, 0, 1)";
    // this.ctx.fillRect(CANVAS_WIDTH / 2 - 5, CANVAS_HEIGHT / 2 - 5, 10, 10);
  }
}
