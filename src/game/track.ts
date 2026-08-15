// Fake-3D track rendering and perspective projection math.

export type Lane = -1 | 0 | 1;

export interface Projected {
  x: number;
  y: number;
  scale: number;
}

const HORIZON_Y_RATIO = 0.32;
const NEAR_Y_RATIO = 0.86;
const FAR_HALF_WIDTH_RATIO = 0.04;
const NEAR_HALF_WIDTH_RATIO = 0.42;
const MIN_SCALE = 0.15;
const MAX_SCALE = 1.0;
const DEPTH_POWER = 2.4;

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
 */
export function project(t: number, lane: Lane, viewW: number, viewH: number, out?: Projected): Projected {
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
