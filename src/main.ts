import { Application } from 'pixi.js';
import './style.css';

async function boot(): Promise<void> {
  const app = new Application();

  await app.init({
    resizeTo: window,
    background: 0x0a0a12,
    backgroundAlpha: 1,
    antialias: window.matchMedia('(pointer: fine)').matches,
  });

  document.body.appendChild(app.canvas);
}

boot();
