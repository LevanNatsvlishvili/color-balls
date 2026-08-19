// Ball sprite, lane movement, squash-stretch, and shield bubble.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { project, type Lane } from './track';

export const BALL_HEX = 0x9d4edd;
export const BALL_RADIUS = 54;

const SQUASH_DURATION = 0.18;
const LANE_SLIDE_DURATION = 0.14;
const SHIELD_RADIUS = BALL_RADIUS + 16;
const SHIELD_PULSE_DURATION = 1.5;
const SHIELD_SHARD_COUNT = 12;
const SHIELD_SHARD_DURATION = 0.45;

export interface Ball {
  readonly container: Container;
  readonly lane: Lane;
  readonly hasShield: boolean;
  setLane(lane: Lane): void;
  shatter(): void;
}

export function createBall(viewW: number, viewH: number, initialLane: Lane): Ball {
  const container = new Container();
  container.eventMode = 'none';

  const squash = new Container();
  squash.eventMode = 'none';

  const shield = new Container();
  shield.eventMode = 'none';

  const bubble = new Graphics()
    .circle(0, 0, SHIELD_RADIUS)
    .fill({ color: 0xc084fc, alpha: 0.16 })
    .stroke({ width: 7, color: 0xe9d5ff, alpha: 0.85 });
  bubble.blendMode = 'add';
  bubble.eventMode = 'none';

  const bubbleCore = new Graphics().circle(0, 0, SHIELD_RADIUS * 0.72).fill({ color: 0xffffff, alpha: 0.07 });
  bubbleCore.blendMode = 'add';
  bubbleCore.eventMode = 'none';

  shield.addChild(bubbleCore, bubble);

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
  container.addChild(shield, squash);

  const shards: Graphics[] = [];
  for (let i = 0; i < SHIELD_SHARD_COUNT; i++) {
    const graphic = new Graphics().poly([-9, 12, 9, 12, 0, -14]).fill({ color: 0xffffff });
    graphic.tint = 0xe9d5ff;
    graphic.visible = false;
    graphic.eventMode = 'none';
    graphic.blendMode = 'add';
    container.addChild(graphic);
    shards.push(graphic);
  }

  // The ball never leaves the near plane, so its three lane stops are constants.
  const laneX = [
    project(1, -1, viewW, viewH).x,
    project(1, 0, viewW, viewH).x,
    project(1, 1, viewW, viewH).x,
  ];

  let lane: Lane = initialLane;
  let hasShield = true;
  const pose = project(1, initialLane, viewW, viewH);
  container.position.set(pose.x, pose.y);

  gsap.to(shield.scale, {
    x: 1.08,
    y: 1.08,
    duration: SHIELD_PULSE_DURATION / 2,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });
  gsap.to(shield, {
    alpha: 0.72,
    duration: SHIELD_PULSE_DURATION / 2,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });

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

  function shatter(): void {
    if (!hasShield) return;
    hasShield = false;

    gsap.killTweensOf(shield);
    gsap.killTweensOf(shield.scale);
    shield.alpha = 0;
    shield.visible = false;

    for (let i = 0; i < SHIELD_SHARD_COUNT; i++) {
      const graphic = shards[i];
      gsap.killTweensOf(graphic);
      gsap.killTweensOf(graphic.scale);

      const angle = (i / SHIELD_SHARD_COUNT) * Math.PI * 2;
      const dist = 70 + (i % 3) * 24;

      graphic.visible = true;
      graphic.alpha = 0.95;
      graphic.rotation = angle;
      graphic.position.set(0, 0);
      graphic.scale.set(1);

      gsap.to(graphic, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        alpha: 0,
        rotation: angle + 1.6,
        duration: SHIELD_SHARD_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          graphic.visible = false;
        },
      });
      gsap.to(graphic.scale, { x: 0.25, y: 0.25, duration: SHIELD_SHARD_DURATION, ease: 'power2.out' });
    }
  }

  return {
    container,
    get lane() {
      return lane;
    },
    get hasShield() {
      return hasShield;
    },
    setLane,
    shatter,
  };
}
