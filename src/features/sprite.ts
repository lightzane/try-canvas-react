export type Position = { x: number; y: number };

interface SpriteProps {
  image: HTMLImageElement;
  position?: Position;
  frames?: SpriteFrames;
}

interface SpriteFrames {
  /** frames in the sprite sheet @default 1 */
  max?: number;
  /** current frame index @default 0 */
  val?: number;
  /** ticks since last advance @default 0 */
  elapsed?: number;
  /**
   * render-ticks to wait before advancing
   * is what keeps the walk cycle human-paced — without it
   * you'd advance a frame every render tick (60/sec),
   * which looks like a blur, not a walk.
   * @default 10
   */
  hold?: number;
}

export class Sprite {
  image: SpriteProps["image"];
  position: NonNullable<SpriteProps["position"]>;
  frames: Required<NonNullable<SpriteProps["frames"]>>;

  constructor({ image, position = { x: 0, y: 0 }, frames = { max: 1 } }: SpriteProps) {
    this.image = image;
    this.position = position;
    this.frames = { max: 1, hold: 10, val: 0, elapsed: 0, ...frames };
  }

  get width() {
    return this.image.width / this.frames.max;
  }

  get height() {
    return this.image.height;
  }

  get size() {
    return {
      width: this.width,
      height: this.height,
    };
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.image) return;

    const { x, y } = this.position;

    // Basic
    // ctx.drawImage(this.image, x, y);

    // With Sprite frames
    const sx = this.frames.val * this.width;

    ctx.drawImage(
      this.image,
      // (source) crop here
      sx, // starts at 0
      0,
      this.width,
      this.height,
      // (destination) paint here
      x,
      y,
      this.width,
      this.height,
    );

    // if (import.meta.env.DEV) {
    //   ctx.strokeStyle = "lime";
    //   ctx.lineWidth = 2;
    //   ctx.strokeRect(x, y, this.width, this.height);
    // }
  }

  step() {
    if (this.frames.max <= 1) return;

    this.frames.elapsed++;

    if (this.frames.elapsed % this.frames.hold === 0) {
      this.frames.val = ++this.frames.val % this.frames.max;
    }
  }
}
