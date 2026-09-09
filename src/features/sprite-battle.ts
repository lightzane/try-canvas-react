import { Sprite } from "@/features/sprite";
import gsap from "gsap";

interface BattleSpriteProps {
  name: string;
  src: string;
  position?: { x: number; y: number };
}

interface AttackParams {
  receipient: BattleSprite;
}

export class BattleSprite extends Sprite {
  name: string;
  attacking = false;
  health = 100;
  damage = 10;
  /** Overwrite this to be notified when `health` actually changes (e.g. `sprite.onChange = () => {...}`). */
  onChange: () => void = () => {};

  constructor({ name, src, position }: BattleSpriteProps) {
    super({ src, position, frames: { max: 4 } });
    this.name = name;
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    this.onChange();
  }

  attack({ receipient }: AttackParams) {
    if (this.attacking) return;
    this.attacking = true;

    const tl = gsap.timeline({
      onComplete: () => {
        this.attacking = false;
        receipient.takeDamage(this.damage);
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
}
