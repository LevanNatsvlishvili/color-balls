// Gate entities, shatter on pass, and rigged pacing table.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { COLOR_HEX, COLORS, type BallColor } from './ball';
import { project, TRACK_EDGE_LANE, type Projected } from './track';

export interface GateConfig {
  color: BallColor;
  /** Gate 3: any input within the assist window snaps to the correct color. */
  assist: boolean;
  /** Fraction of runProgress (0..1) at which the assist window opens. Only used when assist is true. */
  assistWindowStart: number;
  /** Gate 3: gate visually flashes as a hint. */
  hintFlash: boolean;
}

/**
 * Rigged playable pacing:
 * 1. Magenta — already matches the ball (free win).
 * 2. Cyan — wrong color, full approach window to swipe.
 * 3. Yellow — wrong color, late assist + hint flash.
 */
export const GATES: readonly GateConfig[] = [
  { color: COLORS[0], assist: false, assistWindowStart: 0, hintFlash: false },
  { color: COLORS[1], assist: false, assistWindowStart: 0.15, hintFlash: false },
  { color: COLORS[2], assist: true, assistWindowStart: 0.7, hintFlash: true },
];

export interface Gates {
  readonly container: Container;
  update(runProgress: number, gateIndex: number): void;
  shatter(): void;
}

const GATE_HEIGHT = 48;
const SHARD_COUNT = 8;
const SHARD_DURATION = 0.42;
const HINT_MIN = 0.4;

interface Shard {
  graphic: Graphics;
}

export function createGates(viewW: number, viewH: number): Gates {
  const container = new Container();
  container.eventMode = 'none';

  const nearLeft = project(1, -TRACK_EDGE_LANE, viewW, viewH);
  const nearRight = project(1, TRACK_EDGE_LANE, viewW, viewH);
  const nativeWidth = nearRight.x - nearLeft.x;

  const bar = new Container();
  bar.eventMode = 'none';

  const glow = new Graphics()
    .roundRect(-nativeWidth / 2 - 14, -GATE_HEIGHT / 2 - 12, nativeWidth + 28, GATE_HEIGHT + 24, 24)
    .fill({ color: 0xffffff, alpha: 0.32 });
  glow.blendMode = 'add';
  glow.eventMode = 'none';

  const core = new Graphics()
    .roundRect(-nativeWidth / 2, -GATE_HEIGHT / 2, nativeWidth, GATE_HEIGHT, 18)
    .fill({ color: 0xffffff })
    .stroke({ width: 6, color: 0xffffff, alpha: 0.85 });
  core.eventMode = 'none';

  bar.addChild(glow, core);
  container.addChild(bar);

  const shards: Shard[] = [];
  const shardLayer = new Container();
  shardLayer.eventMode = 'none';
  container.addChild(shardLayer);

  for (let i = 0; i < SHARD_COUNT; i++) {
    const graphic = new Graphics()
      .roundRect(-18, -10, 36, 20, 6)
      .fill({ color: 0xffffff });
    graphic.visible = false;
    graphic.eventMode = 'none';
    shardLayer.addChild(graphic);
    shards.push({ graphic });
  }

  const hint = { v: 1 };
  let hintActive = false;

  const scratchCenter: Projected = { x: 0, y: 0, scale: 0 };
  const scratchLeft: Projected = { x: 0, y: 0, scale: 0 };
  const scratchRight: Projected = { x: 0, y: 0, scale: 0 };

  let lastX = nearLeft.x + nativeWidth / 2;
  let lastY = nearLeft.y;
  let lastScale = 1;
  let lastColor: BallColor = COLORS[0];
  let lastWidthScale = 1;

  function stopHint(): void {
    if (!hintActive) return;
    gsap.killTweensOf(hint);
    hint.v = 1;
    hintActive = false;
  }

  function startHint(): void {
    if (hintActive) return;
    hintActive = true;
    hint.v = 1;
    gsap.to(hint, { v: HINT_MIN, duration: 0.16, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  function applyTint(color: BallColor): void {
    const hex = COLOR_HEX[color];
    core.tint = hex;
    glow.tint = hex;
  }

  function update(runProgress: number, gateIndex: number): void {
    const config = GATES[gateIndex];
    if (!config) {
      bar.visible = false;
      stopHint();
      return;
    }

    project(runProgress, 0, viewW, viewH, scratchCenter);
    project(runProgress, -TRACK_EDGE_LANE, viewW, viewH, scratchLeft);
    project(runProgress, TRACK_EDGE_LANE, viewW, viewH, scratchRight);

    const widthScale = (scratchRight.x - scratchLeft.x) / nativeWidth;
    bar.visible = true;
    bar.position.set(scratchCenter.x, scratchCenter.y);
    bar.scale.set(widthScale, scratchCenter.scale);

    lastX = scratchCenter.x;
    lastY = scratchCenter.y;
    lastScale = scratchCenter.scale;
    lastWidthScale = widthScale;
    lastColor = config.color;
    applyTint(config.color);

    if (config.hintFlash) startHint();
    else stopHint();

    const fadeIn = Math.min(1, runProgress * 6);
    bar.alpha = fadeIn * hint.v;
  }

  function shatter(): void {
    bar.visible = false;
    stopHint();

    const hex = COLOR_HEX[lastColor];

    for (let i = 0; i < SHARD_COUNT; i++) {
      const graphic = shards[i].graphic;
      gsap.killTweensOf(graphic);
      gsap.killTweensOf(graphic.scale);

      const angle = (i / SHARD_COUNT) * Math.PI * 2;
      const dist = (70 + (i % 3) * 28) * lastScale;

      graphic.visible = true;
      graphic.tint = hex;
      graphic.alpha = 1;
      graphic.rotation = angle;
      graphic.position.set(lastX, lastY);
      graphic.scale.set(lastWidthScale, lastScale);

      gsap.to(graphic, {
        x: lastX + Math.cos(angle) * dist,
        y: lastY + Math.sin(angle) * dist,
        alpha: 0,
        rotation: angle + 1.4,
        duration: SHARD_DURATION,
        ease: 'power2.out',
        onComplete: () => {
          graphic.visible = false;
        },
      });
      gsap.to(graphic.scale, {
        x: lastWidthScale * 0.35,
        y: lastScale * 0.35,
        duration: SHARD_DURATION,
        ease: 'power2.out',
      });
    }
  }

  applyTint(lastColor);
  bar.visible = false;

  return { container, update, shatter };
}
