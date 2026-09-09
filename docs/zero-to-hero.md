# Canvas Game Dev: Zero to Hero

Build a top-down walking game on an HTML canvas. React only mounts the
`<canvas>`.

**Assumes:** `pnpm dev` runs (see [README](../README.md)); Tiled assets
already exist under [`src/assets/img`](../src/assets/img).

## Table of Contents

**Core Fundamentals**

- [Get a Pixel on Screen](#get-a-pixel-on-screen)
- [The Game Loop](#the-game-loop)
- [The `Sprite` Class](#the-sprite-class)
- [Get React Out of the Way](#get-react-out-of-the-way)

**Input & Movement**

- [Make It Move](#make-it-move)
- [Animate the Walk Cycle](#animate-the-walk-cycle)
- [Make It Feel Right](#make-it-feel-right)

**Collision & Layering**

- [Walls You Can't Walk Through](#walls-you-cant-walk-through)
- [Layer a Foreground Over the Player](#layer-a-foreground-over-the-player)

**Optional: RPG Systems** — skip this whole group for a non-RPG game

- [Detect the Player Entering a Zone](#detect-the-player-entering-a-zone)
- [Split Behavior by Scene](#split-behavior-by-scene)
- [Fade Between Scenes](#fade-between-scenes)

**Summary**

- [Where You Landed](#where-you-landed)

## Get a Pixel on Screen

### Step 1: Mount a canvas and grab its 2D context

Magic numbers like `1024`/`576` get typed in more than once (canvas size,
centering math, later collision math) — name them once, up front, instead
of retyping the literal everywhere.

**File:** `src/constants/game-settings.ts`

<!-- prettier-ignore -->
```ts
export const CANVAS_WIDTH = 1024;  // aspect ratio 16:9
export const CANVAS_HEIGHT = 576;

/**
 * The tile size is 12x12, exported at 400% zoom:
 * 12 * 4 = 48.
 */
export const TILE_SIZE = 48;
```

**File:** `src/app/layout.tsx`

<!-- prettier-ignore -->
```tsx
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/game-settings";
import { useEffect, useRef } from "react";

export default function Layout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
  }, []);

  return <canvas ref={canvasRef}></canvas>;
}
```

> [!NOTE]
> `pnpm dev` — nothing visible yet, canvas is transparent until drawn on.

### Step 2: Draw one static image

**File:** `src/app/layout.tsx`

<!-- prettier-ignore -->
```ts
import IMG_MAP_SRC from "@/assets/img/pallet-town.png";
```

<!-- prettier-ignore -->
```ts
    // -- snip --
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // new:
    const mapOrigin = { x: -780, y: -720 }; // (0, 0) on this map is open ocean, start over land instead

    const IMG_MAP = new Image();
    IMG_MAP.src = IMG_MAP_SRC; // an imported module value, not a raw path — Vite fingerprints this on build

    IMG_MAP.onload = () => {
      ctx!.drawImage(IMG_MAP, mapOrigin.x, mapOrigin.y);
    };
  }, []);
  // -- snip --
```

> [!WARNING]
> Must wait for `onload` — `drawImage` before load paints nothing.

> [!WARNING]
> `ctx!`, not `ctx` — the `if (!canvas || !ctx) return;` guard above narrows
> `ctx` to non-null, but that narrowing doesn't survive into a nested
> closure like this `onload` callback (TypeScript can't prove the closure
> only runs after the guard, even though `ctx` is a `const`). Every closure
> that touches `ctx` from here on needs the same `!`.

> [!NOTE]
> Reload — you should see land (grass/trees), not open ocean.

## The Game Loop

### Step 3: Repaint continuously

**File:** `src/app/layout.tsx` — repaints every frame regardless of load
timing, so `IMG_MAP.onload` isn't needed anymore:

<!-- prettier-ignore -->
```ts
    // -- snip --
    IMG_MAP.src = IMG_MAP_SRC;

    function draw() { // was: IMG_MAP.onload = () => { ctx!.drawImage(...) }
      ctx!.drawImage(IMG_MAP, mapOrigin.x, mapOrigin.y);
    }

    // new:
    let gameLoopId: number;
    function tick() {
      gameLoopId = requestAnimationFrame(tick); // reschedule FIRST
      draw();
    }
    tick();

    return () => cancelAnimationFrame(gameLoopId);
  }, []);
  // -- snip --
```

> [!TIP]
> Reschedule before this frame's work — a slow/throwing frame can't block
> the next one.

> [!NOTE]
> Add `console.log("tick")` — ~60 lines/sec in console.

## The `Sprite` Class

### Step 4: Generalize "draw an image at a position"

**File:** `src/lib/load-image.ts` — a general-purpose utility, not specific to
`Sprite`, so it doesn't live inside `sprite.ts`:

<!-- prettier-ignore -->
```ts
const imageCache = new Map<string, HTMLImageElement>();

// same src always returns the same HTMLImageElement — multiple sprites
// sharing one image (e.g. several identical enemies) share one fetch/decode
// instead of each paying for its own
export function loadImage(src: string): HTMLImageElement {
  const cached = imageCache.get(src);
  if (cached) return cached;

  const image = new Image();
  image.src = src;
  imageCache.set(src, image);
  return image;
}
```

**File:** `src/features/sprite.ts`

<!-- prettier-ignore -->
```ts
import { loadImage } from "@/lib/load-image";

export type Position = { x: number; y: number }; // reused everywhere something needs an x/y

interface SpriteProps {
  src: string; // the <img> source — Sprite loads it, callers never touch Image directly
  position?: Position;
}

export class Sprite {
  image: HTMLImageElement;
  position: Position;

  constructor({ src, position = { x: 0, y: 0 } }: SpriteProps) {
    this.image = loadImage(src);
    this.position = position;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.image, this.position.x, this.position.y);
  }
}
```

> [!TIP]
> A source string in, a loaded `Image` out — every future sprite (map,
> player, foreground, battle background) is created from a plain import,
> never a manual `new Image()`.

> [!TIP]
> The cache matters most once several `Sprite`s share the same image — e.g.
> a wave of identical enemies. Without it, each one calls `new Image()` and
> decodes the same bitmap independently: same network bytes (browsers cache
> those), but a separate decode and a separate copy in memory per sprite.
> With the cache, the second (and hundredth) `loadImage("emby.png")` just
> returns the _same_ `HTMLImageElement` — one decode, one bitmap, shared by
> every sprite using it. `ctx.drawImage()` has no problem painting the same
> source image at many different positions.

### Step 5: Add the player as a second sprite

**File:** `src/app/layout.tsx` — `Sprite` now loads its own image, so
delete `IMG_MAP`'s manual `new Image()`/`.src`/`.onload` entirely:

<!-- prettier-ignore -->
```ts
import IMG_PLAYER_SRC from "@/assets/img/playerDown.png";
import { Sprite } from "@/features/sprite";
```

<!-- prettier-ignore -->
```ts
    // -- snip --
    const mapOrigin = { x: -780, y: -720 };

    const map = new Sprite({ src: IMG_MAP_SRC, position: { ...mapOrigin } }); // was: const IMG_MAP = new Image(); IMG_MAP.src = IMG_MAP_SRC;

    // new:
    const player = new Sprite({ src: IMG_PLAYER_SRC });

    // the player stays fixed at the canvas's center; the map scrolls under it later
    player.position = {
      x: CANVAS_WIDTH / 2 - player.image.width / 2,
      y: CANVAS_HEIGHT / 2 - player.image.height / 2,
    };

    function draw() { // was: ctx!.drawImage(IMG_MAP, mapOrigin.x, mapOrigin.y) only
      map.draw(ctx!);
      player.draw(ctx!);
    }

    let gameLoopId: number;
    // -- snip --
```

> [!WARNING]
> `{ ...mapOrigin }`, not `mapOrigin` directly — `Sprite`'s constructor
> doesn't clone `position`, so passing the object itself would make
> `map.position` and `mapOrigin` literally the same object. `mapOrigin` is
> meant to stay the fixed spawn coordinate; without the copy, scrolling the
> map later would silently mutate `mapOrigin` too.

> [!WARNING]
> `player.image.width` is `0` until the image finishes loading — fine for
> now since the game loop keeps redrawing every frame until it isn't `0`
> anymore; preloading assets (further down) is what makes this reliable on a
> slow connection.

> [!NOTE]
> Land, with the player centered on screen — not ocean, not the top-left
> corner.

## Get React Out of the Way

Two entities, a loop, and centering math already live as loose variables
in one `useEffect`. Everything from here on adds more — input, movement,
animation, collision. Group the _data_ into one file and the _behavior_
into another now, while there's only a handful of lines to move, so
nothing bigger ever needs relocating again.

### Step 6: Split into `GAME_STATE` (data) and `GameEngine` (behavior)

**File:** `src/features/game-state.ts` — everything that _exists_:

<!-- prettier-ignore -->
```ts
import IMG_MAP_SRC from "@/assets/img/pallet-town.png";
import IMG_PLAYER_SRC from "@/assets/img/playerDown.png";
import { Sprite } from "@/features/sprite";

export const mapOrigin = { x: -780, y: -720 }; // (0, 0) on this map is open ocean

export const GAME_STATE = {
  map: new Sprite({ src: IMG_MAP_SRC, position: { ...mapOrigin } }),
  player: new Sprite({ src: IMG_PLAYER_SRC }),
};
```

**File:** `src/features/game-engine.ts` — everything that _happens_:

<!-- prettier-ignore -->
```ts
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/game-settings";
import { GAME_STATE } from "@/features/game-state";

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private gameLoopId = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not supported");
    this.ctx = ctx;

    GAME_STATE.player.position = {
      x: CANVAS_WIDTH / 2 - GAME_STATE.player.image.width / 2,
      y: CANVAS_HEIGHT / 2 - GAME_STATE.player.image.height / 2,
    };
  }

  start() {
    this.gameLoopId = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.gameLoopId);
  }

  private tick = () => {
    this.gameLoopId = requestAnimationFrame(this.tick);
    this.draw();
  };

  private draw() {
    GAME_STATE.map.draw(this.ctx);
    GAME_STATE.player.draw(this.ctx);
  }
}
```

**File:** `src/app/layout.tsx` — shrinks to just mounting it:

<!-- prettier-ignore -->
```tsx
import { GameEngine } from "@/features/game-engine";
import { useEffect, useRef } from "react";

export default function Layout() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new GameEngine(canvasRef.current);
    game.start();
    return () => game.stop();
  }, []);

  return <canvas ref={canvasRef}></canvas>;
}
```

> [!NOTE]
> Exact same game on screen as before this step — nothing changed on
> screen, only where the code lives.

> [!TIP]
> Also fixes hot-reload pain: React's Fast Refresh deliberately never
> re-runs an already-mounted effect (so it can't accidentally duplicate a
> running timer). With no game logic left inside `useEffect`, editing
> `game-engine.ts` now gets a normal instant reload instead of a manual
> browser refresh.

## Make It Move

### Step 7: Track which key is held

**File:** `src/features/game-state.ts` — key state is data, so it lives
here, not inside `Controller`:

<!-- prettier-ignore -->
```ts
export const GAME_STATE = {
  // -- snip --
  keys: { w: false, a: false, s: false, d: false }, // new
};
```

**File:** `src/features/controller.ts` — `Controller` doesn't own `keys`,
it's handed a reference to `GAME_STATE`'s:

<!-- prettier-ignore -->
```ts
import { GAME_STATE } from "@/features/game-state";

export type Direction = "w" | "a" | "s" | "d";

// prettier-ignore
const KEY_TO_DIRECTION: Record<string, Direction> = {
  w: "w", ArrowUp: "w",
  a: "a", ArrowLeft: "a",
  s: "s", ArrowDown: "s",
  d: "d", ArrowRight: "d",
};

export class Controller {
  private readonly keys: (typeof GAME_STATE)["keys"];

  constructor(keys: (typeof GAME_STATE)["keys"]) {
    this.keys = keys;
  }

  keydown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIRECTION[e.key];
    if (dir) this.keys[dir] = true;
  };

  keyup = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIRECTION[e.key];
    if (dir) this.keys[dir] = false;
  };
}
```

**File:** `src/features/game-engine.ts` — own one, wire it to the window,
extend `stop()` to remove the listeners:

<!-- prettier-ignore -->
```ts
import { Controller } from "@/features/controller"; // new

export class GameEngine {
  // -- snip --
  private controller = new Controller(GAME_STATE.keys); // new

  // -- snip -- (constructor unchanged)

  start() {
    // new:
    window.addEventListener("keydown", this.controller.keydown);
    window.addEventListener("keyup", this.controller.keyup);
    this.gameLoopId = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.gameLoopId);
    // new:
    window.removeEventListener("keydown", this.controller.keydown);
    window.removeEventListener("keyup", this.controller.keyup);
  }
  // -- snip --
}
```

> [!TIP]
> `keys` lives on `GAME_STATE`, injected into `Controller` rather than
> owned by it — anything that can see `GAME_STATE` can read the current
> input directly. That's what lets scenes (later) check it themselves
> instead of `GameEngine` handing it to them as a parameter.

> [!WARNING]
> Every `addEventListener` needs a matching `removeEventListener`, or
> React StrictMode's dev-only double-mount stacks duplicates.

### Step 8: Scroll the map instead of moving the player

**File:** `src/features/game-engine.ts`

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private tick = () => { // replaced
    this.gameLoopId = requestAnimationFrame(this.tick);

    if (GAME_STATE.keys.w) GAME_STATE.map.position.y += 3; // map slides opposite the player's apparent direction
    if (GAME_STATE.keys.a) GAME_STATE.map.position.x += 3;
    if (GAME_STATE.keys.s) GAME_STATE.map.position.y -= 3;
    if (GAME_STATE.keys.d) GAME_STATE.map.position.x -= 3;

    this.draw();
  };

  // -- snip --
}
```

> [!NOTE]
> Hold an arrow key — map scrolls, player stays centered. Hold two at once
> (e.g. Up + Right) — diagonal movement. Smooth, but not wanted: the
> player's sprites only face 4 directions, no diagonal walk animation.

### Step 9: Resolve to a single direction, most-recent wins

**File:** `src/features/game-state.ts` — same shape change, since `keys`
lives here now:

<!-- prettier-ignore -->
```ts
import type { Direction } from "@/features/controller";

export const GAME_STATE = {
  // -- snip --
  keys: { pressed: [] as Direction[] }, // was: { w: false, a: false, s: false, d: false }
};
```

**File:** `src/features/controller.ts` — replace the flags with an ordered
array, most-recently-pressed goes last (`keys` itself is still just the
constructor-injected reference from Step 7, unchanged):

<!-- prettier-ignore -->
```ts
export class Controller {
  // -- snip -- (constructor unchanged)

  keydown = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIRECTION[e.key];
    if (!dir) return; // not a movement key, ignore
    const p = this.keys.pressed;
    const i = p.indexOf(dir);
    if (i !== -1) p.splice(i, 1); // already in the stack — remove old spot, avoid a dupe
    p.push(dir); // re-add at the end: most recent is always last
  };

  keyup = (e: KeyboardEvent) => {
    const dir = KEY_TO_DIRECTION[e.key];
    if (!dir) return;
    const i = this.keys.pressed.indexOf(dir);
    if (i !== -1) this.keys.pressed.splice(i, 1); // no longer held — drop it from the stack
  };
}
```

> [!TIP]
> `.pressed.at(-1)` is always "the most recent key that's _still_ held" —
> release the top one, and whatever's underneath is automatically what's left.

**File:** `src/features/game-engine.ts` — update `tick()` to read it
instead of the old booleans. Note it reads `GAME_STATE.keys` directly, not
`this.controller.keys` — `keys` is private on `Controller` now, only
`GAME_STATE` is the shared reference:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private tick = () => { // replaced
    this.gameLoopId = requestAnimationFrame(this.tick);

    const direction = GAME_STATE.keys.pressed.at(-1); // new

    if (direction === "w") GAME_STATE.map.position.y += 3; // was: if (GAME_STATE.keys.w) ..., same for the other 3
    else if (direction === "a") GAME_STATE.map.position.x += 3;
    else if (direction === "s") GAME_STATE.map.position.y -= 3;
    else if (direction === "d") GAME_STATE.map.position.x -= 3;

    this.draw();
  };

  // -- snip --
}
```

> [!NOTE]
> Hold Right, then also Up — snaps to just Up. Release Up — falls back to
> Right, doesn't stop.

### Step 10: Clear input when the window loses focus

Alt-tab away while holding a key and the browser never fires `keyup` for
it — the window lost focus, no key events reach it. That key stays stuck
"held" forever, so the character keeps walking on its own when you return.

**File:** `src/features/controller.ts`

<!-- prettier-ignore -->
```ts
export class Controller {
  // -- snip -- (constructor unchanged)

  blur = () => { // new
    this.keys.pressed.length = 0;
  };
}
```

**File:** `src/features/game-engine.ts` — wire it to the window, alongside
the existing listeners:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  start() {
    window.addEventListener("keydown", this.controller.keydown);
    window.addEventListener("keyup", this.controller.keyup);
    window.addEventListener("blur", this.controller.blur); // new
    this.gameLoopId = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.gameLoopId);
    window.removeEventListener("keydown", this.controller.keydown);
    window.removeEventListener("keyup", this.controller.keyup);
    window.removeEventListener("blur", this.controller.blur); // new
  }

  // -- snip --
}
```

> [!NOTE]
> Hold a key, switch tabs or apps, come back — the player should be
> standing still, not still walking.

## Animate the Walk Cycle

### Step 11: Animate the spritesheet

Player PNGs are 192×68px — four 48×68 poses side by side. `drawImage`'s
9-arg form crops one pose and paints it; sliding the crop's x-offset is the
animation — throttled, not every tick, or it blurs.

**File:** `src/features/sprite.ts`

<!-- prettier-ignore -->
```ts
interface SpriteFrames {
  max?: number;     // poses in the sheet
  val?: number;     // current pose index
  elapsed?: number; // ticks since last advance
  hold?: number;    // ticks to wait before advancing
}
```

The whole `Sprite` class, replacing the simpler version above — `frames`
is new on the interface and constructor; `width`/`height`/`step()` are new;
`draw()` is replaced:

<!-- prettier-ignore -->
```ts
interface SpriteProps {
  src: string;
  position?: Position;
  frames?: SpriteFrames; // new
}

export class Sprite {
  image: HTMLImageElement;
  position: Position;
  frames: Required<SpriteFrames>; // new — same 4 fields, now all mandatory

  constructor({ src, position = { x: 0, y: 0 }, frames = {} }: SpriteProps) {
    this.image = loadImage(src);
    this.position = position;
    this.frames = { max: 1, hold: 10, val: 0, elapsed: 0, ...frames }; // new
  }

  // new:
  get width() { return this.image.width / this.frames.max; }
  get height() { return this.image.height; }

  draw(ctx: CanvasRenderingContext2D) { // replaced
    const { x, y } = this.position;
    const sx = this.frames.val * this.width; // which pose to crop out

    ctx.drawImage(
      this.image,
      sx, 0, this.width, this.height, // crop this pose
      x, y, this.width, this.height,  // paint it here
    );
  }

  step() { // new
    if (this.frames.max <= 1) return;
    this.frames.elapsed++;
    if (this.frames.elapsed % this.frames.hold === 0) {
      this.frames.val = (this.frames.val + 1) % this.frames.max;
    }
  }
}
```

> [!TIP]
> `width`/`height` are getters, not cached fields — stay correct if
> `image` is swapped later (next step).

> [!NOTE]
> Call `player.step()` every tick — poses cycle continuously (gated to
> "only while moving" next step).

### Step 12: One sprite per direction, via a subclass

Only the player needs 4 direction sheets — doesn't belong on `Sprite`
(background has no direction to face). Subclass instead.

**File:** `src/features/sprite-player.ts`

<!-- prettier-ignore -->
```ts
import type { Direction } from "@/features/controller";
import { Sprite } from "@/features/sprite";
import type { Position } from "@/features/sprite";
import { loadImage } from "@/lib/load-image";

interface PlayerProps {
  position?: Position;
  sprites: Record<Direction, string>;
  facing?: Direction;
}

export class Player extends Sprite {
  private sprites: Record<Direction, HTMLImageElement>;

  constructor({ sprites, facing = "s", ...rest }: PlayerProps) {
    super({ src: sprites[facing], frames: { max: 4 }, ...rest });
    this.sprites = Object.fromEntries(
      Object.entries(sprites).map(([direction, src]) => [direction, loadImage(src)]),
    ) as Record<Direction, HTMLImageElement>;
  }

  face(direction: Direction) {
    this.image = this.sprites[direction];
    this.step();
  }
}
```

**File:** `src/features/game-state.ts` — load all 4 direction sheets, and
swap `player` from a `Sprite` to a `Player`:

<!-- prettier-ignore -->
```ts
import IMG_PLAYER_UP from "@/assets/img/playerUp.png";
import IMG_PLAYER_LEFT from "@/assets/img/playerLeft.png";
import IMG_PLAYER_DOWN from "@/assets/img/playerDown.png"; // was: IMG_PLAYER_SRC's lone import
import IMG_PLAYER_RIGHT from "@/assets/img/playerRight.png";
import type { Direction } from "@/features/controller";
import { Player } from "@/features/sprite-player";

const IMGS_PLAYER_SRC: Record<Direction, string> = {
  w: IMG_PLAYER_UP,
  a: IMG_PLAYER_LEFT,
  s: IMG_PLAYER_DOWN,
  d: IMG_PLAYER_RIGHT,
};

export const GAME_STATE = {
  map: new Sprite({ src: IMG_MAP_SRC, position: { ...mapOrigin } }),
  player: new Player({ sprites: IMGS_PLAYER_SRC }), // was: new Sprite({ src: IMG_PLAYER_SRC })
  // -- snip --
};
```

> [!WARNING]
> `player` must actually be a `Player` instance before `.face()` exists on
> it — a plain `Sprite` has no such method.

**File:** `src/features/game-engine.ts` — update `tick()`, face + animate
only while a key is held:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private tick = () => { // replaced
    this.gameLoopId = requestAnimationFrame(this.tick);

    const direction = GAME_STATE.keys.pressed.at(-1);

    // new:
    if (direction) GAME_STATE.player.face(direction);
    else GAME_STATE.player.frames.val = 0; // standing pose

    if (direction === "w") GAME_STATE.map.position.y += 3;
    // -- snip --

    this.draw();
  };

  // -- snip --
}
```

> [!NOTE]
> Walk in each direction — correct sheet shows, poses cycle only while
> moving.

> [!TIP]
> Base vs. subclass test: would _every_ `Sprite` need this field? Only the
> player needs `sprites` — so it's on `Player`.

## Walls You Can't Walk Through

### Step 13: Get collision data out of Tiled

**File:** `src/features/collisions.ts` — paste the array from the README's
Tiled export steps as-is:

<!-- prettier-ignore -->
```ts
const collisions = [
  0, 0, 0, 0, 0, /* ...continues for all 70×40 = 2800 tiles... */ 1025, 0, 0,
];
```

Not exported — only `createBoundaries`, added next step, ever reads it.

Row-major, 70 columns wide. `0` = walkable; `1025` = solid.

### Step 14: Turn solid tiles into real rectangles

A wall is just one use of a more general shape — a marked rectangular area
on the map. Give that shape its own class now, so it's reusable later for
things that aren't walls (a battle trigger, a sound trigger).

**File:** `src/features/zone.ts`

<!-- prettier-ignore -->
```ts
import { TILE_SIZE } from "@/constants/game-settings";
import type { Position } from "@/features/sprite";

interface ZoneProps {
  position: Position;
  width: number;
  height: number;
}

export class Zone {
  position: Position;
  width: number;
  height: number;

  constructor({ position, width, height }: ZoneProps) {
    this.position = position;
    this.width = width;
    this.height = height;
  }
}

interface CreateZonesProps {
  tiles: number[];
  matchValue: number;
  columns: number;
  /** the map's current scroll offset, not a single zone's position */
  origin: Position;
}

export function createZones({ tiles, matchValue, columns, origin }: CreateZonesProps): Zone[] {
  const zones: Zone[] = [];

  tiles.forEach((tile, index) => {
    if (tile !== matchValue) return;

    const col = index % columns;
    const row = Math.floor(index / columns);

    zones.push(new Zone({
      position: { x: TILE_SIZE * col + origin.x, y: TILE_SIZE * row + origin.y },
      width: TILE_SIZE,
      height: TILE_SIZE,
    }));
  });

  return zones;
}
```

> [!TIP]
> `width`/`height` are constructor params, not a fixed default — a wall is
> always one tile, but a future battle or sound zone might span several.
> `Zone` itself shouldn't assume a size.

**File:** `src/features/collisions.ts` — turn solid tiles into `Zone`s
right where the Tiled data already lives. Add this _above_ the `collisions`
array from the last step, not below it — keep the small, readable stuff up
top, the giant data blob out of the way at the bottom:

<!-- prettier-ignore -->
```ts
// new — goes at the top of the file, everything below stays below:
import { createZones } from "@/features/zone";
import type { Position } from "@/features/sprite";

const COLLISION_TILE = 1025;
const MAP_COLUMNS = 70;

export function createBoundaries(origin: Position) {
  return createZones({ tiles: collisions, matchValue: COLLISION_TILE, columns: MAP_COLUMNS, origin });
}

// -- snip -- (collisions array from Step 13 stays below, unchanged)
```

> [!WARNING]
> Get `MAP_COLUMNS` wrong (not your actual Tiled map width) and every
> boundary silently drifts off the real walls.

**File:** `src/features/game-state.ts` — add boundaries to `GAME_STATE`,
positioned from the same `mapOrigin` the map itself uses:

<!-- prettier-ignore -->
```ts
import { createBoundaries } from "@/features/collisions";

export const GAME_STATE = {
  // -- snip --
  boundaries: createBoundaries(mapOrigin), // new — must match the map's own origin
};
```

**File:** `src/features/game-engine.ts` — fold boundary movement into a
shared `move()`, replacing direct `map.position` mutation:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private move(dx: number, dy: number) { // new
    GAME_STATE.map.position.x += dx;
    GAME_STATE.map.position.y += dy;
    GAME_STATE.boundaries.forEach((b) => {
      b.position.x += dx;
      b.position.y += dy;
    });
  }

  // -- snip --
}
```

`tick()`, updated to route movement through it:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private tick = () => {
    // -- snip --

    if (direction === "w") this.move(0, 3); // was: GAME_STATE.map.position.y += 3, same for the other 3
    else if (direction === "a") this.move(3, 0);
    else if (direction === "s") this.move(0, -3);
    else if (direction === "d") this.move(-3, 0);

    // -- snip --
  };

  // -- snip --
}
```

> [!WARNING]
> Skip this and boundaries stay frozen at spawn while everything else
> moves — walls visibly detach within a few steps.

### Step 15: Check for a wall _before_ moving

**File:** `src/features/collisions.ts`

<!-- prettier-ignore -->
```ts
// -- snip -- (createBoundaries, from Step 14, stays above)
interface Rect { // new
  position: Position;
  width: number;
  height: number;
}

export function isColliding(a: Rect, b: Rect) {
  return (
    a.position.x < b.position.x + b.width &&
    a.position.x + a.width > b.position.x &&
    a.position.y < b.position.y + b.height &&
    a.position.y + a.height > b.position.y
  );
}
```

The player's on-screen position never changes (the camera trick from
earlier) — so "am I touching a wall _right now_" always gives the same
answer, no matter the key. Get this wrong and you freeze in every
direction, forever.

**File:** `src/features/game-engine.ts` — test the position **inverted** by
the direction you're about to move, before committing to it:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private attemptMove(dx: number, dy: number) { // new
    const box = {
      position: { x: GAME_STATE.player.position.x - dx, y: GAME_STATE.player.position.y - dy },
      width: GAME_STATE.player.width,
      height: GAME_STATE.player.height,
    };
    const blocked = GAME_STATE.boundaries.some((b) => isColliding(box, b));
    if (!blocked) this.move(dx, dy);
  }

  // -- snip --
}
```

> [!WARNING]
> Two mistakes that look fine but aren't: whole-spritesheet width instead
> of one pose's width (the animation step's getter already protects you
> here), and forgetting the inverted `-dx`/`-dy` — which collapses this into
> the frozen-forever check above.

`tick()`, updated to route through `attemptMove` instead of `move`:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private tick = () => {
    // -- snip --

    if (direction === "w") this.attemptMove(0, 3); // was: this.move(...), same for the other 3
    else if (direction === "a") this.attemptMove(3, 0);
    else if (direction === "s") this.attemptMove(0, -3);
    else if (direction === "d") this.attemptMove(-3, 0);

    // -- snip --
  };

  // -- snip --
}
```

> [!NOTE]
> Walk into a wall from all 4 sides — stop right at the edge, every time;
> still free to walk away in any other direction.

## Layer a Foreground Over the Player

The map has objects taller than a tile — rooftops, tree canopies. Drawn
only as background, the player walks _in front of_ them even when standing
behind. A second image, drawn _after_ the player, fixes it.

### Step 16: Add a foreground layer

**File:** `src/features/game-state.ts` — load the foreground image, add it
to `GAME_STATE` at the same origin as the map:

<!-- prettier-ignore -->
```ts
import IMG_MAP_FG_SRC from "@/assets/img/pallet-town-foreground.png";

export const GAME_STATE = {
  // -- snip --
  foreground: new Sprite({ src: IMG_MAP_FG_SRC, position: { ...mapOrigin } }), // new
  // -- snip --
};
```

**File:** `src/features/game-engine.ts` — draw it _after_ the player:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private draw() {
    GAME_STATE.map.draw(this.ctx);
    GAME_STATE.player.draw(this.ctx);
    GAME_STATE.foreground.draw(this.ctx); // new
  }

  // -- snip --
}
```

It also has to scroll with the map, same as boundaries — fold it into `move()`:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private move(dx: number, dy: number) {
    GAME_STATE.map.position.x += dx;
    GAME_STATE.map.position.y += dy;

    // new:
    GAME_STATE.foreground.position.x += dx;
    GAME_STATE.foreground.position.y += dy;

    GAME_STATE.boundaries.forEach((b) => {
      b.position.x += dx;
      b.position.y += dy;
    });
  }

  // -- snip --
}
```

> [!WARNING]
> Skip the `move()` update and the foreground stays frozen at spawn while
> the map scrolls — the exact same detachment bug boundaries had.

> [!NOTE]
> Stand behind a rooftop or tree canopy — it should now draw in front of
> the player instead of the player drawing on top of it.

## Make It Feel Right

### Step 17: Movement shouldn't depend on frame rate

`requestAnimationFrame` fires at whatever rate the display refreshes —
60Hz, 120Hz, 144Hz. A flat `3` px/tick moves faster on faster monitors.
Track elapsed time between frames instead, and give the player a real,
named speed instead of a magic number buried in the loop — it's a property
of the player, not of the engine.

**File:** `src/features/sprite-player.ts` — `moveSpeed` is new on the
interface, the field, and the constructor:

<!-- prettier-ignore -->
```ts
interface PlayerProps {
  position?: Position;
  sprites: Record<Direction, string>;
  facing?: Direction;
  moveSpeed?: number; // new
}

export class Player extends Sprite {
  private sprites: Record<Direction, HTMLImageElement>;
  moveSpeed: number; // new — pixels per second

  constructor({ sprites, facing = "s", moveSpeed = 200, ...rest }: PlayerProps) { // new: moveSpeed = 200
    super({ src: sprites[facing], frames: { max: 4 }, ...rest });
    this.sprites = Object.fromEntries(
      Object.entries(sprites).map(([direction, src]) => [direction, loadImage(src)]),
    ) as Record<Direction, HTMLImageElement>;
    this.moveSpeed = moveSpeed; // new
  }

  face(direction: Direction) {
    this.image = this.sprites[direction];
    this.step();
  }
}
```

`tick()` is now scheduling, timing, input, animation, _and_ movement in one
function. Split it: `tick()` keeps only scheduling and timing, everything
per-frame moves into a new `update(dt)`.

**File:** `src/features/game-engine.ts`

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --
  private lastTime = performance.now(); // new

  // -- snip --

  private tick = (time: number) => { // now takes the rAF timestamp
    this.gameLoopId = requestAnimationFrame(this.tick);
    const dt = (time - this.lastTime) / 1000; // seconds
    this.lastTime = time;

    this.update(dt); // new — everything below moved out of tick()
    this.draw();
  };

  private update(dt: number) { // new
    const direction = GAME_STATE.keys.pressed.at(-1);
    if (direction) GAME_STATE.player.face(direction);
    else GAME_STATE.player.frames.val = 0;

    const distance = GAME_STATE.player.moveSpeed * dt; // this frame's actual distance

    if (direction === "w") this.attemptMove(0, distance); // was: literal 3, same for the other 3
    else if (direction === "a") this.attemptMove(distance, 0);
    else if (direction === "s") this.attemptMove(0, -distance);
    else if (direction === "d") this.attemptMove(-distance, 0);
  }
  // -- snip --
}
```

> [!TIP]
> `distance` isn't the speed — it's this frame's share of it. Summed
> across a real second it adds up to `moveSpeed`, regardless of frame rate.

### Step 18: Don't start the loop before assets exist

Starting immediately after `.src` means the first frames can run against
`0×0` images — broken hitboxes, invisible sprites.

**File:** `src/lib/preload.ts`

<!-- prettier-ignore -->
```ts
export async function preload(images: HTMLImageElement[]) {
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => reject(new Error(`Failed to load: ${img.src}`)), { once: true });
    });
  }));
}
```

> [!WARNING]
> Reject on failure, don't silently resolve — a missing hero sprite should
> crash loudly, not quietly render broken.

**File:** `src/features/sprite-player.ts` — expose the loaded sprites so
`preload()` can wait on all 4, not just whichever one is currently facing:

<!-- prettier-ignore -->
```ts
export class Player extends Sprite {
  // -- snip --

