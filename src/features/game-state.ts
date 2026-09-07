import IMG_BATTLE_BG_SRC from "@/assets/img/battleBackground.png";
import IMG_MAP_FG_SRC from "@/assets/img/pallet-town-foreground.png";
import IMG_MAP_BG_SRC from "@/assets/img/pallet-town.png";

import IMG_PLAYER_DOWN from "@/assets/img/playerDown.png";
import IMG_PLAYER_LEFT from "@/assets/img/playerLeft.png";
import IMG_PLAYER_RIGHT from "@/assets/img/playerRight.png";
import IMG_PLAYER_UP from "@/assets/img/playerUp.png";

import { createBattleZones, createBoundaries } from "@/features/collisions";
import type { Direction } from "@/features/controller";
import type { SceneName } from "@/features/scene";
import { Sprite } from "@/features/sprite";
import { Player } from "@/features/sprite-player";
import { getMapPosCenterTile } from "@/lib/positioning";
import { preload } from "@/lib/preload";

// TODO: Maybe allow Sprite to create instance of Image
// TODO: to reduce block of code by quickly providing
// TODO: the image source instead
const IMG_MAP_BG = new Image();
const IMG_MAP_FG = new Image();
const IMG_BATTLE_BG = new Image();

IMG_MAP_BG.src = IMG_MAP_BG_SRC;
IMG_MAP_FG.src = IMG_MAP_FG_SRC;
IMG_BATTLE_BG.src = IMG_BATTLE_BG_SRC;

const IMGS_PLAYER_SRC: Record<Direction, string> = {
  w: IMG_PLAYER_UP,
  a: IMG_PLAYER_LEFT,
  s: IMG_PLAYER_DOWN,
  d: IMG_PLAYER_RIGHT,
};

const IMGS_PLAYER = Object.fromEntries(
  Object.entries(IMGS_PLAYER_SRC).map(([direction, src]) => {
    const image = new Image();
    image.src = src;
    return [direction, image];
  }),
) as Record<Direction, HTMLImageElement>;

export const assetsReady = preload([
  IMG_MAP_BG,
  IMG_MAP_FG,
  IMG_BATTLE_BG, //
  ...Object.values(IMGS_PLAYER),
]);

const mapOrigin = getMapPosCenterTile([25, 20]);

export const GAME_STATE = {
  background: new Sprite({ image: IMG_MAP_BG, position: structuredClone(mapOrigin) }),
  foreground: new Sprite({ image: IMG_MAP_FG, position: structuredClone(mapOrigin) }),
  battleBackground: new Sprite({ image: IMG_BATTLE_BG }),
  player: new Player({ sprites: IMGS_PLAYER }),
  boundaries: createBoundaries(structuredClone(mapOrigin)),
  battleZones: createBattleZones(structuredClone(mapOrigin)),
  keys: {
    pressed: [] as Direction[],
  },
  scene: "overworld" as SceneName,
  /** Seconds the current scene has been active — used by scenes with a `duration`. */
  sceneElapsed: 0,
};
