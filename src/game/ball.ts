// Ball sprite, color cycling, and squash-stretch animation.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { project } from './track';

export type BallColor = 'magenta' | 'cyan' | 'yellow';

export const COLORS: readonly BallColor[] = ['magenta', 'cyan', 'yellow'];

export const COLOR_HEX: Record<BallColor, number> = {
  magenta: 0xff2fd0,
  cyan: 0x2fe8ff,
  yellow: 0xfff42f,
};

export const BALL_RADIUS = 54;

const SQUASH_DURATION = 0.18;
const FLASH_DURATION = 0.22;

export interface Ball {
  readonly container: Container;
  readonly color: BallColor;
  setColor(color: BallColor): void;
}

export function cycleColor(current: BallColor, dir: 'left' | 'right'): BallColor {
  const index = COLORS.indexOf(current);
  const delta = dir === 'right' ? 1 : COLORS.length - 1;
  return COLORS[(index + delta) % COLORS.length];
}

export function createBall(viewW: number, viewH: number, initialColor: BallColor): Ball {
  const container = new Container();
  container.eventMode = 'none';

  const squash = new Container();
  squash.eventMode = 'none';

  // Radial-gradient fake: tinted body + offset specular highlight.
  const body = new Graphics()
    .circle(0, 0, BALL_RADIUS)
    .fill({ color: 0xffffff })
    .stroke({ width: 4, color: 0x000000, alpha: 0.22 });

  const highlight = new Graphics()
    .circle(-BALL_RADIUS * 0.28, -BALL_RADIUS * 0.32, BALL_RADIUS * 0.38)
    .fill({ color: 0xffffff, alpha: 0.42 });
  highlight.blendMode = 'add';

  squash.addChild(body, highlight);

  const ring = new Graphics().circle(0, 0, BALL_RADIUS + 6).stroke({
    width: 6,
    color: 0xffffff,
    cap: 'round',
  });
  ring.alpha = 0;
  ring.eventMode = 'none';

  container.addChild(squash, ring);

  const pose = project(1, 0, viewW, viewH);
  container.position.set(pose.x, pose.y);

  let color: BallColor = initialColor;
  body.tint = COLOR_HEX[color];

  function playSwitchFx(): void {
    gsap.killTweensOf(squash.scale);
    gsap.killTweensOf(ring);
    gsap.killTweensOf(ring.scale);

    squash.scale.set(1.25, 0.8);
    gsap.to(squash.scale, { x: 1, y: 1, duration: SQUASH_DURATION, ease: 'back.out' });

    ring.tint = COLOR_HEX[color];
    ring.alpha = 0.95;
    ring.scale.set(1);
    gsap.to(ring.scale, { x: 1.55, y: 1.55, duration: FLASH_DURATION, ease: 'power2.out' });
    gsap.to(ring, { alpha: 0, duration: FLASH_DURATION, ease: 'power2.out' });
  }

  function setColor(next: BallColor): void {
    if (next === color) return;
    color = next;
    body.tint = COLOR_HEX[color];
    playSwitchFx();
  }

  return {
    container,
    get color() {
      return color;
    },
    setColor,
  };
}
