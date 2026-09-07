import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/game-settings";

export type FadeDirection = "in" | "out";

export class FadeTransition {
  private duration: number; // seconds
  private elapsed = 0;
  private phase: FadeDirection = "out";
  active = false;

  constructor(duration: number = 1) {
    this.duration = duration;
  }

  get direction() {
    return this.phase;
  }

  /** @param duration Overrides the duration set in the constructor, in seconds. */
  start(direction: FadeDirection, duration?: number) {
    this.phase = direction;
    this.elapsed = 0;
    this.active = true;
    if (duration !== undefined) this.duration = duration;
  }

  /** Advances the fade by dt seconds. Returns true on the exact frame this phase finishes. */
  update(dt: number): boolean {
    if (!this.active) return false;

    this.elapsed += dt;
    if (this.elapsed < this.duration) return false;

    this.elapsed = this.duration;
    this.active = false;
    return true; // just finished
  }

  get alpha() {
    const progress = Math.min(this.elapsed / this.duration, 1);
    return this.phase === "out" ? progress : 1 - progress;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    ctx.fillStyle = `rgba(0, 0, 0, ${this.alpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

export const fade = new FadeTransition();
