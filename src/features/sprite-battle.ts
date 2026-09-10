import { GAME_STATE } from "@/features/game-state";
import { Sprite } from "@/features/sprite";
import { playSound } from "@/lib/audio";
import gsap from "gsap";

interface BattleSpriteProps {
  name: string;
  src: string;
  position?: { x: number; y: number };
}

interface AttackParams {
  name: "tackle" | "ember";
  receipient: BattleSprite;
}

// Global, not per-instance — any BattleSprite, however many exist or however
// they're created (a new enemy variant is just `new BattleSprite(...)`),
// notifies through this same channel. Nothing needs to know which sprites exist.
type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();

/** Subscribe to every `BattleSprite`'s changes, present and future. Returns an unsubscribe function. */
export function onBattleSpriteChange(listener: ChangeListener) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

function notifyBattleSpriteChange() {
  changeListeners.forEach((listener) => listener());
}

export class BattleSprite extends Sprite {
  name: string;
  attacking = false;
  health = 100;

  constructor({ name, src, position }: BattleSpriteProps) {
    super({ src, position, frames: { max: 4 } });
    this.name = name;
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    notifyBattleSpriteChange();

    if (this.health === 0) {
      gsap.to(this, {
        opacity: 0,
        duration: 0.5,
        onComplete() {
          GAME_STATE.battleComplete = true;
        },
      });
    }
  }

  attack({ name, receipient }: AttackParams) {
    if (this.attacking) return;
    this.attacking = true;

    if (name === "tackle") this.tackle(receipient);
    else if (name === "ember") this.ember(receipient);
  }

  private tackle(receipient: BattleSprite) {
    const tl = gsap.timeline({
      onComplete: () => {
        this.attacking = false;
        receipient.takeDamage(20);
      },
    });

    tl.to(this.position, {
      x: this.position.x - 20,
    })
      .to(this.position, {
        x: this.position.x + 40,
        duration: 0.1,
        onComplete: receive,
      })
      .to(this.position, {
        x: this.position.x,
      });

    function receive() {
      playSound("tackle");

      gsap.to(receipient.position, {
        x: receipient.position.x + 10,
        yoyo: true,
        repeat: 5,
        duration: 0.08,
      });

      gsap.to(receipient, {
        opacity: 0,
        yoyo: true,
        repeat: 5,
        duration: 0.08,
      });
    }
  }

  private ember(receipient: BattleSprite) {
    playSound("ember");

    const FLAME_COUNT = 3;
    const FLAME_SPACING = 50;
    const middleIndex = (FLAME_COUNT - 1) / 2;

    for (let i = 0; i < 3; i++) {
      const flame = new Sprite({
        src: GAME_STATE.assets.imgFxEmber,
        frames: { max: 4, val: i, hold: 5 },
        position: { ...this.position, x: this.position.x + 30 },
      });

      GAME_STATE.fx.push(flame);

      const { x, y } = receipient.position;

      gsap.to(flame.position, {
        x: x + (i - middleIndex) * FLAME_SPACING,
        y: y + (i === middleIndex ? receipient.height / 2 : receipient.height / 4),
        duration: 0.5,
        onComplete() {
          if (i < 2) return;
          done();
        },
      });
    }

    const onComplete = () => {
      receipient.takeDamage(90);
      this.attacking = false;
    };

    function done() {
      GAME_STATE.fx.length = 0;
      gsap.to(receipient, {
        opacity: 0,
        repeat: 5,
        yoyo: true,
        duration: 0.08,
        onComplete,
      });
    }
  }
}
