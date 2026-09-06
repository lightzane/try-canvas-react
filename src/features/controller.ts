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
    // bind so `this` stays correct when passed as a bare reference to addEventListener
    this.keydown = this.keydown.bind(this);
    this.keyup = this.keyup.bind(this);
  }

  keydown(e: KeyboardEvent) {
    const direction = KEY_TO_DIRECTION[e.key];
    if (!direction) return;

    const pressed = this.keys.pressed;
    const existing = pressed.indexOf(direction);
    if (existing !== -1) pressed.splice(existing, 1);

    pressed.push(direction); // most recent
  }

  keyup(e: KeyboardEvent) {
    const direction = KEY_TO_DIRECTION[e.key];
    if (!direction) return;

    const pressed = this.keys.pressed;
    const existing = pressed.indexOf(direction);
    if (existing !== -1) pressed.splice(existing, 1);
  }

  blur() {
    if (!this.keys) return;
    this.keys.pressed.length = 0;
  }
}
