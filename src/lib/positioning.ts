import { CANVAS_HEIGHT, CANVAS_WIDTH, TILE_SIZE } from "@/constants/game-settings";

interface MapPosCenterTileOpts {
  /** Size of canvas @default 1024x576 */
  canvas?: { width: number; height: number };
  /** @default 48 */
  tileSize?: number;
}

const DEFAULT_OPTIONS: Required<MapPosCenterTileOpts> = {
  tileSize: TILE_SIZE,
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
};

/**
 * Centers the given `tile` in canvas's center by positioning the map.
 *
 * Tip: The tile's `col,row` coordinates you see at the bottom-left
 * of **Tiled** (e.g. 25, 20).
 *
 * @param tile The coordinates of the tile to position in the center of canvas.
 */
export function getMapPosCenterTile(tile: [number, number], opts?: MapPosCenterTileOpts) {
  const [col, row] = tile;

  opts = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  const { tileSize, canvas } = opts as Required<MapPosCenterTileOpts>;

  // Get the tile's starting pixel (1st tile at index 0 = 0px, 2nd tile at index 1 = 48px)
  const tileLeftX = col * tileSize;
  const tileTopY = row * tileSize;

  // Find the distance of a tile to its center
  const halfTile = tileSize / 2;

  // Add the distance from tile's starting pixels
  const tileCenterX = tileLeftX + halfTile;
  const tileCenterY = tileTopY + halfTile;

  // Find the distance of the canvas to its center
  const halfCanvasX = canvas.width / 2;
  const halfCanvasY = canvas.height / 2;

  // Position the tile's center to the center position of canvas
  return {
    x: halfCanvasX - tileCenterX,
    y: halfCanvasY - tileCenterY,
  };
}

interface PosSpawnTileParams {
  tile: [number, number];
  spriteSize: { width: number; height: number };
  origin: { x: number; y: number };
}

export function getPosSpawnTile({
  tile: [col, row],
  spriteSize: { width, height },
  origin: { x, y },
}: PosSpawnTileParams) {
  // Get the tile's starting pixel (1st tile at index 0 = 0px, 2nd tile at index 1 = 48px)
  const tileLeftX = col * TILE_SIZE;
  const tileTopY = row * TILE_SIZE;

  // Find the distance of a tile to its center
  const halfTile = TILE_SIZE / 2;

  // Add the distance from tile's starting pixels
  const tileCenterX = tileLeftX + halfTile;
  const tileCenterY = tileTopY + halfTile;

  // Find the center of sprite
  const spriteX = width / 2;
  const spriteY = height / 2;

  return {
    x: x + tileCenterX - spriteX,
    y: y + tileCenterY - spriteY,
  };
}
