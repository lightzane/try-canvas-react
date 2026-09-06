# Canvas Game Dev: Zero to Hero

Build a top-down walking game on an HTML canvas. React only mounts the
`<canvas>`.

**Assumes:** `pnpm dev` runs (see [README](../README.md)); Tiled assets
already exist under [`src/assets/img`](../src/assets/img).

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

**File:** `src/app/layout.tsx` — inside the effect, after `canvas.height = CANVAS_HEIGHT;`:

<!-- prettier-ignore -->
```ts
import IMG_MAP_SRC from "@/assets/img/pallet-town.png";

const mapOrigin = { x: -780, y: -720 }; // (0, 0) on this map is open ocean — start over land instead

const IMG_MAP = new Image();
IMG_MAP.src = IMG_MAP_SRC; // an imported module value, not a raw path — Vite fingerprints this on build

IMG_MAP.onload = () => {
  ctx.drawImage(IMG_MAP, mapOrigin.x, mapOrigin.y);
};
```

> [!WARNING]
> Must wait for `onload` — `drawImage` before load paints nothing.

> [!NOTE]
> Reload — you should see land (grass/trees), not open ocean.

## The Game Loop

### Step 3: Repaint continuously

**File:** `src/app/layout.tsx` — same effect:

<!-- prettier-ignore -->
```ts
function draw() {
  ctx.drawImage(IMG_MAP, mapOrigin.x, mapOrigin.y);
}

let gameLoopId: number;
function tick() {
  gameLoopId = requestAnimationFrame(tick); // reschedule FIRST
  draw();
}
tick();

return () => cancelAnimationFrame(gameLoopId);
```

> [!TIP]
> Reschedule before this frame's work — a slow/throwing frame can't block
> the next one.

> [!NOTE]
> Add `console.log("tick")` — ~60 lines/sec in console.

## The `Sprite` Class

### Step 4: Generalize "draw an image at a position"

**File:** `src/features/sprite.ts`

<!-- prettier-ignore -->
```ts
export type Position = { x: number; y: number }; // reused everywhere something needs an x/y

interface SpriteProps {
  image: HTMLImageElement;
  position?: Position;
}

export class Sprite {
  image: HTMLImageElement;
  position: Position;

  constructor({ image, position = { x: 0, y: 0 } }: SpriteProps) {
    this.image = image;
    this.position = position;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.image, this.position.x, this.position.y);
  }
}
```

### Step 5: Add the player as a second sprite

**File:** `src/app/layout.tsx` — same effect:

<!-- prettier-ignore -->
```ts
import IMG_PLAYER_SRC from "@/assets/img/playerDown.png";

const IMG_PLAYER = new Image();
IMG_PLAYER.src = IMG_PLAYER_SRC;

const map = new Sprite({ image: IMG_MAP, position: { ...mapOrigin } }); // was: no position (defaulted to 0,0)
const player = new Sprite({ image: IMG_PLAYER });

// the player stays fixed at the canvas's center; the map scrolls under it later
player.position = {
  x: CANVAS_WIDTH / 2 - player.image.width / 2,
  y: CANVAS_HEIGHT / 2 - player.image.height / 2,
};

function draw() {
  map.draw(ctx);
  player.draw(ctx);
}
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

const IMG_MAP = new Image();
IMG_MAP.src = IMG_MAP_SRC;

const IMG_PLAYER = new Image();
IMG_PLAYER.src = IMG_PLAYER_SRC;

export const GAME_STATE = {
  map: new Sprite({ image: IMG_MAP, position: { ...mapOrigin } }),
  player: new Sprite({ image: IMG_PLAYER }),
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

**File:** `src/features/controller.ts`

<!-- prettier-ignore -->
```ts
export type Direction = "w" | "a" | "s" | "d";

const KEY_TO_DIRECTION: Record<string, Direction> = {
  w: "w", ArrowUp: "w",
  a: "a", ArrowLeft: "a",
  s: "s", ArrowDown: "s",
  d: "d", ArrowRight: "d",
};

