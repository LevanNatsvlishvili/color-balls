import './style.css';
import { createApp } from './core/app';
import { DESIGN_HEIGHT, DESIGN_WIDTH, setupResize } from './core/resize';
import { setupInput, type Direction } from './core/input';
import { GameDirector } from './game/director';
import { COLORS, type BallColor } from './game/ball';
import type { GateConfig } from './game/gates';
import { createTrack } from './game/track';
import { createDebugOverlay } from './game/debugOverlay';

// Placeholder pacing data — Phase 2 Task 2c owns the tuned GATES const in game/gates.ts.
const GATES: GateConfig[] = [
  { color: COLORS[0], assist: false, assistWindowStart: 0, hintFlash: false },
  { color: COLORS[1], assist: false, assistWindowStart: 0.15, hintFlash: false },
  { color: COLORS[2], assist: true, assistWindowStart: 0.7, hintFlash: true },
];

async function boot(): Promise<void> {
  const { app, root, layers } = await createApp();
  setupResize(root);

  const track = createTrack(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.track.addChild(track.container);

  const debug = createDebugOverlay(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.debug.addChild(debug.container);

  const director = new GameDirector(GATES, COLORS[0], {
    onStateChange: (state) => console.debug('[director] state ->', state),
    onGatePass: (gateIndex) => console.debug('[director] gate pass ->', gateIndex),
    onFinish: () => console.debug('[director] finish'),
  });

  let colorIndex = 0;
  const onDirection = (dir: Direction): void => {
    colorIndex = dir === 'right' ? (colorIndex + 1) % COLORS.length : (colorIndex + COLORS.length - 1) % COLORS.length;
    const color: BallColor = COLORS[colorIndex];
    director.registerInput(color, performance.now());
  };
  setupInput(app.canvas, onDirection);

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === 'd' || event.key === 'D') debug.toggle();
  });

  director.lastInputAt = performance.now();
  app.ticker.add((ticker) => {
    director.update(ticker.deltaMS, performance.now());
    track.update(director.distanceTraveled);
    if (debug.visible) {
      debug.update(director.runProgress, director.gateIndex, GATES.length, 0);
    }
  });
}

boot();
