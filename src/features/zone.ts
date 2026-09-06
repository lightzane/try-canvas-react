import { TILE_SIZE } from "@/constants/game-settings";
import type { Position } from "@/features/sprite";

interface ZoneProps {
  position: Position;
  width: number;
  height: number;
}

/**
 * A generic rectangular area on the map. Reused for anything that needs
 * a marked region — wall boundaries, battle zones, sound triggers, etc.
 * Carries no behavior of its own; callers decide what happens on overlap.
 */
export class Zone {
  position: ZoneProps["position"];
  width: number;
  height: number;

  constructor({ position, width, height }: ZoneProps) {
    this.position = position;
    this.width = width;
    this.height = height;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.position;
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    ctx.fillRect(x, y, this.width, this.height);
  }
}

interface CreateZonesProps {
  tiles: number[];
  matchValue: number;
  columns: number;
  /** the map's current scroll offset, not a single zone's position */
  origin: Position;
}

/**
 * Turns a flat Tiled tile array into `Zone`s wherever the tile matches
 * `matchValue` — reused for walls, battle triggers, sound triggers, etc.
 */
export function createZones({ tiles, matchValue, columns, origin }: CreateZonesProps): Zone[] {
  const zones: Zone[] = [];

  tiles.forEach((tile, index) => {
    if (tile !== matchValue) return;

    const col = index % columns;
    const row = Math.floor(index / columns);

    zones.push(
      new Zone({
        position: {
          x: TILE_SIZE * col + origin.x,
          y: TILE_SIZE * row + origin.y,
        },
        width: TILE_SIZE,
        height: TILE_SIZE,
      }),
    );
  });

  return zones;
}
