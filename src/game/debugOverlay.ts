// Debug overlay: projection grid, live gate t, and current lane. Toggle with 'd'.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { project, TRACK_EDGE_LANE, type Lane, type Projected } from './track';

export interface DebugOverlay {
  readonly container: Container;
  visible: boolean;
  update(runProgress: number, gateIndex: number, gateCount: number, lane: Lane): void;
  toggle(): void;
}

const HUD_STYLE = new TextStyle({
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  fontSize: 15,
  fill: '#b8ffd4',
  lineHeight: 20,
});

const LABEL_STYLE = new TextStyle({
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  fontSize: 11,
  fill: '#8ad4ff',
});

const GRID_T = [0, 0.25, 0.5, 0.75, 1] as const;
const LANES: readonly Lane[] = [-1, 0, 1];

function drawPlane(g: Graphics, t: number, viewW: number, viewH: number, color: number, alpha: number): void {
  const left = project(t, -TRACK_EDGE_LANE, viewW, viewH);
  const right = project(t, TRACK_EDGE_LANE, viewW, viewH);
  g.moveTo(left.x, left.y).lineTo(right.x, right.y).stroke({ width: 2, color, alpha });
}

export function createDebugOverlay(viewW: number, viewH: number): DebugOverlay {
  const container = new Container();
  container.eventMode = 'none';

  const gridGraphics = new Graphics();
  for (const t of GRID_T) {
    drawPlane(gridGraphics, t, viewW, viewH, 0x5ad0ff, t === 0 || t === 1 ? 0.55 : 0.22);
  }
  container.addChild(gridGraphics);

  for (const t of GRID_T) {
    const right = project(t, TRACK_EDGE_LANE, viewW, viewH);
    const label = new Text({ text: `t=${t.toFixed(2)}`, style: LABEL_STYLE });
    label.anchor.set(0, 0.5);
    label.position.set(right.x + 8, right.y);
    container.addChild(label);
  }

  const livePlane = new Graphics();
  container.addChild(livePlane);

  const laneDots: Graphics[] = [];
  for (let i = 0; i < LANES.length; i++) {
    const dot = new Graphics().circle(0, 0, 7).fill({ color: 0xff4fa3 });
    dot.eventMode = 'none';
    container.addChild(dot);
    laneDots.push(dot);
  }

  const hud = new Text({ text: '', style: HUD_STYLE });
  hud.position.set(16, 16);
  container.addChild(hud);

  const scratch: Projected = { x: 0, y: 0, scale: 0 };

  function update(runProgress: number, gateIndex: number, gateCount: number, lane: Lane): void {
    livePlane.clear();
    drawPlane(livePlane, runProgress, viewW, viewH, 0xff4fa3, 0.95);

    for (let i = 0; i < LANES.length; i++) {
      project(runProgress, LANES[i], viewW, viewH, scratch);
      const dot = laneDots[i];
      dot.position.set(scratch.x, scratch.y);
      dot.scale.set(scratch.scale);
      dot.alpha = LANES[i] === lane ? 1 : 0.35;
    }

    hud.text =
      `DEBUG  (d to toggle)\n` +
      `gate  ${gateIndex + 1} / ${gateCount}\n` +
      `t     ${runProgress.toFixed(3)}\n` +
      `lane  ${lane}`;
  }

  function toggle(): void {
    container.visible = !container.visible;
  }

  update(0, 0, 3, 0);

  return {
    container,
    get visible() {
      return container.visible;
    },
    set visible(value: boolean) {
      container.visible = value;
    },
    update,
    toggle,
  };
}
