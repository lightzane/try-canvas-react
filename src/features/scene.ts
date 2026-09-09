export type SceneName = "overworld" | "battle";

export type SceneEvent =
  | { type: "hud:life.visible"; visible: boolean }
  | { type: "hud:actions.visible"; visible: boolean };

interface SceneBase {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  /** This scene's own reveal duration, in seconds; unset = instant. */
  fadeIn?: number;
  /** This scene's own exit duration, in seconds; unset = instant. */
  fadeOut?: number;
  /** Set by `GameEngine` each frame — call this to notify outside listeners (e.g. React). */
  on?: (event: SceneEvent) => void;
}

/** `duration` and `next` are a pair — set both to auto-transition, or neither. */
type SceneTransition =
  | { duration: number; next: SceneName } //
  | { duration?: never; next?: never };

export type Scene = SceneBase & SceneTransition;
