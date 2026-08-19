import './style.css';
import { createApp } from './core/app';
import { DESIGN_HEIGHT, DESIGN_WIDTH, setupResize } from './core/resize';
import { setupInput, type Direction } from './core/input';
import { GameDirector } from './game/director';
import { BALL_HEX, createBall } from './game/ball';
import { WALLS, createWalls } from './game/walls';
import { createTrack } from './game/track';
import { createDebugOverlay } from './game/debugOverlay';
import { createTrail } from './fx/trail';
import { createParticles } from './fx/particles';
import { createShake } from './fx/shake';
import { createTextPops } from './ui/textPops';
import { createTutorialHand } from './ui/tutorialHand';
import { setupMraid } from './core/mraid';
import { createCta, type Cta } from './ui/cta';

const STORE_URL = 'https://apps.apple.com/app/id000000000';

/**
 * Director tracing. Vite inlines `import.meta.env.DEV` to `false` for the build,
 * so the shipped playable gets a no-op and stays silent — ad-network QA flags
 * console output, and it is dead weight in a single-file ad.
 */
const trace: (...args: unknown[]) => void = import.meta.env.DEV
  ? (...args) => console.debug('[director]', ...args)
  : () => {};

async function boot(): Promise<void> {
  const { app, root, world, layers } = await createApp();
  setupResize(root);

  const track = createTrack(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.track.addChild(track.container);

  const trail = createTrail(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.game.addChild(trail.container);

  const ball = createBall(DESIGN_WIDTH, DESIGN_HEIGHT, 0);
  layers.game.addChild(ball.container);

  const walls = createWalls(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.game.addChild(walls.container);

  const particles = createParticles();
  layers.fx.addChild(particles.container);
  const shake = createShake(world);
  const textPops = createTextPops(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.ui.addChild(textPops.container);
  const tutorialHand = createTutorialHand(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.ui.addChild(tutorialHand.container);

  const debug = createDebugOverlay(DESIGN_WIDTH, DESIGN_HEIGHT);
  layers.debug.addChild(debug.container);

  // Assigned just below; the CTA state can only be reached long after that.
  let cta: Cta | undefined;

  const director = new GameDirector(WALLS, {
    onStateChange: (state) => {
      trace('state ->', state);
      // Wall 1 is the teaching wall: hint while it approaches, gone once it resolves.
      if (state === 'RUN' && director.wallIndex === 0) tutorialHand.show();
      if (state === 'CTA') cta?.show();
    },
    onWallPass: (wallIndex) => {
      trace('wall pass ->', wallIndex);
      walls.pass();
      particles.burst(ball.container.x, ball.container.y, BALL_HEX);
      shake.trigger();
      textPops.show(wallIndex >= 3 ? 'PERFECT!' : 'GREAT!');
      if (wallIndex === 0) tutorialHand.dismiss();
    },
    onCrashShielded: (wallIndex) => {
      trace('crash shielded ->', wallIndex);
      walls.crackOpen(director.lane);
      ball.shatter();
      shake.trigger();
      tutorialHand.dismiss();
    },
    onCrashFatal: (wallIndex) => {
      trace('crash fatal ->', wallIndex);
      walls.impact();
      shake.trigger();
      tutorialHand.dismiss();
      // Shown here rather than on the CTA state so it is tappable during the tumble.
      cta?.show();
    },
    onFinish: () => {
      trace('finish stretch');
      walls.pass();
    },
    onCelebrate: () => {
      trace('celebrate');
      textPops.showWin();
      particles.burst(ball.container.x, ball.container.y, BALL_HEX);
    },
  });

  const mraid = setupMraid(app);

  // Added last so the CTA sits above the text pops and tutorial hand.
  cta = createCta(DESIGN_WIDTH, DESIGN_HEIGHT, () => mraid.clickthrough(STORE_URL));
  layers.ui.addChild(cta.container);

  const onDirection = (dir: Direction): void => {
    tutorialHand.dismiss();
    director.registerInput(dir === 'right' ? 1 : -1);
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

  app.ticker.add((ticker) => {
    const deltaMS = ticker.deltaMS;
    director.update(deltaMS);

    // Once the CTA is up the world is frozen anyway — the director stops
    // advancing runProgress and distanceTraveled, so these would only rewrite
    // identical values behind the dim layer.
    if (director.state !== 'CTA') {
      track.update(director.distanceTraveled);
      ball.setLane(director.lane);
      trail.update(deltaMS, ball.container.x);
      const wallOnScreen =
        director.state === 'RUN' ||
        director.state === 'WALL_RESOLVE' ||
        director.state === 'CRASH_RECOVER' ||
        director.state === 'FAIL_IMPACT';
      walls.update(director.runProgress, wallOnScreen ? director.wallIndex : -1);
    }

    particles.update(deltaMS);

    if (debug.visible) {
      debug.update(director.runProgress, director.wallIndex, WALLS.length, director.lane, director.crashCount);
    }
  });
}

boot();
