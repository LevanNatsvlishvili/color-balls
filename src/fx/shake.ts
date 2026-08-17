// Screen shake effect on the game container.

import gsap from 'gsap';
import type { Container } from 'pixi.js';

export interface Shake {
  trigger(): void;
}

const AMPLITUDE = 6;
const DURATION = 0.12;

export function createShake(target: Container): Shake {
  let tween: gsap.core.Tween | null = null;
  const punch = { t: 0 };

  function trigger(): void {
    tween?.kill();
    punch.t = 0;
    target.position.set(0, 0);

    tween = gsap.to(punch, {
      t: 1,
      duration: DURATION,
      ease: 'power2.out',
      onUpdate: () => {
        const mag = AMPLITUDE * (1 - punch.t);
        target.x = mag * (punch.t * 17 % 2 < 1 ? 1 : -1);
        target.y = mag * (punch.t * 11 % 2 < 1 ? -1 : 1);
      },
      onComplete: () => {
        target.position.set(0, 0);
        tween = null;
      },
    });
  }

  return { trigger };
}