export class Controller {
  keys = { w: false, a: false, s: false, d: false };

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
export class GameEngine {
  // -- snip --
  private controller = new Controller(); // new

  // -- snip -- (constructor unchanged)

  start() {
    window.addEventListener("keydown", this.controller.keydown); // new
    window.addEventListener("keyup", this.controller.keyup);     // new
    this.gameLoopId = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.gameLoopId);
    window.removeEventListener("keydown", this.controller.keydown); // new
    window.removeEventListener("keyup", this.controller.keyup);     // new
  }
  // -- snip --
}
```

> [!WARNING]
> Every `addEventListener` needs a matching `removeEventListener`, or
> React StrictMode's dev-only double-mount stacks duplicates.

### Step 8: Scroll the map instead of moving the player

**File:** `src/features/game-engine.ts` — update `tick()`:

<!-- prettier-ignore -->
```ts
private tick = () => {
  this.gameLoopId = requestAnimationFrame(this.tick);

  if (this.controller.keys.w) GAME_STATE.map.position.y += 3; // map slides opposite the player's apparent direction
  if (this.controller.keys.a) GAME_STATE.map.position.x += 3;
  if (this.controller.keys.s) GAME_STATE.map.position.y -= 3;
  if (this.controller.keys.d) GAME_STATE.map.position.x -= 3;

  this.draw();
};
```

> [!NOTE]
> Hold an arrow key — map scrolls, player stays centered. Hold two at once
> (e.g. Up + Right) — diagonal movement. Smooth, but not wanted: the
> player's sprites only face 4 directions, no diagonal walk animation.

### Step 9: Resolve to a single direction, most-recent wins

**File:** `src/features/controller.ts` — replace the flags with an ordered
array, most-recently-pressed goes last:

<!-- prettier-ignore -->
```ts
export class Controller {
  keys = { pressed: [] as Direction[] };

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
instead of the old booleans:

<!-- prettier-ignore -->
```ts
private tick = () => {
  this.gameLoopId = requestAnimationFrame(this.tick);

  const direction = this.controller.keys.pressed.at(-1); // new

  if (direction === "w") GAME_STATE.map.position.y += 3;
  else if (direction === "a") GAME_STATE.map.position.x += 3;
  else if (direction === "s") GAME_STATE.map.position.y -= 3;
  else if (direction === "d") GAME_STATE.map.position.x -= 3;

  this.draw();
};
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
  keys = { pressed: [] as Direction[] };
  // -- snip --

  blur = () => { // new
    this.keys.pressed.length = 0;
  };
}
```

**File:** `src/features/game-engine.ts` — wire it to the window, alongside
the existing listeners:

<!-- prettier-ignore -->
```ts
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
  image: HTMLImageElement;
  position?: Position;
  frames?: SpriteFrames; // new
}

export class Sprite {
  image: HTMLImageElement;
  position: Position;
  frames: Required<SpriteFrames>; // new — same 4 fields, now all mandatory

  constructor({ image, position = { x: 0, y: 0 }, frames = {} }: SpriteProps) {
    this.image = image;
    this.position = position;
    this.frames = { max: 1, hold: 10, val: 0, elapsed: 0, ...frames }; // new
  }

  get width() { return this.image.width / this.frames.max; } // new
  get height() { return this.image.height; }                 // new

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
interface PlayerProps {
  position?: Position;
  sprites: Record<Direction, HTMLImageElement>;
  facing?: Direction;
}

export class Player extends Sprite {
  private sprites: PlayerProps["sprites"];

  constructor({ sprites, facing = "s", ...rest }: PlayerProps) {
    super({ image: sprites[facing], frames: { max: 4 }, ...rest });
    this.sprites = sprites;
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

const sprites = Object.fromEntries(
  Object.entries(IMGS_PLAYER_SRC).map(([direction, src]) => {
    const image = new Image();
    image.src = src;
    return [direction, image];
  }),
) as Record<Direction, HTMLImageElement>;

export const GAME_STATE = {
  map: new Sprite({ image: IMG_MAP, position: { ...mapOrigin } }),
  player: new Player({ sprites }), // was: new Sprite({ image: IMG_PLAYER })
};
```

> [!WARNING]
> `player` must actually be a `Player` instance before `.face()` exists on
> it — a plain `Sprite` has no such method.

**File:** `src/features/game-engine.ts` — update `tick()`, face + animate
only while a key is held:

<!-- prettier-ignore -->
```ts
private tick = () => {
  this.gameLoopId = requestAnimationFrame(this.tick);

  const direction = this.controller.keys.pressed.at(-1);
  if (direction) GAME_STATE.player.face(direction);       // new
  else GAME_STATE.player.frames.val = 0; // standing pose // new

  if (direction === "w") GAME_STATE.map.position.y += 3;
  // -- snip --

  this.draw();
};
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

Not exported — only `createBoundaries`, in the same file, ever reads it.

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
import { createZones } from "@/features/zone";
import type { Position } from "@/features/sprite";

const COLLISION_TILE = 1025;
const MAP_COLUMNS = 70;

export function createBoundaries(origin: Position) {
  return createZones({ tiles: collisions, matchValue: COLLISION_TILE, columns: MAP_COLUMNS, origin });
}
```

> [!WARNING]
> Get `MAP_COLUMNS` wrong (not your actual Tiled map width) and every
> boundary silently drifts off the real walls.

**File:** `src/features/game-state.ts` — add boundaries to `GAME_STATE`,
positioned from the same `mapOrigin` the map itself uses:

<!-- prettier-ignore -->
```ts
export const GAME_STATE = {
  map: new Sprite({ image: IMG_MAP, position: { ...mapOrigin } }),
  player: new Player({ sprites }),
  boundaries: createBoundaries(mapOrigin), // new — must match the map's own origin
};
```

**File:** `src/features/game-engine.ts` — fold boundary movement into a
shared `move()`, replacing direct `map.position` mutation:

<!-- prettier-ignore -->
```ts
private move(dx: number, dy: number) {
  GAME_STATE.map.position.x += dx;
  GAME_STATE.map.position.y += dy;
  GAME_STATE.boundaries.forEach((b) => {
    b.position.x += dx;
    b.position.y += dy;
  });
}
```

`tick()`, updated to route movement through it:

<!-- prettier-ignore -->
```ts
private tick = () => {
  // -- snip --

  if (direction === "w") this.move(0, 3); // was: GAME_STATE.map.position.y += 3, same for the other 3
  else if (direction === "a") this.move(3, 0);
  else if (direction === "s") this.move(0, -3);
  else if (direction === "d") this.move(-3, 0);

  // -- snip --
};
```

> [!WARNING]
> Skip this and boundaries stay frozen at spawn while everything else
> moves — walls visibly detach within a few steps.

### Step 15: Check for a wall _before_ moving

**File:** `src/features/collisions.ts`

<!-- prettier-ignore -->
```ts
import type { Position } from "@/features/sprite";

interface Rect {
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
private attemptMove(dx: number, dy: number) {
  const box = {
    position: { x: GAME_STATE.player.position.x - dx, y: GAME_STATE.player.position.y - dy },
    width: GAME_STATE.player.width,
    height: GAME_STATE.player.height,
  };
  const blocked = GAME_STATE.boundaries.some((b) => isColliding(box, b));
  if (!blocked) this.move(dx, dy);
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
private tick = () => {
  // -- snip --

  if (direction === "w") this.attemptMove(0, 3); // was: this.move(...), same for the other 3
  else if (direction === "a") this.attemptMove(3, 0);
  else if (direction === "s") this.attemptMove(0, -3);
  else if (direction === "d") this.attemptMove(-3, 0);

  // -- snip --
};
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

const IMG_MAP_FG = new Image();
IMG_MAP_FG.src = IMG_MAP_FG_SRC;

export const GAME_STATE = {
  map: new Sprite({ image: IMG_MAP, position: { ...mapOrigin } }),
  foreground: new Sprite({ image: IMG_MAP_FG, position: { ...mapOrigin } }), // new
  player: new Player({ sprites }),
  boundaries: createBoundaries(mapOrigin),
};
```

**File:** `src/features/game-engine.ts` — draw it _after_ the player:

<!-- prettier-ignore -->
```ts
private draw() {
  GAME_STATE.map.draw(this.ctx);
  GAME_STATE.player.draw(this.ctx);
  GAME_STATE.foreground.draw(this.ctx); // new
}
```

It also has to scroll with the map, same as boundaries — fold it into `move()`:

<!-- prettier-ignore -->
```ts
private move(dx: number, dy: number) {
  GAME_STATE.map.position.x += dx;
  GAME_STATE.map.position.y += dy;
  GAME_STATE.foreground.position.x += dx; // new
  GAME_STATE.foreground.position.y += dy; // new
  GAME_STATE.boundaries.forEach((b) => {
    b.position.x += dx;
    b.position.y += dy;
  });
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
  sprites: Record<Direction, HTMLImageElement>;
  facing?: Direction;
  moveSpeed?: number; // new
}

export class Player extends Sprite {
  private sprites: PlayerProps["sprites"];
  moveSpeed: number; // new — pixels per second

  constructor({ sprites, facing = "s", moveSpeed = 200, ...rest }: PlayerProps) { // new: moveSpeed = 200
    super({ image: sprites[facing], frames: { max: 4 }, ...rest });
    this.sprites = sprites;
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
    const direction = this.controller.keys.pressed.at(-1);
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

**File:** `src/features/game-state.ts` — export a promise covering every
loaded image:

<!-- prettier-ignore -->
```ts
import { preload } from "@/lib/preload";

export const assetsReady = preload([IMG_MAP, IMG_MAP_FG, ...Object.values(sprites)]);
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

