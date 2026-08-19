// Screen shake effect on the game container.

import gsap from 'gsap';
import type { Container } from 'pixi.js';

export type ShakeKind = 'pass' | 'crash' | 'fail';

export interface Shake {
  trigger(kind?: ShakeKind): void;
}

const PRESETS: Record<ShakeKind, { amplitude: number; duration: number }> = {
  pass: { amplitude: 6, duration: 0.12 },
  crash: { amplitude: 8, duration: 0.16 },
  fail: { amplitude: 14, duration: 0.22 },
};

export function createShake(target: Container): Shake {
  let tween: gsap.core.Tween | null = null;
  const punch = { t: 0 };

  function trigger(kind: ShakeKind = 'pass'): void {
    const preset = PRESETS[kind];
    tween?.kill();
    punch.t = 0;
    target.position.set(0, 0);

    tween = gsap.to(punch, {
      t: 1,
      duration: preset.duration,
      ease: 'power2.out',
      onUpdate: () => {
        const mag = preset.amplitude * (1 - punch.t);
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
