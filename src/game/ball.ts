// Ball sprite, lane movement, and squash-stretch animation.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { project, type Lane } from './track';

export const BALL_HEX = 0x9d4edd;
export const BALL_RADIUS = 54;

const SQUASH_DURATION = 0.18;
const LANE_SLIDE_DURATION = 0.14;

export interface Ball {
  readonly container: Container;
  readonly lane: Lane;
  setLane(lane: Lane): void;
}

export function createBall(viewW: number, viewH: number, initialLane: Lane): Ball {
  const container = new Container();
  container.eventMode = 'none';

  const squash = new Container();
  squash.eventMode = 'none';

  // Radial-gradient fake: tinted body + offset specular highlight.
  const body = new Graphics()
    .circle(0, 0, BALL_RADIUS)
    .fill({ color: 0xffffff })
    .stroke({ width: 4, color: 0x000000, alpha: 0.22 });
  body.tint = BALL_HEX;

  const highlight = new Graphics()
    .circle(-BALL_RADIUS * 0.28, -BALL_RADIUS * 0.32, BALL_RADIUS * 0.38)
    .fill({ color: 0xffffff, alpha: 0.42 });
  highlight.blendMode = 'add';

  squash.addChild(body, highlight);
  container.addChild(squash);

  // The ball never leaves the near plane, so its three lane stops are constants.
  const laneX = [
    project(1, -1, viewW, viewH).x,
    project(1, 0, viewW, viewH).x,
    project(1, 1, viewW, viewH).x,
  ];

  let lane: Lane = initialLane;
  const pose = project(1, initialLane, viewW, viewH);
  container.position.set(pose.x, pose.y);

  function playSlideFx(): void {
    gsap.killTweensOf(squash.scale);
    squash.scale.set(1.25, 0.8);
    gsap.to(squash.scale, { x: 1, y: 1, duration: SQUASH_DURATION, ease: 'back.out' });
  }

  function setLane(next: Lane): void {
    if (next === lane) return;
    lane = next;
    gsap.killTweensOf(container);
    gsap.to(container, { x: laneX[lane + 1], duration: LANE_SLIDE_DURATION, ease: 'power2.out' });
    playSlideFx();
  }

  return {
    container,
    get lane() {
      return lane;
    },
    setLane,
  };
}