  face(direction: Direction) {
    this.image = this.sprites[direction];
    this.step();
  }

  get images() { // new
    return Object.values(this.sprites);
  }
}
```

**File:** `src/features/game-state.ts`

<!-- prettier-ignore -->
```ts
import { preload } from "@/lib/preload"; // new

// -- snip -- (GAME_STATE unchanged)

export const assetsReady = preload([ // new
  GAME_STATE.map.image,
  GAME_STATE.foreground.image,
  ...GAME_STATE.player.images,
]);
```

**File:** `src/features/game-engine.ts` — gate `start()` on it, and guard
against React StrictMode's dev-only mount→cleanup→mount cycle (a
slow-loading image could otherwise let `start()`'s promise resolve _after_
`stop()` already ran, leaking an uncancellable loop):

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --
  private cancelled = false; // new

  // -- snip -- (constructor unchanged)

  start() { // replaced — was: ...blur); this.gameLoopId = requestAnimationFrame(this.tick); }
    window.addEventListener("keydown", this.controller.keydown);
    window.addEventListener("keyup", this.controller.keyup);
    window.addEventListener("blur", this.controller.blur);

    // the old synchronous `this.gameLoopId = requestAnimationFrame(this.tick);` is GONE —
    // it now only happens inside this gate, or the loop starts before assets exist
    assetsReady.then(() => {
      if (this.cancelled) return;
      this.gameLoopId = requestAnimationFrame(this.tick);
    });
  }

  stop() {
    this.cancelled = true; // new
    cancelAnimationFrame(this.gameLoopId);
    window.removeEventListener("keydown", this.controller.keydown);
    window.removeEventListener("keyup", this.controller.keyup);
    window.removeEventListener("blur", this.controller.blur);
  }
  // -- snip --
}
```

