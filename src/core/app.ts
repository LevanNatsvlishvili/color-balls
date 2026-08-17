// Pixi Application bootstrap and root stage container.

import { Application, Container } from 'pixi.js';

export interface AppLayers {
  track: Container;
  game: Container;
  fx: Container;
  ui: Container;
  debug: Container;
}

export interface AppContext {
  app: Application;
  /** Wraps all layers so resize.ts can scale/letterbox them as one unit. */
  root: Container;
  /** Gameplay layers only (track / game / fx). Shake this — never the CTA/UI layer. */
  world: Container;
  layers: AppLayers;
}

export async function createApp(): Promise<AppContext> {
  const app = new Application();

  await app.init({
    resizeTo: window,
    background: 0x0a0a12,
    backgroundAlpha: 1,
    antialias: window.matchMedia('(pointer: fine)').matches,
  });

  document.body.appendChild(app.canvas);

  const layers: AppLayers = {
    track: new Container(),
    game: new Container(),
    fx: new Container(),
    ui: new Container(),
    debug: new Container(),
  };

  const world = new Container();
  world.addChild(layers.track, layers.game, layers.fx);
  // UI + debug sit on root so screen shake never moves the CTA overlay.
  const root = new Container();
  root.addChild(world, layers.ui, layers.debug);
  app.stage.addChild(root);

  return { app, root, world, layers };
}
