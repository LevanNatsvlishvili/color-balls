import './style.css';
import { createApp } from './core/app';
import { DESIGN_HEIGHT, DESIGN_WIDTH, setupResize } from './core/resize';
import { setupInput, type Direction } from './core/input';
import { GameDirector } from './game/director';
import { COLORS, createBall, cycleColor } from './game/ball';
import { GATES, createGates } from './game/gates';
import { createTrack } from './game/track';
import { createDebugOverlay } from './game/debugOverlay';

async function boot(): Promise<void> {
  const { app, root, layers } = await createApp();
  setupResize(root);

  const track = createTrack(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.track.addChild(track.container);

  const ball = createBall(DESIGN_WIDTH, DESIGN_HEIGHT, COLORS[0]);
  layers.game.addChild(ball.container);

  const gates = createGates(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.game.addChild(gates.container);

  const debug = createDebugOverlay(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.debug.addChild(debug.container);

  const director = new GameDirector(GATES, COLORS[0], {
    onStateChange: (state) => console.debug('[director] state ->', state),
    onGatePass: (gateIndex) => {
      console.debug('[director] gate pass ->', gateIndex);
      gates.shatter();
    },
    onFinish: () => console.debug('[director] finish'),
  });

  const onDirection = (dir: Direction): void => {
    director.registerInput(cycleColor(director.ballColor, dir), performance.now());
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
    ball.setColor(director.ballColor);
    gates.update(director.runProgress, director.gateIndex);
    if (debug.visible) {
      debug.update(director.runProgress, director.gateIndex, GATES.length, 0);
    }
  });
}

boot();