> [!NOTE]
> Throttle network in devtools, reload — game waits, then starts clean.
> Never a flash of missing sprites.

## Detect the Player Entering a Zone

Not every game needs this — Flappy Bird, Snake, Pong don't. It's here
because this one's RPG-shaped, and `Zone` was already built reusable for
exactly this: a second Tiled layer, checked with a deeper overlap than
`isColliding`'s any-touch test.

### Step 19: Compute how much two rects overlap

**File:** `src/features/collisions.ts`

<!-- prettier-ignore -->
```ts
// -- snip -- (isColliding, from Step 15, stays above)
export function getOverlapArea(a: Rect, b: Rect): number { // new
  const overlap = getOverlapRect(a, b);
  return overlap ? overlap.width * overlap.height : 0;
}

function getOverlapRect(a: Rect, b: Rect): Rect | null {
  const edgesA = { x2: a.position.x + a.width, y2: a.position.y + a.height };
  const edgesB = { x2: b.position.x + b.width, y2: b.position.y + b.height };

  const left = Math.max(a.position.x, b.position.x);
  const top = Math.max(a.position.y, b.position.y);
  const right = Math.min(edgesA.x2, edgesB.x2);
  const bottom = Math.min(edgesA.y2, edgesB.y2);

  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) return null; // no overlap on at least one axis

  return { position: { x: left, y: top }, width, height } satisfies Rect;
}
```

