// Motion trail ring buffer behind the ball.

import { Container, Graphics } from 'pixi.js';
import { BALL_RADIUS, COLOR_HEX, type BallColor } from '../game/ball';
import { project, type Projected } from '../game/track';

export interface Trail {
  readonly container: Container;
  update(deltaMS: number, color: BallColor): void;
}

const TRAIL_COUNT = 12;
const SAMPLE_MS = 24;
const T_STEP = 0.028;
const GHOST_RADIUS = BALL_RADIUS * 0.7;

export function createTrail(viewW: number, viewH: number): Trail {
  const container = new Container();
  container.eventMode = 'none';

  // Each ghost owns a fixed depth slot, so its pose is a constant — only the
  // colour flowing through it changes. Computing these once keeps the per-frame
  // work down to at most TRAIL_COUNT tint writes.
  const graphics: Graphics[] = [];
  const scratch: Projected = { x: 0, y: 0, scale: 0 };

  for (let i = 0; i < TRAIL_COUNT; i++) {
    const age = i + 1;
    const frac = 1 - i / TRAIL_COUNT;
    const graphic = new Graphics().circle(0, 0, GHOST_RADIUS).fill({ color: 0xffffff });
    graphic.eventMode = 'none';

    project(1 - age * T_STEP, 0, viewW, viewH, scratch);
    graphic.position.set(scratch.x, scratch.y);
    graphic.scale.set(scratch.scale * (0.28 + frac * 0.55));
    graphic.alpha = 0.06 + frac * 0.38;

    container.addChild(graphic);
    graphics.push(graphic);
  }

  // Ring buffer of sampled colours; index 0 of the read order is the newest.
  const samples: BallColor[] = new Array<BallColor>(TRAIL_COUNT).fill('magenta');
  let writeIndex = 0;
  let sampleAcc = 0;
  let dirty = true;

  function applyTints(): void {
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const slot = (writeIndex - i - 1 + TRAIL_COUNT) % TRAIL_COUNT;
      graphics[i].tint = COLOR_HEX[samples[slot]];
    }
    dirty = false;
  }

  function update(deltaMS: number, color: BallColor): void {
    sampleAcc += deltaMS;
    // Clamp so a long pause (backgrounded ad) doesn't spin the ring buffer.
    if (sampleAcc > SAMPLE_MS * TRAIL_COUNT) sampleAcc = SAMPLE_MS * TRAIL_COUNT;

    while (sampleAcc >= SAMPLE_MS) {
      sampleAcc -= SAMPLE_MS;
      samples[writeIndex] = color;
      writeIndex = (writeIndex + 1) % TRAIL_COUNT;
      dirty = true;
    }

    if (dirty) applyTints();
  }

  applyTints();

  return { container, update };
}
