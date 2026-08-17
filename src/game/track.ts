// Fake-3D track rendering and perspective projection math.

import { Container, Graphics } from 'pixi.js';

export type Lane = -1 | 0 | 1;

export interface Projected {
  x: number;
  y: number;
  scale: number;
}

export interface Track {
  readonly container: Container;
  /** Scroll chevrons from a monotonic clock (ms). Do not pass runProgress — it resets per gate. */
  update(distanceTraveled: number): void;
}

/** Lane coordinate of the asphalt edges. Lane centers live at -1, 0, 1. */
export const TRACK_EDGE_LANE = 1.5;

const HORIZON_Y_RATIO = 0.32;
const NEAR_Y_RATIO = 0.86;
const FAR_HALF_WIDTH_RATIO = 0.04;
const NEAR_HALF_WIDTH_RATIO = 0.42;
const MIN_SCALE = 0.15;
const MAX_SCALE = 1.0;
const DEPTH_POWER = 2.4;

const WORLD_FILL = 0x0c0c14;
const TRACK_FILL = 0x1a1a2a;
const SHOULDER_FILL = 0x2a2a40;
const LANE_LINE_FILL = 0xc8cce8;
const CHEVRON_STROKE = 0x9aa0c8;

const CHEVRON_CYCLE_MS = 1600;
const CHEVRON_ROWS = 8;
const LANES: readonly Lane[] = [-1, 0, 1];

interface Chevron {
  graphic: Graphics;
  baseT: number;
  lane: Lane;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Projects a normalized track position into screen space.
 * t=0 is the far vanishing point (spawn), t=1 is the near ball row (gate resolve).
 * Depth is power-eased (not linear) so approach visually accelerates like real perspective.
 * `lane` is typically -1 / 0 / 1; fractional values are valid (edges, dividers).
 */
export function project(t: number, lane: number, viewW: number, viewH: number, out?: Projected): Projected {
  const depth = Math.pow(clamp01(t), DEPTH_POWER);
  const y = lerp(viewH * HORIZON_Y_RATIO, viewH * NEAR_Y_RATIO, depth);
  const halfWidth = lerp(viewW * FAR_HALF_WIDTH_RATIO, viewW * NEAR_HALF_WIDTH_RATIO, depth);
  const x = viewW / 2 + lane * halfWidth;
  const scale = lerp(MIN_SCALE, MAX_SCALE, depth);

  if (out) {
    out.x = x;
    out.y = y;
    out.scale = scale;
    return out;
  }
  return { x, y, scale };
}

function addStrip(g: Graphics, viewW: number, viewH: number, laneA: number, laneB: number, color: number, alpha = 1): void {
  const farA = project(0, laneA, viewW, viewH);
  const farB = project(0, laneB, viewW, viewH);
  const nearB = project(1, laneB, viewW, viewH);
  const nearA = project(1, laneA, viewW, viewH);
  g.poly([farA.x, farA.y, farB.x, farB.y, nearB.x, nearB.y, nearA.x, nearA.y]).fill({ color, alpha });
}

function drawChevron(g: Graphics): void {
  g.moveTo(-18, 8).lineTo(0, -12).lineTo(18, 8).stroke({
    width: 5,
    color: CHEVRON_STROKE,
    cap: 'round',
    join: 'round',
  });
}

export function createTrack(viewW: number, viewH: number): Track {
  const container = new Container();
  container.eventMode = 'none';

  const staticGraphics = new Graphics();
  staticGraphics.rect(0, 0, viewW, viewH).fill({ color: WORLD_FILL });
  addStrip(staticGraphics, viewW, viewH, -TRACK_EDGE_LANE, TRACK_EDGE_LANE, TRACK_FILL);
  addStrip(staticGraphics, viewW, viewH, -TRACK_EDGE_LANE, -1.32, SHOULDER_FILL);
  addStrip(staticGraphics, viewW, viewH, 1.32, TRACK_EDGE_LANE, SHOULDER_FILL);
  addStrip(staticGraphics, viewW, viewH, -0.54, -0.46, LANE_LINE_FILL, 0.35);
  addStrip(staticGraphics, viewW, viewH, 0.46, 0.54, LANE_LINE_FILL, 0.35);
  container.addChild(staticGraphics);

  const chevrons: Chevron[] = [];
  const chevronLayer = new Container();
  chevronLayer.eventMode = 'none';
  container.addChild(chevronLayer);

  for (let row = 0; row < CHEVRON_ROWS; row++) {
    const baseT = row / CHEVRON_ROWS;
    for (const lane of LANES) {
      const graphic = new Graphics();
      drawChevron(graphic);
      graphic.eventMode = 'none';
      chevronLayer.addChild(graphic);
      chevrons.push({ graphic, baseT, lane });
    }
  }

  const scratch: Projected = { x: 0, y: 0, scale: 0 };

  function update(distanceTraveled: number): void {
    const scrollT = (distanceTraveled / CHEVRON_CYCLE_MS) % 1;

    for (let i = 0; i < chevrons.length; i++) {
      const chevron = chevrons[i];
      const t = (chevron.baseT + scrollT) % 1;
      project(t, chevron.lane, viewW, viewH, scratch);

      const graphic = chevron.graphic;
      graphic.position.set(scratch.x, scratch.y);
      graphic.scale.set(scratch.scale);
      // Fade in from the horizon and out at the ball row so they don't pop.
      const fadeIn = Math.min(1, t * 5);
      const fadeOut = Math.min(1, (1 - t) * 8);
      graphic.alpha = 0.5 * fadeIn * fadeOut;
    }
  }

  update(0);

  return { container, update };
}