Visually, `left`/`top`/`right`/`bottom` are just whichever edge of `a` or
`b` is furthest "inward" on each side:

```
   x --- increase to right -->
   y
   |   a.position.(x&y) -->  +------------------2   <-- edgesA.x2
   |                         |        a         |
   v                         |            1-----+----+   <-- edgesB.x2
                             |            |     |    |
              edgesA.y2 -->  3------------+-----+    |
                                          |       b  |
                           edgesB.y2 -->  +----------+
```

- **1** = `left`/`top` — `Math.max(a.position.x, b.position.x)` and `Math.max(a.position.y, b.position.y)`
- **2** = `right` — `Math.min(edgesA.x2, edgesB.x2)`
- **3** = `bottom` — `Math.min(edgesA.y2, edgesB.y2)`

> [!TIP]
> `isColliding` answers yes/no — any touch counts, which is right for a
> wall. This answers _how much_, so entering a zone can require a deeper
> overlap than just brushing its edge.

### Step 20: Turn a second layer into zones, and trigger on deep overlap

**File:** `src/features/collisions.ts` — reuses `COLLISION_TILE`, since
it's the same marker tile painted on a different Tiled layer:

<!-- prettier-ignore -->
```ts
// -- snip -- (createBoundaries, COLLISION_TILE, MAP_COLUMNS from Step 14 stay above)
export function createBattleZones(origin: Position) { // new
  return createZones({ tiles: battleZones, matchValue: COLLISION_TILE, columns: MAP_COLUMNS, origin });
}

// prettier-ignore
const battleZones = [ // new
  0, 0, 0, 0, 0, /* ...continues for all 70×40 = 2800 tiles... */ 1025, 0, 0,
];
```

