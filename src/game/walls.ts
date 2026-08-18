// Wall entities, crash/pass reactions, and the difficulty ramp table.

import { Container, Graphics } from 'pixi.js';
import { project, TRACK_EDGE_LANE, type Lane, type Projected } from './track';

export interface WallConfig {
  /** 'single' = one lane open with the wall in one piece. 'split' = two segments, distinct silhouette. */
  type: 'single' | 'split';
  openLane: Lane;
  /** Extra time past first contact in which a late swipe still converts to a pass. */
  gapForgivenessMs: number;
  /** Time for runProgress to travel 0 -> 1, i.e. horizon to ball plane. */
  approachDurationMs: number;
  /** Breather between the previous wall resolving and this one starting its approach. */
  spacingMs: number;
}

/**
 * The entire difficulty ramp. Nothing in this file or the director hardcodes
 * per-wall tuning — it all lives here so R4 can iterate in one place.
 *
 * Wall 1's gap is dead-ahead: the ball starts centered, so it is a free pass
 * that teaches "gaps are passable" before anything can punish the player.
 * Approach ramps 2000 -> 1700ms (15% faster); walls 1-2 single, 3-5 split.
 */
export const WALLS: readonly WallConfig[] = [
  { type: 'single', openLane: 0, gapForgivenessMs: 220, approachDurationMs: 2000, spacingMs: 400 },
  { type: 'single', openLane: -1, gapForgivenessMs: 180, approachDurationMs: 1920, spacingMs: 350 },
  { type: 'split', openLane: 1, gapForgivenessMs: 140, approachDurationMs: 1840, spacingMs: 300 },
  { type: 'split', openLane: -1, gapForgivenessMs: 90, approachDurationMs: 1770, spacingMs: 250 },
  { type: 'split', openLane: 0, gapForgivenessMs: 40, approachDurationMs: 1700, spacingMs: 200 },
];

export interface Walls {
  readonly container: Container;
  /** Called every frame while a wall is approaching. Hide with a negative wallIndex. */
  update(runProgress: number, wallIndex: number): void;
  /** Wall cleared — shatter/whoosh past the camera. */
  pass(): void;
  /** Crash #1 — segment cracks open leaving a ball-sized hole to squeeze through. */
  crackOpen(): void;
  /** Crash #2 — wall holds solid, the ball bounces off it. */
  impact(): void;
}

const WALL_HEIGHT = 96;
const LANES: readonly Lane[] = [-1, 0, 1];

const SEGMENT_FILL = 0xffe14d;
const SEGMENT_STROKE = 0xfff42f;

/**
 * PLACEHOLDER RENDERING — R2a replaces this with the real procedural wall:
 * warning-glow rim, distinct single/split silhouettes, jagged crack seam and
 * pooled shards. This exists so the build stays green and pacing is tunable
 * on a phone at the end of R1.
 */
export function createWalls(viewW: number, viewH: number): Walls {
  const container = new Container();
  container.eventMode = 'none';

  const nearCenter = project(1, 0, viewW, viewH);
  const nearEdge = project(1, TRACK_EDGE_LANE, viewW, viewH);
  const nativeHalfWidth = nearEdge.x - nearCenter.x;
  // Lane centers sit 1 lane-unit apart, so a lane spans +/-0.5 around its center.
  const nativeLaneWidth = nativeHalfWidth / TRACK_EDGE_LANE;

  const segments: Graphics[] = [];
  for (let i = 0; i < LANES.length; i++) {
    const segment = new Graphics()
      .roundRect(-nativeLaneWidth / 2, -WALL_HEIGHT / 2, nativeLaneWidth, WALL_HEIGHT, 10)
      .fill({ color: SEGMENT_FILL })
      .stroke({ width: 5, color: SEGMENT_STROKE, alpha: 0.9 });
    segment.visible = false;
    segment.eventMode = 'none';
    container.addChild(segment);
    segments.push(segment);
  }

  const scratchCenter: Projected = { x: 0, y: 0, scale: 0 };
  const scratchEdge: Projected = { x: 0, y: 0, scale: 0 };

  function hide(): void {
    for (let i = 0; i < segments.length; i++) segments[i].visible = false;
  }

  function update(runProgress: number, wallIndex: number): void {
    const config = WALLS[wallIndex];
    if (!config) {
      hide();
      return;
    }

    project(runProgress, 0, viewW, viewH, scratchCenter);
    project(runProgress, TRACK_EDGE_LANE, viewW, viewH, scratchEdge);
    const widthScale = (scratchEdge.x - scratchCenter.x) / nativeHalfWidth;
    const fadeIn = Math.min(1, runProgress * 6);

    for (let i = 0; i < LANES.length; i++) {
      const lane = LANES[i];
      const segment = segments[i];

      if (lane === config.openLane) {
        segment.visible = false;
        continue;
      }

      segment.visible = true;
      segment.alpha = fadeIn;
      // Lane offsets scale linearly with half-width, so one projection covers all three.
      segment.position.set(scratchCenter.x + lane * (scratchEdge.x - scratchCenter.x) / TRACK_EDGE_LANE, scratchCenter.y);
      segment.scale.set(widthScale, scratchCenter.scale);
    }
  }

  function pass(): void {
    hide();
  }

  function crackOpen(): void {
    hide();
  }

  function impact(): void {
    hide();
  }

  return { container, update, pass, crackOpen, impact };
}
