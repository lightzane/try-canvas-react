export type SceneName = "overworld" | "battle";

interface SceneBase {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

/** `duration` and `next` are a pair — set both to auto-transition, or neither. */
type SceneTransition =
  | { duration: number; next: SceneName } //
  | { duration?: never; next?: never };

export type Scene = SceneBase & SceneTransition;