**File:** `src/features/game-state.ts`

<!-- prettier-ignore -->
```ts
import { createBattleZones } from "@/features/collisions";

export const GAME_STATE = {
  // -- snip --
  battleZones: createBattleZones(mapOrigin), // new
  // -- snip --
};
```

**File:** `src/features/game-engine.ts` — scroll it with everything else,
same as boundaries:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private move(dx: number, dy: number) {
    GAME_STATE.map.position.x += dx;
    GAME_STATE.map.position.y += dy;
    GAME_STATE.foreground.position.x += dx;
    GAME_STATE.foreground.position.y += dy;
    [GAME_STATE.boundaries, GAME_STATE.battleZones] // was: GAME_STATE.boundaries.forEach(...)
      .flat()
      .forEach((b) => {
        b.position.x += dx;
        b.position.y += dy;
      });
  }

  // -- snip --
}
```

Then check it in `attemptMove`, before the wall check:

<!-- prettier-ignore -->
```ts
export class GameEngine {
  // -- snip --

  private attemptMove(dx: number, dy: number) {
    const box = {
      position: { x: GAME_STATE.player.position.x - dx, y: GAME_STATE.player.position.y - dy },
      width: GAME_STATE.player.width,
      height: GAME_STATE.player.height,
    };

    const playerArea = box.width * box.height;
    const enteredZone = GAME_STATE.battleZones.some((z) => getOverlapArea(box, z) > playerArea / 2);
    if (enteredZone && Math.random() < 0.01) console.log("Battle Activation");

    const blocked = GAME_STATE.boundaries.some((b) => isColliding(box, b));
    if (!blocked) this.move(dx, dy);
  }