  start() {
    window.addEventListener("keydown", this.controller.keydown);
    window.addEventListener("keyup", this.controller.keyup);

    assetsReady.then(() => { // new
      if (this.cancelled) return;
      this.gameLoopId = requestAnimationFrame(this.tick);
    });
  }

  stop() {
    this.cancelled = true; // new
    cancelAnimationFrame(this.gameLoopId);
    window.removeEventListener("keydown", this.controller.keydown);
    window.removeEventListener("keyup", this.controller.keyup);
  }
  // -- snip --
}
```

> [!NOTE]
> Throttle network in devtools, reload — game waits, then starts clean.
> Never a flash of missing sprites.

## Where You Landed

A `GAME_STATE`/`GameEngine` split introduced early and never revisited in
one big move: one file for what exists, one for what happens, growing by
one field or method at a time. A canvas game loop decoupled from frame
rate; a reusable `Sprite` with spritesheet animation; a `Player` subclass
with 4-directional facing; input that survives multiple keys held at once
and resets cleanly on alt-tab; real Tiled-driven wall collision; a
foreground layer so tall objects correctly draw in front of the player.

Compare your version against the real thing:

- [`sprite.ts`](../src/features/sprite.ts) / [`sprite-player.ts`](../src/features/sprite-player.ts)
- [`controller.ts`](../src/features/controller.ts)
- [`zone.ts`](../src/features/zone.ts) / [`collisions.ts`](../src/features/collisions.ts)
- [`game-state.ts`](../src/features/game-state.ts) / [`game-engine.ts`](../src/features/game-engine.ts)
- [`preload.ts`](../src/lib/preload.ts)
- [`layout.tsx`](../src/app/layout.tsx)
