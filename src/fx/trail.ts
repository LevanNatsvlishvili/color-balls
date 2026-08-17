// Motion trail ring buffer behind the ball.

import { Container, Graphics } from 'pixi.js';
import { BALL_RADIUS, COLOR_HEX, type BallColor } from '../game/ball';
import { project, type Projected } from '../game/track';

export interface Trail {
  readonly container: Container;
  update(deltaMS: number, color: BallColor, viewW: number, viewH: number): void;
}

const TRAIL_COUNT = 12;
const SAMPLE_MS = 24;
const T_STEP = 0.028;
const GHOST_RADIUS = BALL_RADIUS * 0.7;

interface Ghost {
  graphic: Graphics;
  color: BallColor;
}

export function createTrail(): Trail {
  const container = new Container();
  container.eventMode = 'none';

  const ghosts: Ghost[] = [];
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const graphic = new Graphics().circle(0, 0, GHOST_RADIUS).fill({ color: 0xffffff });
    graphic.eventMode = 'none';
    graphic.alpha = 0;
    container.addChild(graphic);
    ghosts.push({ graphic, color: 'magenta' });
  }

  let writeIndex = 0;
  let sampleAcc = 0;
  const scratch: Projected = { x: 0, y: 0, scale: 0 };

  function sample(color: BallColor): void {
    ghosts[writeIndex].color = color;
    writeIndex = (writeIndex + 1) % TRAIL_COUNT;
  }

  function update(deltaMS: number, color: BallColor, viewW: number, viewH: number): void {
    sampleAcc += deltaMS;
    if (sampleAcc > SAMPLE_MS * TRAIL_COUNT) sampleAcc = SAMPLE_MS * TRAIL_COUNT;
    while (sampleAcc >= SAMPLE_MS) {
      sampleAcc -= SAMPLE_MS;
      sample(color);
    }

    for (let i = 0; i < TRAIL_COUNT; i++) {
      const age = i + 1;
      const slot = (writeIndex - age + TRAIL_COUNT) % TRAIL_COUNT;
      const ghost = ghosts[slot];
      const frac = 1 - i / TRAIL_COUNT;

      project(1 - age * T_STEP, 0, viewW, viewH, scratch);
      ghost.graphic.position.set(scratch.x, scratch.y);
      ghost.graphic.scale.set(scratch.scale * (0.28 + frac * 0.55));
      ghost.graphic.alpha = 0.06 + frac * 0.38;
      ghost.graphic.tint = COLOR_HEX[ghost.color];
    }
  }

  return { container, update };
}