  // -- snip --
}
```

> [!TIP]
> The `> playerArea / 2` threshold means at least half the player's box
> has to be inside the zone before it counts — grazing the edge of a
> battle tile won't trigger it every frame.

> [!NOTE]
> Walk into the marked tiles and watch the console — "Battle Activation"
> should fire roughly 1 in 100 steps once you're mostly inside, never at
> the edge.

## Split Behavior by Scene

Not every game needs this either — it only matters once entering a battle
should actually change what's on screen. Right now `GAME_STATE.sceneName`
flips to `"battle"` and nothing happens. Giving each scene its own
`update`/`draw` pair, instead of branching on `GAME_STATE.sceneName` inside
`GameEngine`, means adding a real battle screen later is one new file, not
a growing pile of `if` checks.

### Step 21: Define what a scene is

**File:** `src/features/scene.ts`

<!-- prettier-ignore -->
```ts
export type SceneName = "overworld" | "battle";

export interface Scene {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}
```

> [!TIP]
> `SceneName` is a plain string, not the scene object itself — so a scene
> can switch to another one by name (`GAME_STATE.sceneName = "battle"`)
> without importing that other scene's file.

### Step 22: Track which scene is active

**File:** `src/features/game-state.ts` — add to `GAME_STATE`:

<!-- prettier-ignore -->
```ts
import type { SceneName } from "@/features/scene";

