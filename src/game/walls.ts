// Wall entities, crash/pass reactions, and the difficulty ramp table.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { BALL_RADIUS } from './ball';
import { project, TRACK_EDGE_LANE, type Lane, type Projected } from './track';

export interface WallConfig {
  /** 'single' = one fused slab (or doorway). 'split' = two separate blocks. */
  type: 'single' | 'split';
  openLane: Lane;
  /** Extra time past first contact in which a late swipe still converts to a pass. */
  gapForgivenessMs: number;
  /** Time for runProgress to travel 0 -> 1, i.e. horizon to ball plane. */
  approachDurationMs: number;
  /**
   * Delay after THIS wall is inserted before the next wall is inserted.
   * Independent of whether the player has passed it yet.
   */
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
  { type: 'single', openLane: 0, gapForgivenessMs: 220, approachDurationMs: 2000, spacingMs: 2000 },
  { type: 'single', openLane: 1, gapForgivenessMs: 220, approachDurationMs: 2000, spacingMs: 2000 },
  { type: 'single', openLane: 0, gapForgivenessMs: 220, approachDurationMs: 1800, spacingMs: 1800 },
  { type: 'single', openLane: -1, gapForgivenessMs: 180, approachDurationMs: 1720, spacingMs: 1750 },
  { type: 'split', openLane: 1, gapForgivenessMs: 140, approachDurationMs: 1640, spacingMs: 1500 },
  { type: 'split', openLane: -1, gapForgivenessMs: 90, approachDurationMs: 1570, spacingMs: 1500 },
  { type: 'split', openLane: 0, gapForgivenessMs: 40, approachDurationMs: 1400, spacingMs: 1000 },
  { type: 'split', openLane: -1, gapForgivenessMs: 40, approachDurationMs: 1400, spacingMs: 950 },
  { type: 'split', openLane: 1, gapForgivenessMs: 40, approachDurationMs: 1400, spacingMs: 950 },
  { type: 'split', openLane: 0, gapForgivenessMs: 40, approachDurationMs: 1300, spacingMs: 750 },
  { type: 'split', openLane: 1, gapForgivenessMs: 40, approachDurationMs: 1200, spacingMs: 700 },
  { type: 'split', openLane: 0, gapForgivenessMs: 40, approachDurationMs: 1200, spacingMs: 600 },
  { type: 'split', openLane: -1, gapForgivenessMs: 40, approachDurationMs: 1200, spacingMs: 500 },
];

export interface Walls {
  readonly container: Container;
  update(flights: readonly { index: number; progress: number; mode: 'approach' | 'cracked' | 'impact' }[]): void;
  pass(wallIndex: number): void;
  crackOpen(wallIndex: number, hitLane: Lane): void;
  impact(wallIndex: number): void;
  clear(): void;
}

const LANES: readonly Lane[] = [-1, 0, 1];

const SINGLE_HEIGHT = 118;
const SPLIT_HEIGHT = 86;
const SPLIT_INSET = 0.1;
const HOLE_WIDTH = BALL_RADIUS * 1.7;
const SHARD_COUNT = 10;
const SHARD_DURATION = 0.42;
const CRACK_DURATION = 0.38;

const SEGMENT_FILL = 0xffe14d;
const SEGMENT_STROKE = 0xfff6a0;
const GLOW_FILL = 0xfff4b0;

type SlotMode = 'hidden' | 'approaching' | 'cracked' | 'impact';

interface Piece {
  lane: Lane;
  x: number;
  w: number;
  h: number;
}

function closedLanes(openLane: Lane): Lane[] {
  const out: Lane[] = [];
  for (let i = 0; i < LANES.length; i++) {
    if (LANES[i] !== openLane) out.push(LANES[i]);
  }
  return out;
}

function paintSlab(g: Graphics, x: number, w: number, h: number): void {
  g.roundRect(x - w / 2, -h / 2, w, h, 12)
    .fill({ color: SEGMENT_FILL })
    .stroke({ width: 6, color: SEGMENT_STROKE, alpha: 0.95 });
}

