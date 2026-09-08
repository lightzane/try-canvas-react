import IMG_BATTLE_BG_SRC from "@/assets/img/battleBackground.png";
import IMG_MAP_FG_SRC from "@/assets/img/pallet-town-foreground.png";
import IMG_MAP_BG_SRC from "@/assets/img/pallet-town.png";

import IMG_PLAYER_DOWN from "@/assets/img/playerDown.png";
import IMG_PLAYER_LEFT from "@/assets/img/playerLeft.png";
import IMG_PLAYER_RIGHT from "@/assets/img/playerRight.png";
import IMG_PLAYER_UP from "@/assets/img/playerUp.png";

import IMG_SPRITE_DRAGGLE from "@/assets/img/draggle-sprite.png";
import IMG_SPRITE_EMBY from "@/assets/img/emby-sprite.png";

import { createBattleZones, createBoundaries } from "@/features/collisions";
import type { Direction } from "@/features/controller";
import type { SceneName } from "@/features/scene";
import { Sprite } from "@/features/sprite";
import { Player } from "@/features/sprite-player";
import { getMapPosCenterTile } from "@/lib/positioning";
import { preload } from "@/lib/preload";

const IMGS_PLAYER_SRC: Record<Direction, string> = {
  w: IMG_PLAYER_UP,
  a: IMG_PLAYER_LEFT,
  s: IMG_PLAYER_DOWN,
  d: IMG_PLAYER_RIGHT,
};

const mapOrigin = getMapPosCenterTile([25, 20]);

export const GAME_STATE = {
  background: new Sprite({ src: IMG_MAP_BG_SRC, position: structuredClone(mapOrigin) }),
  foreground: new Sprite({ src: IMG_MAP_FG_SRC, position: structuredClone(mapOrigin) }),
  battleBackground: new Sprite({ src: IMG_BATTLE_BG_SRC }),
  player: new Player({ sprites: IMGS_PLAYER_SRC }),
  boundaries: createBoundaries(structuredClone(mapOrigin)),
  battleZones: createBattleZones(structuredClone(mapOrigin)),
  keys: {
    pressed: [] as Direction[],
  },
  sceneName: "overworld" as SceneName,
  /** Seconds the current scene has been active — used by scenes with a `duration`. */
  sceneElapsed: 0,
  sprites: {
    draggle: new Sprite({
      src: IMG_SPRITE_DRAGGLE,
      position: { x: 800, y: 100 },
      frames: { max: 4 },
    }),
    emby: new Sprite({
      src: IMG_SPRITE_EMBY,
      position: { x: 280, y: 325 },
      frames: { max: 4 },
    }),
  },
};

const { background, foreground, battleBackground, player } = GAME_STATE;

export const assetsReady = preload([
  background.image,
  foreground.image,
  battleBackground.image,
  ...player.images,
]);
