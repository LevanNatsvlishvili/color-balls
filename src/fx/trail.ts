// Motion trail ring buffer behind the ball.

import { Container, Graphics } from 'pixi.js';
import { BALL_HEX, BALL_RADIUS } from '../game/ball';
import { project } from '../game/track';

export interface Trail {
  readonly container: Container;
  update(deltaMS: number, ballX: number): void;
}

const TRAIL_COUNT = 12;
const SAMPLE_MS = 24;
const T_STEP = 0.028;
const GHOST_RADIUS = BALL_RADIUS * 0.7;

export function createTrail(viewW: number, viewH: number): Trail {
  const container = new Container();
  container.eventMode = 'none';

  // Each ghost owns a fixed depth slot, so its y, scale, alpha and tint are all
  // constants. Only x moves, and only when the ball changes lane — per-frame
  // work stays at TRAIL_COUNT position writes, and none at all while straight.
  const graphics: Graphics[] = [];
  const laneUnits: number[] = [];

  const centerX = project(1, 0, viewW, viewH).x;
  const nearLaneUnit = project(1, 1, viewW, viewH).x - centerX;

  for (let i = 0; i < TRAIL_COUNT; i++) {
    const age = i + 1;
    const frac = 1 - i / TRAIL_COUNT;
    const t = 1 - age * T_STEP;
    const pose = project(t, 0, viewW, viewH);

    const graphic = new Graphics().circle(0, 0, GHOST_RADIUS).fill({ color: 0xffffff });
    graphic.eventMode = 'none';
    graphic.tint = BALL_HEX;
    graphic.position.set(pose.x, pose.y);
    graphic.scale.set(pose.scale * (0.28 + frac * 0.55));
    graphic.alpha = 0.06 + frac * 0.38;

    container.addChild(graphic);
    graphics.push(graphic);
    // Width of one lane unit at this depth — narrower further from the camera,
    // so a trail left mid-swipe converges toward the vanishing point correctly.
    laneUnits.push(project(t, 1, viewW, viewH).x - pose.x);
  }

  // Ring buffer of sampled ball x; index 0 of the read order is the newest.
  const samples: number[] = new Array<number>(TRAIL_COUNT).fill(centerX);
  let writeIndex = 0;
  let sampleAcc = 0;
  let dirty = true;

  function applyPositions(): void {
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const slot = (writeIndex - i - 1 + TRAIL_COUNT) % TRAIL_COUNT;
      const offset = (samples[slot] - centerX) / nearLaneUnit;
      graphics[i].x = centerX + offset * laneUnits[i];
    }
    dirty = false;
  }

  function update(deltaMS: number, ballX: number): void {
    sampleAcc += deltaMS;
    // Clamp so a long pause (backgrounded ad) doesn't spin the ring buffer.
    if (sampleAcc > SAMPLE_MS * TRAIL_COUNT) sampleAcc = SAMPLE_MS * TRAIL_COUNT;

    while (sampleAcc >= SAMPLE_MS) {
      sampleAcc -= SAMPLE_MS;
      samples[writeIndex] = ballX;
      writeIndex = (writeIndex + 1) % TRAIL_COUNT;
      dirty = true;
    }

    if (dirty) applyPositions();
  }

  applyPositions();

  return { container, update };
}
