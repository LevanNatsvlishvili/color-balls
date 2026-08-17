import './style.css';
import { createApp } from './core/app';
import { DESIGN_HEIGHT, DESIGN_WIDTH, setupResize } from './core/resize';
import { setupInput, type Direction } from './core/input';
import { GameDirector } from './game/director';
import { COLORS, createBall, cycleColor } from './game/ball';
import { GATES, createGates } from './game/gates';
import { createTrack } from './game/track';
import { createDebugOverlay } from './game/debugOverlay';
import { createTrail } from './fx/trail';
import { createParticles } from './fx/particles';
import { createShake } from './fx/shake';
import { createVignette } from './fx/vignette';
import { createTextPops } from './ui/textPops';
import { createTutorialHand } from './ui/tutorialHand';
import { setupMraid } from './core/mraid';
import { createCta, type Cta } from './ui/cta';

const STORE_URL = 'https://apps.apple.com/app/id000000000';

async function boot(): Promise<void> {
  const { app, root, world, layers } = await createApp();
  setupResize(root);

  const track = createTrack(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.track.addChild(track.container);

  const trail = createTrail();
  layers.game.addChild(trail.container);

  const ball = createBall(DESIGN_WIDTH, DESIGN_HEIGHT, COLORS[0]);
  layers.game.addChild(ball.container);

  const gates = createGates(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.game.addChild(gates.container);

  const particles = createParticles();
  layers.fx.addChild(particles.container);
  const shake = createShake(world);
  const vignette = createVignette(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.ui.addChild(vignette.container);
  const textPops = createTextPops(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.ui.addChild(textPops.container);
  const tutorialHand = createTutorialHand(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.ui.addChild(tutorialHand.container);

  const debug = createDebugOverlay(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.debug.addChild(debug.container);

  // Assigned just below; the CTA state can only be reached long after that.
  let cta: Cta | undefined;

  const director = new GameDirector(GATES, COLORS[0], {
    onStateChange: (state) => {
      console.debug('[director] state ->', state);
      if (state === 'CTA') cta?.show();
    },
    onGatePass: (gateIndex) => {
      console.debug('[director] gate pass ->', gateIndex);
      gates.shatter();
      particles.burst(ball.container.x, ball.container.y, director.ballColor);
      shake.trigger();
      textPops.show(gateIndex === 2 ? 'PERFECT!' : 'GREAT!');
      if (gateIndex === 0) tutorialHand.show();
      if (gateIndex === 1) tutorialHand.dismiss();
    },
    onNearMiss: (gateIndex) => {
      console.debug('[director] near miss ->', gateIndex);
      vignette.flash();
    },
    onFinish: () => {
      console.debug('[director] finish');
      textPops.showWin();
    },
  });

  const mraid = setupMraid(app, {
    // Wall-clock kept running while the ad was hidden; forgive it so idle-assist doesn't insta-fire on resume.
    onResume: () => {
      director.lastInputAt = performance.now();
    },
  });

  // Added last so the CTA sits above the vignette, text pops and tutorial hand.
  cta = createCta(DESIGN_WIDTH, DESIGN_HEIGHT, () => mraid.clickthrough(STORE_URL));
  layers.ui.addChild(cta.container);

  const onDirection = (dir: Direction): void => {
    tutorialHand.dismiss();
    director.registerInput(cycleColor(director.ballColor, dir), performance.now());
  };
  setupInput(app.canvas, onDirection);

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === 'd' || event.key === 'D') debug.toggle();
  });

  // Test hook: ?state=cta jumps straight to the CTA without playing the run.
  if (new URLSearchParams(window.location.search).get('state') === 'cta') {
    cta.show();
  }

  // Gate the run on the ad being ready and actually on screen. Resolves immediately when unhosted.
  await mraid.whenViewable();

  director.lastInputAt = performance.now();
  app.ticker.add((ticker) => {
    director.update(ticker.deltaMS, performance.now());
    track.update(director.distanceTraveled);
    trail.update(ticker.deltaMS, director.ballColor, DESIGN_WIDTH, DESIGN_HEIGHT);
    particles.update(ticker.deltaMS);
    ball.setColor(director.ballColor);
    gates.update(director.runProgress, director.gateIndex);
    if (debug.visible) {
      debug.update(director.runProgress, director.gateIndex, GATES.length, 0);
    }
  });
}

boot();