export const GAME_STATE = {
  // -- snip --
  sceneName: "overworld" as SceneName, // new
};
```

### Step 23: Move the overworld's behavior into its own scene

**File:** `src/features/scenes/overworld.ts` — everything `update()`,
`draw()`, `move()`, and `attemptMove()` did inside `GameEngine`, unchanged
except there's no more `this`:

<!-- prettier-ignore -->
```ts
import { getOverlapArea, isColliding } from "@/features/collisions";
import { GAME_STATE } from "@/features/game-state";
import type { Scene } from "@/features/scene";

export const overworldScene: Scene = {
  update(dt) {
    const direction = GAME_STATE.keys.pressed.at(-1);
    if (direction) GAME_STATE.player.face(direction);
    else GAME_STATE.player.frames.val = 0;

    const distance = GAME_STATE.player.moveSpeed * dt;

    if (direction === "w") attemptMove(0, distance);
    else if (direction === "a") attemptMove(distance, 0);
    else if (direction === "s") attemptMove(0, -distance);
    else if (direction === "d") attemptMove(-distance, 0);
  },

  draw(ctx) {
    GAME_STATE.map.draw(ctx);
    GAME_STATE.player.draw(ctx);
    GAME_STATE.foreground.draw(ctx);
  },
};

function move(dx: number, dy: number) {
  GAME_STATE.map.position.x += dx;
  GAME_STATE.map.position.y += dy;
  GAME_STATE.foreground.position.x += dx;
  GAME_STATE.foreground.position.y += dy;
  [GAME_STATE.boundaries, GAME_STATE.battleZones]
    .flat()
    .forEach((b) => {
      b.position.x += dx;
      b.position.y += dy;
    });
}

function attemptMove(dx: number, dy: number) {
  const box = {
    position: { x: GAME_STATE.player.position.x - dx, y: GAME_STATE.player.position.y - dy },
    width: GAME_STATE.player.width,
    height: GAME_STATE.player.height,
  };

  const playerArea = box.width * box.height;
  const enteredZone = GAME_STATE.battleZones.some((z) => getOverlapArea(box, z) > playerArea / 2);
  if (enteredZone && Math.random() < 0.01) GAME_STATE.sceneName = "battle"; // was: console.log("Battle Activation")

  const blocked = GAME_STATE.boundaries.some((b) => isColliding(box, b));
  if (!blocked) move(dx, dy);
}
```

### Step 24: Add a battle scene

**File:** `src/features/scenes/battle.ts` — stub for now:

<!-- prettier-ignore -->
```ts
import type { Scene } from "@/features/scene";

export const battleScene: Scene = {
  update() {},
  draw() {},
};
```

> [!NOTE]
> Empty on purpose. Since nothing draws over it, the canvas just keeps
> showing whatever `overworldScene` last drew, frozen — the base a fade
> transition needs.

### Step 25: Let `GameEngine` dispatch to the active scene

**File:** `src/features/game-engine.ts` — delete `update()`, `draw()`,
`move()`, and `attemptMove()` entirely — they moved to `overworld.ts`. Add
a scene registry, and simplify `tick()` to read from it:

<!-- prettier-ignore -->
```ts
import type { Scene, SceneName } from "@/features/scene";
import { battleScene } from "@/features/scenes/battle";
import { overworldScene } from "@/features/scenes/overworld";

const SCENES: Record<SceneName, Scene> = {
  overworld: overworldScene,
  battle: battleScene,
};

export class GameEngine {
  // -- snip --

  private tick = (time: number) => {
    this.gameLoopId = requestAnimationFrame(this.tick);
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    const scene = SCENES[GAME_STATE.sceneName];
    scene.update(dt);
    scene.draw(this.ctx);
  };
  // -- snip --
}
```

> [!WARNING]
> `update()`, `draw()`, `move()`, and `attemptMove()` no longer belong on
> `GameEngine` — delete them, don't leave unused copies sitting next to
> the new `tick()`.

> [!NOTE]
> Same game as before this step — nothing should look or behave
> differently yet. `GAME_STATE.sceneName` switching to `"battle"` does nothing
> visible until a later step gives `battleScene` something to draw.

## Fade Between Scenes

An instant cut between scenes is jarring. A brief fade to black hides the
swap. Each scene owns its own fade timing — a gentle overworld doesn't
force every future scene into the same pacing.

### Step 26: A fade that's just a black overlay with a timer

**File:** `src/lib/canvas/fade-transition.ts`

<!-- prettier-ignore -->
```ts
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/game-settings";

export type FadePhase = "idle" | "show" | "hide";

export class FadeTransition {
  private showDuration = 0;
  private hideDuration = 0;
  private elapsed = 0;
  phase: FadePhase = "idle";

  start(showDuration: number, hideDuration: number) {
    this.showDuration = showDuration;
    this.hideDuration = hideDuration;
    this.phase = "show";
    this.elapsed = 0;
  }

  update(dt: number) {
    if (this.phase === "idle") return;

    const duration = this.phase === "show" ? this.showDuration : this.hideDuration;
    this.elapsed += dt;
    if (this.elapsed < duration) return;

    this.elapsed = 0;
    this.phase = this.phase === "show" ? "hide" : "idle"; // fixed order: show → hide → idle
  }