function paintGlow(g: Graphics, x: number, w: number, h: number): void {
  g.roundRect(x - w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 16).fill({ color: GLOW_FILL, alpha: 0.28 });
}

function paintJaggedHalf(g: Graphics, left: number, right: number, h: number, jaggedOnRight: boolean): void {
  const top = -h / 2;
  const bot = h / 2;
  const jag = 14;
  const pts: number[] = [];

  if (jaggedOnRight) {
    pts.push(left, top, right, top);
    pts.push(right - jag, top + h * 0.22, right + jag * 0.6, top + h * 0.4);
    pts.push(right - jag, top + h * 0.62, right + jag * 0.35, bot);
    pts.push(left, bot);
  } else {
    pts.push(left, top, right, top, right, bot);
    pts.push(left + jag, bot - h * 0.18, left - jag * 0.6, bot - h * 0.42);
    pts.push(left + jag, bot - h * 0.68, left - jag * 0.35, top);
  }

  g.poly(pts).fill({ color: SEGMENT_FILL }).stroke({ width: 5, color: SEGMENT_STROKE, alpha: 0.95 });
}

export function createWalls(viewW: number, viewH: number): Walls {
  const container = new Container();
  container.eventMode = 'none';
  container.sortableChildren = true;

  const nearCenter = project(1, 0, viewW, viewH);
  const nearEdge = project(1, TRACK_EDGE_LANE, viewW, viewH);
  const nativeHalfWidth = nearEdge.x - nearCenter.x;
  const nativeLaneWidth = nativeHalfWidth / TRACK_EDGE_LANE;

  const scratchCenter: Projected = { x: 0, y: 0, scale: 0 };
  const scratchEdge: Projected = { x: 0, y: 0, scale: 0 };

  const shardLayer = new Container();
  shardLayer.eventMode = 'none';
  shardLayer.zIndex = 10000;
  container.addChild(shardLayer);

  const shards: Graphics[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    const graphic = new Graphics().roundRect(-14, -8, 28, 16, 4).fill({ color: 0xffffff });
    graphic.visible = false;
    graphic.eventMode = 'none';
    graphic.tint = SEGMENT_FILL;
    shardLayer.addChild(graphic);
    shards.push(graphic);
  }

  function burstShards(originX: number, originY: number, scaleX: number, scaleY: number, count: number): void {
    const n = Math.min(count, SHARD_COUNT);
    for (let i = 0; i < n; i++) {
      const graphic = shards[i];
      gsap.killTweensOf(graphic);
      gsap.killTweensOf(graphic.scale);

      const angle = (i / n) * Math.PI * 2 + 0.2;
      const dist = (55 + (i % 4) * 22) * scaleY;

      graphic.visible = true;
      graphic.alpha = 1;
      graphic.rotation = angle;
      graphic.position.set(originX, originY);
      graphic.scale.set(scaleX, scaleY);

      gsap.to(graphic, {
        x: originX + Math.cos(angle) * dist,
        y: originY + Math.sin(angle) * dist,
        alpha: 0,
        rotation: angle + 1.3,
        duration: SHARD_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          graphic.visible = false;
        },
      });
      gsap.to(graphic.scale, {
        x: scaleX * 0.3,
        y: scaleY * 0.3,
        duration: SHARD_DURATION,
        ease: 'power2.out',
      });
    }
  }

  function layoutPieces(config: WallConfig): Piece[] {
    const closed = closedLanes(config.openLane);
    const h = config.type === 'single' ? SINGLE_HEIGHT : SPLIT_HEIGHT;

    if (config.type === 'single' && Math.abs(closed[0] - closed[1]) === 1) {
      const minLane = closed[0] < closed[1] ? closed[0] : closed[1];
      const maxLane = closed[0] < closed[1] ? closed[1] : closed[0];
      const x = ((minLane + maxLane) / 2) * nativeLaneWidth;
      const w = nativeLaneWidth * 2;
      return [{ lane: minLane, x, w, h }];
    }

    const inset = config.type === 'split' ? SPLIT_INSET : 0;
    const w = nativeLaneWidth * (1 - inset);
    return closed.map((lane) => ({ lane, x: lane * nativeLaneWidth, w, h }));
  }

  function createSlot() {
    const root = new Container();
    root.eventMode = 'none';
    root.visible = false;
    container.addChild(root);

    const glowA = new Graphics();
    const glowB = new Graphics();
    glowA.blendMode = 'add';
    glowB.blendMode = 'add';
    glowA.eventMode = 'none';
    glowB.eventMode = 'none';

    const bodyA = new Graphics();
    const bodyB = new Graphics();
    bodyA.eventMode = 'none';
    bodyB.eventMode = 'none';

    const crackLeft = new Graphics();
    const crackRight = new Graphics();
    crackLeft.eventMode = 'none';
    crackRight.eventMode = 'none';
    crackLeft.visible = false;
    crackRight.visible = false;

    root.addChild(glowA, glowB, bodyA, bodyB, crackLeft, crackRight);

    let mode: SlotMode = 'hidden';
    let builtFor = -1;
    let pieces: Piece[] = [];
    let lastX = nearCenter.x;
    let lastY = nearCenter.y;
    let lastWidthScale = 1;
    let lastScale = 1;
    let seen = false;

    function killCrack(): void {
      gsap.killTweensOf(crackLeft);
      gsap.killTweensOf(crackRight);
      crackLeft.visible = false;
      crackRight.visible = false;
      crackLeft.clear();
      crackRight.clear();
    }

    function hideBodies(): void {
      bodyA.visible = false;
      bodyB.visible = false;
      glowA.visible = false;
      glowB.visible = false;
    }

    function hide(): void {
      killCrack();
      hideBodies();
      root.visible = false;
      mode = 'hidden';
      builtFor = -1;
    }

    function rebuild(config: WallConfig, wallIndex: number): void {
      killCrack();
      bodyA.clear();
      bodyB.clear();
      glowA.clear();
      glowB.clear();

      pieces = layoutPieces(config);

      if (pieces[0]) {
        paintGlow(glowA, pieces[0].x, pieces[0].w, pieces[0].h);
        paintSlab(bodyA, pieces[0].x, pieces[0].w, pieces[0].h);
        glowA.visible = true;
        bodyA.visible = true;
      } else {
        glowA.visible = false;
        bodyA.visible = false;
      }

      if (pieces[1]) {
        paintGlow(glowB, pieces[1].x, pieces[1].w, pieces[1].h);
        paintSlab(bodyB, pieces[1].x, pieces[1].w, pieces[1].h);
        glowB.visible = true;
        bodyB.visible = true;
      } else {
        glowB.visible = false;
        bodyB.visible = false;
      }

      builtFor = wallIndex;
      mode = 'approaching';
      root.visible = true;
    }

    function applyPose(runProgress: number): void {
      project(runProgress, 0, viewW, viewH, scratchCenter);
      project(runProgress, TRACK_EDGE_LANE, viewW, viewH, scratchEdge);
      const widthScale = (scratchEdge.x - scratchCenter.x) / nativeHalfWidth;
      const fadeIn = mode === 'approaching' ? Math.min(1, runProgress * 6) : 1;

      root.visible = true;
      root.position.set(scratchCenter.x, scratchCenter.y);
      root.scale.set(widthScale, scratchCenter.scale);
      root.alpha = fadeIn;
      root.zIndex = runProgress * 1000;

      lastX = scratchCenter.x;
      lastY = scratchCenter.y;
      lastScale = scratchCenter.scale;
      lastWidthScale = widthScale;
    }

    function sync(wallIndex: number, progress: number, nextMode: SlotMode): void {
      seen = true;
      const config = WALLS[wallIndex];
      if (!config) {
        hide();
        return;
      }

      if (mode === 'hidden' || builtFor !== wallIndex) rebuild(config, wallIndex);
      if (nextMode === 'cracked' || nextMode === 'impact') mode = nextMode;
      applyPose(progress);
    }

    function pass(): void {
      if (mode === 'hidden') return;
      hideBodies();
      killCrack();
      burstShards(lastX, lastY, lastWidthScale, lastScale, SHARD_COUNT);
      root.visible = false;
      mode = 'hidden';
      builtFor = -1;
    }

    function crackOpen(hitLane: Lane): void {
      if (mode !== 'approaching' || pieces.length === 0) return;

      let hitIndex = 0;
      let hit = pieces[0];
      let best = Infinity;
      for (let i = 0; i < pieces.length; i++) {
        const d = Math.abs(pieces[i].lane - hitLane);
        if (d < best) {
          best = d;
          hit = pieces[i];
          hitIndex = i;
        }
      }

      if (hitIndex === 0) {
        bodyA.visible = false;
        glowA.visible = false;
      } else {
        bodyB.visible = false;
        glowB.visible = false;
      }

      const hole = Math.min(HOLE_WIDTH, hit.w * 0.55);
      const left = hit.x - hit.w / 2;
      const right = hit.x + hit.w / 2;
      const holeCenter = hitLane * nativeLaneWidth;
      const holeLeft = Math.max(left + 18, holeCenter - hole / 2);
      const holeRight = Math.min(right - 18, holeCenter + hole / 2);

      paintJaggedHalf(crackLeft, left, holeLeft, hit.h, true);
      paintJaggedHalf(crackRight, holeRight, right, hit.h, false);
      crackLeft.visible = true;
      crackRight.visible = true;
      crackLeft.alpha = 1;
      crackRight.alpha = 1;
      crackLeft.position.set(0, 0);
      crackRight.position.set(0, 0);
      crackLeft.rotation = 0;
      crackRight.rotation = 0;

      const split = 28;
      gsap.to(crackLeft, { x: -split, rotation: -0.08, duration: CRACK_DURATION, ease: 'power2.out' });
      gsap.to(crackRight, { x: split, rotation: 0.08, duration: CRACK_DURATION, ease: 'power2.out' });

      burstShards(lastX + holeCenter * lastWidthScale, lastY, lastWidthScale, lastScale, SHARD_COUNT);
      mode = 'cracked';
    }

    function impact(): void {
      if (mode === 'hidden') return;
      mode = 'impact';
    }

    return {
      get mode() {
        return mode;
      },
      get seen() {
        return seen;
      },
      set seen(value: boolean) {
        seen = value;
      },
      hide,
      sync,
      pass,
      crackOpen,
      impact,
    };
  }

  const slots = WALLS.map(() => createSlot());

  function slotAt(wallIndex: number) {
    return slots[wallIndex];
  }

  function update(
    flights: readonly { index: number; progress: number; mode: 'approach' | 'cracked' | 'impact' }[]
  ): void {
    for (let i = 0; i < slots.length; i++) slots[i].seen = false;

    for (let i = 0; i < flights.length; i++) {
      const flight = flights[i];
      const slot = slotAt(flight.index);
      if (!slot) continue;
      const nextMode: SlotMode =
        flight.mode === 'cracked' ? 'cracked' : flight.mode === 'impact' ? 'impact' : 'approaching';
      slot.sync(flight.index, flight.progress, nextMode);
    }

    for (let i = 0; i < slots.length; i++) {
      if (!slots[i].seen && slots[i].mode !== 'hidden') slots[i].hide();
    }
  }

  function pass(wallIndex: number): void {
    slotAt(wallIndex)?.pass();
  }

  function crackOpen(wallIndex: number, hitLane: Lane): void {
    slotAt(wallIndex)?.crackOpen(hitLane);
  }

  function impact(wallIndex: number): void {
    slotAt(wallIndex)?.impact();
  }

  function clear(): void {
    for (let i = 0; i < slots.length; i++) slots[i].hide();
  }

  return { container, update, pass, crackOpen, impact, clear };
}
