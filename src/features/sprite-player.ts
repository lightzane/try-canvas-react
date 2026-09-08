import type { Direction } from "@/features/controller";
import { loadImage, Sprite } from "@/features/sprite";

interface PlayerProps {
  position?: { x: number; y: number };
  sprites: Record<Direction, string>;
  facing?: Direction;
  moveSpeed?: number;
}

export class Player extends Sprite {
  private readonly sprites: Record<Direction, HTMLImageElement>;
  /** Movement speed per second (e.g. **200px/sec**) @default 200 */
  moveSpeed: NonNullable<PlayerProps["moveSpeed"]>;

  constructor({ sprites, position, facing = "s", moveSpeed = 200 }: PlayerProps) {
    super({ src: sprites[facing], position, frames: { max: 4 } });
    this.sprites = Object.fromEntries(
      Object.entries(sprites).map(([direction, src]) => [direction, loadImage(src)]),
    ) as Record<Direction, HTMLImageElement>;
    this.moveSpeed = moveSpeed;
  }

  face(direction: Direction) {
    this.image = this.sprites[direction];
    this.step();
  }

  /** All 4 loaded direction sprites — used by preload(), not for drawing. */
  get images() {
    return Object.values(this.sprites);
  }
}
