import { getOverlapArea, isColliding, type Rect } from "@/features/collisions";
import { GAME_STATE } from "@/features/game-state";
import type { Scene } from "@/features/scene";
import { fade } from "@/lib/canvas/fade-transition";

export const overworldScene: Scene = {
  update(dt) {
    const direction = GAME_STATE.keys.pressed.at(-1);
    if (direction) GAME_STATE.player.face(direction);
    else GAME_STATE.player.frames.val = 0; // standing position

    // [Frame rate] if NO delta time, this will be 200px/tick
    // which can be faster in other devices (e.g. 60Hz, 120Hz, 144Hz)
    //
    // Sync with [Time-based]
    // movement 200px/sec — multiply with delta time
    const distance = GAME_STATE.player.moveSpeed * dt;

    if (direction === "w") attemptMove(0, distance);
    else if (direction === "a") attemptMove(distance, 0);
    else if (direction === "s") attemptMove(0, -distance);
    else if (direction === "d") attemptMove(-distance, 0);
  },

  draw(ctx) {
    GAME_STATE.background.draw(ctx);
    // GAME_STATE.boundaries.forEach((b) => b.draw(ctx)); // for debugging and boundary visibility
    // GAME_STATE.battleZones.forEach((b) => b.draw(ctx)); // for debugging
    GAME_STATE.player.draw(ctx);
    GAME_STATE.foreground.draw(ctx);
  },
};

function move(dx: number, dy: number) {
  GAME_STATE.background.position.x += dx;
  GAME_STATE.background.position.y += dy;
  GAME_STATE.foreground.position.x += dx;
  GAME_STATE.foreground.position.y += dy;
  [GAME_STATE.boundaries, GAME_STATE.battleZones] //
    .flat()
    .forEach((b) => {
      b.position.x += dx;
      b.position.y += dy;
    });
}

function attemptMove(dx: number, dy: number) {
  const { position, width, height } = GAME_STATE.player;
  const playerBox: Rect = {
    width,
    height,
    position: {
      // the player is visually fixed, so test with inversed delta
      x: position.x + -dx,
      y: position.y + -dy,
    },
  };

  // Check zone/triggers
  overlapBattleZones(playerBox);

  const blocked = GAME_STATE.boundaries.some((b) => isColliding(playerBox, b));
  if (!blocked) move(dx, dy);
}

function overlapBattleZones(playerBox: Rect) {
  const playerArea = playerBox.width * playerBox.height;
  const offset = playerArea / 2;
  const isOverlap = GAME_STATE.battleZones.some((b) => getOverlapArea(playerBox, b) > offset);

  const battleChance = Math.random() < 0.01;
  if (isOverlap && battleChance) {
    GAME_STATE.scene = "battle";
    fade.start("out");
  }
}