  get alpha() {
    if (this.phase === "idle") return 0;
    const duration = this.phase === "show" ? this.showDuration : this.hideDuration;
    if (duration <= 0) return this.phase === "show" ? 1 : 0;
    const progress = Math.min(this.elapsed / duration, 1);
    return this.phase === "show" ? progress : 1 - progress;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    ctx.fillStyle = `rgba(0, 0, 0, ${this.alpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

export const FADE = new FadeTransition();
```

> [!TIP]
> `show`/`hide` describe the black overlay itself, not either scene —
> `show` means it's becoming opaque (covering the screen), `hide` means
> it's becoming transparent (revealing whatever's now underneath). Every
> transition runs the same fixed order: `show` → `hide` → `idle`.

### Step 27: Let a scene declare when it ends and how it fades

**File:** `src/features/scene.ts`

<!-- prettier-ignore -->
```ts
interface SceneBase {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  /** This scene's own reveal duration, in seconds; unset = instant. */
  fadeIn?: number;
  /** This scene's own exit duration, in seconds; unset = instant. */
  fadeOut?: number;
}

// duration and next are set together, or not at all — never just one
type SceneTransition =
  | { duration: number; next: SceneName }
  | { duration?: never; next?: never };

export type Scene = SceneBase & SceneTransition; // was: export interface Scene { update...; draw...; }
```

> [!TIP]
> `fadeIn`/`fadeOut` belong to the scene they describe — a gentle overworld
> and a snappy battle can each set only what they need, and any pairing
> between them just works without a lookup table.

> [!WARNING]
> `duration`/`next` are NOT two independent optionals — a scene with a
> `duration` but no `next` would auto-expire into nothing. The union forces
> both or neither, so a check like `scene.duration !== undefined` also
> narrows `scene.next` to a guaranteed `SceneName` right where Step 30 needs
> it — no separate null-check, no runtime crash if someone sets one without
> the other.

### Step 28: Give each scene its own fade timing

**File:** `src/features/scenes/overworld.ts` — gentle both ways; the
trigger itself doesn't change, it never touches `FADE` at all:

<!-- prettier-ignore -->
```ts
export const overworldScene: Scene = {
  // new:
  fadeIn: 1,
  fadeOut: 1,

  // -- snip -- (update, draw unchanged)
};

// -- snip -- (move, attemptMove — declared below the object, unchanged)
```

**File:** `src/features/scenes/battle.ts` — unchanged from before; leaving
`fadeIn`/`fadeOut` unset means instant, both ways:

<!-- prettier-ignore -->
```ts
export const battleScene: Scene = {
  // new:
  duration: 5,
  next: "overworld",

  update() {},
  draw() {},
};
```

> [!NOTE]
> `5` is a placeholder so there's something to test — a real battle ends
> on a win or loss, not a clock. Swap this out once that logic exists.

### Step 29: Give the battle scene something to reveal

**File:** `src/features/game-state.ts`

<!-- prettier-ignore -->
```ts
import IMG_BATTLE_BG_SRC from "@/assets/img/battleBackground.png";

export const GAME_STATE = {
  // -- snip --
  battleBackground: new Sprite({ src: IMG_BATTLE_BG_SRC }), // new
  // -- snip --
};

export const assetsReady = preload([
  GAME_STATE.map.image,
  GAME_STATE.foreground.image,
  GAME_STATE.battleBackground.image, // new
  ...GAME_STATE.player.images,
]);
```

**File:** `src/features/scenes/battle.ts`

<!-- prettier-ignore -->
```ts
import { GAME_STATE } from "@/features/game-state";

export const battleScene: Scene = {
  duration: 5,
  next: "overworld",

  update() {},

  draw(ctx) { // new
    GAME_STATE.battleBackground.draw(ctx);
  },
};
```

### Step 30: Tie it together in the game loop

**File:** `src/features/game-state.ts` — one more field, alongside `scene`:

<!-- prettier-ignore -->
```ts
export const GAME_STATE = {
  // -- snip --
  sceneName: "overworld" as SceneName,
  sceneElapsed: 0, // new
};
```

**File:** `src/features/game-engine.ts` — resolves both scenes' own fade
values and switches to the new scene:

<!-- prettier-ignore -->
```ts
// -- snip -- (SCENES, from Step 25, stays above)
function enterScene(from: SceneName, to: SceneName) { // new
  const showDuration = SCENES[from].fadeOut ?? 0;
  const hideDuration = SCENES[to].fadeIn ?? 0;
  GAME_STATE.sceneName = to;
  GAME_STATE.sceneElapsed = 0;
  FADE.start(showDuration, hideDuration);
}

export class GameEngine {
  // -- snip --
  private lastSceneName: SceneName = GAME_STATE.sceneName; // new

  // -- snip -- (tick() updated below)
}
```

> [!WARNING]
> `lastSceneName` must be a field that survives across ticks — not a local
> variable re-captured fresh at the top of `tick()` each frame. A scene can
> also change from _outside_ the game loop entirely (e.g. a button in React),
> between two animation frames. A per-tick local always equals whatever's
> current the instant that tick starts, so it can never see a change that
> already happened before the tick began. A persisted field still holds the
> _old_ value going into the next tick, which is what lets the comparison
> below actually catch it.

`tick()` calls it wherever `GAME_STATE.sceneName` would otherwise just be
assigned directly — once because a scene changed itself, once because a
scene's own `duration` ran out:

<!-- prettier-ignore -->
```ts
import { FADE } from "@/lib/canvas/fade-transition"; // new

export class GameEngine {
  // -- snip --

  private tick = (time: number) => {
    this.gameLoopId = requestAnimationFrame(this.tick);
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    const scene = SCENES[GAME_STATE.sceneName]; // was: const sceneName = GAME_STATE.sceneName; const scene = SCENES[sceneName];
    scene.update(dt);

    // new:
    GAME_STATE.sceneElapsed += dt;

    const sceneChanged = GAME_STATE.sceneName !== this.lastSceneName; // was: !== sceneName
    const sceneExpired = scene.duration !== undefined && GAME_STATE.sceneElapsed >= scene.duration;

    if (sceneChanged) enterScene(this.lastSceneName, GAME_STATE.sceneName); // was: enterScene(sceneName, ...)
    else if (sceneExpired) enterScene(this.lastSceneName, scene.next); // was: enterScene(sceneName, ...)

    this.lastSceneName = GAME_STATE.sceneName; // new

    FADE.update(dt);

    if (FADE.phase !== "show") scene.draw(this.ctx); // was: scene.draw(this.ctx) unconditionally

    FADE.draw(this.ctx); // new
  };

  // -- snip --
}
```

> [!WARNING]
> Skip the `FADE.phase !== "show"` check and the incoming scene's `draw()`
> starts painting the instant `GAME_STATE.sceneName` changes — one frame after
> the trigger, not once the screen is actually covered. Its content bleeds
> through the still-transparent overlay before the swap is hidden.

> [!NOTE]
> Walk into a battle zone — overworld fades to black over a second,
> reveals the battle background instantly, holds five seconds, cuts to
> black instantly, then fades the overworld back in over a second.

## Where You Landed

A `GAME_STATE`/`GameEngine` split introduced early and never revisited in
one big move: one file for what exists, one for what happens, growing by
one field or method at a time. A canvas game loop decoupled from frame
rate; a reusable `Sprite` with spritesheet animation; a `Player` subclass
with 4-directional facing; input that survives multiple keys held at once
and resets cleanly on alt-tab; real Tiled-driven wall collision; a
foreground layer so tall objects correctly draw in front of the player;
zone-entry detection reusing the same `Zone` shape for a second, non-wall
Tiled layer; behavior split into scenes, each owning its own
`update`/`draw`, so `GameEngine` stays a dispatcher instead of a growing
pile of `if` checks as more scenes get added; a reusable fade transition
tying scene switches together, with scenes able to declare their own
auto-expiry.

Compare your version against the real thing:

- [`sprite.ts`](../src/features/sprite.ts) / [`sprite-player.ts`](../src/features/sprite-player.ts)
- [`controller.ts`](../src/features/controller.ts)
- [`zone.ts`](../src/features/zone.ts) / [`collisions.ts`](../src/features/collisions.ts)
- [`scene.ts`](../src/features/scene.ts) / [`scenes/overworld.ts`](../src/features/scenes/overworld.ts) / [`scenes/battle.ts`](../src/features/scenes/battle.ts)
- [`game-state.ts`](../src/features/game-state.ts) / [`game-engine.ts`](../src/features/game-engine.ts)
- [`fade-transition.ts`](../src/lib/canvas/fade-transition.ts) / [`preload.ts`](../src/lib/preload.ts) / [`load-image.ts`](../src/lib/load-image.ts)
- [`layout.tsx`](../src/app/layout.tsx)
