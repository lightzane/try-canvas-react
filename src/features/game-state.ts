import { createBattleZones, createBoundaries } from "@/features/collisions";
import type { Direction } from "@/features/controller";
import type { SceneName } from "@/features/scene";
import { Sprite } from "@/features/sprite";
import { BattleSprite } from "@/features/sprite-battle";
import { Player } from "@/features/sprite-player";
import { loadImage } from "@/lib/load-image";
import { getMapPosCenterTile } from "@/lib/positioning";
import { preload } from "@/lib/preload";

// Files live in public/assets/images/ so they're addressable by plain filename
// here, same convention as src/lib/audio.ts — no import per file.
const imgBase = import.meta.env.BASE_URL.replace(/\/$/, "/assets/images/");
const img = (name: string) => `${imgBase}${name}`;

const IMG_BATTLE_BG_SRC = img("battleBackground.png");
const IMG_MAP_FG_SRC = img("pallet-town-foreground.png");
const IMG_MAP_BG_SRC = img("pallet-town.png");

const IMG_PLAYER_DOWN = img("playerDown.png");
const IMG_PLAYER_LEFT = img("playerLeft.png");
const IMG_PLAYER_RIGHT = img("playerRight.png");
const IMG_PLAYER_UP = img("playerUp.png");

const IMG_SPRITE_DRAGGLE = img("draggle-sprite.png");
const IMG_SPRITE_EMBY = img("emby-sprite.png");
const IMG_FX_EMBER = img("fireball.png");

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
    actions: { z: false, x: false },
  },
  sceneName: "overworld" as SceneName,
  /** Seconds the current scene has been active — used by scenes with a `duration`. */
  sceneElapsed: 0,
  sprites: {
    draggle: new BattleSprite({
      name: "Draggle",
      src: IMG_SPRITE_DRAGGLE,
      position: { x: 800, y: 100 },
    }),
    emby: new BattleSprite({
      name: "Emby",
      src: IMG_SPRITE_EMBY,
      position: { x: 280, y: 325 },
    }),
  },
  battleComplete: false,
  fx: [] as Sprite[],
  assets: {
    imgFxEmber: IMG_FX_EMBER,
  },
};

const { background, foreground, battleBackground, player } = GAME_STATE;

export const assetsReady = preload([
  background.image,
  foreground.image,
  battleBackground.image,
  ...player.images,
]);

// Other assets to preload
loadImage(IMG_FX_EMBER);
