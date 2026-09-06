import type { Direction } from "@/features/controller";
import { Sprite } from "@/features/sprite";

interface PlayerProps {
  position?: { x: number; y: number };
  sprites: Record<Direction, HTMLImageElement>;
  facing?: Direction;
  moveSpeed?: number;
}

export class Player extends Sprite {
  private readonly sprites: PlayerProps["sprites"];
  /** Movement speed per second (e.g. **200px/sec**) @default 200 */
  moveSpeed: NonNullable<PlayerProps["moveSpeed"]>;

  constructor({ sprites, position, facing = "s", moveSpeed = 200 }: PlayerProps) {
    super({ image: sprites[facing], position, frames: { max: 4 } });
    this.sprites = sprites;
    this.moveSpeed = moveSpeed;
  }

  face(direction: Direction) {
    this.image = this.sprites[direction];
    this.step();
  }
}
