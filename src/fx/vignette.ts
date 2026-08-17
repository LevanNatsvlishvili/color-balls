// White vignette flash for the gate-3 near-miss slow-mo beat.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

export interface Vignette {
  readonly container: Container;
  flash(): void;
}

const FLASH_MS = 60;
const EDGE = 170;

export function createVignette(viewW: number, viewH: number): Vignette {
  const container = new Container();
  container.eventMode = 'none';
  container.alpha = 0;
  container.visible = false;

  const graphic = new Graphics();
  graphic.eventMode = 'none';
  graphic.blendMode = 'add';
  graphic.rect(0, 0, viewW, viewH).fill({ color: 0xffffff, alpha: 0.2 });
  graphic.rect(0, 0, viewW, EDGE).fill({ color: 0xffffff, alpha: 0.7 });
  graphic.rect(0, viewH - EDGE, viewW, EDGE).fill({ color: 0xffffff, alpha: 0.7 });
  graphic.rect(0, 0, EDGE, viewH).fill({ color: 0xffffff, alpha: 0.55 });
  graphic.rect(viewW - EDGE, 0, EDGE, viewH).fill({ color: 0xffffff, alpha: 0.55 });
  container.addChild(graphic);

  function flash(): void {
    gsap.killTweensOf(container);
    container.visible = true;
    container.alpha = 1;
    gsap.to(container, {
      alpha: 0,
      duration: FLASH_MS / 1000,
      ease: 'power2.out',
      onComplete: () => {
        container.visible = false;
      },
    });
  }

  return { container, flash };
}
