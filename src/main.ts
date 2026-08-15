import './style.css';
import { createApp } from './core/app';
import { setupResize } from './core/resize';
import { setupInput, type Direction } from './core/input';
import { GameDirector } from './game/director';
import { COLORS, type BallColor } from './game/ball';
import type { GateConfig } from './game/gates';

// Placeholder pacing data — Phase 2 Task 2c owns the tuned GATES const in game/gates.ts.
const GATES: GateConfig[] = [
  { color: COLORS[0], assist: false, assistWindowStart: 0, hintFlash: false },
  { color: COLORS[1], assist: false, assistWindowStart: 0.15, hintFlash: false },
  { color: COLORS[2], assist: true, assistWindowStart: 0.7, hintFlash: true },
];

async function boot(): Promise<void> {
  const { app, root } = await createApp();
  setupResize(root);

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

  director.lastInputAt = performance.now();
  app.ticker.add((ticker) => director.update(ticker.deltaMS, performance.now()));
}

boot();
