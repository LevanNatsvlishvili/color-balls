// Animated swipe hint hand shown at gate 2 until first input.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

export interface TutorialHand {
  readonly container: Container;
  show(): void;
  dismiss(): void;
}

const SKIN = 0xffd4b8;
const OUTLINE = 0x2a1a12;

function drawHand(g: Graphics): void {
  g.roundRect(-22, -6, 44, 50, 16).fill({ color: SKIN }).stroke({ width: 3, color: OUTLINE });
  for (let i = 0; i < 4; i++) {
    const x = -18 + i * 12;
    g.roundRect(x, -38, 10, 36, 5).fill({ color: SKIN }).stroke({ width: 2.5, color: OUTLINE });
  }
  g.roundRect(-38, 2, 18, 26, 9).fill({ color: SKIN }).stroke({ width: 2.5, color: OUTLINE });
}

function drawChevrons(g: Graphics): void {
  for (let i = 0; i < 3; i++) {
    const x = 48 + i * 22;
    const alpha = 0.95 - i * 0.22;
    g.moveTo(x, -14).lineTo(x + 16, 0).lineTo(x, 14).stroke({
      width: 5,
      color: 0xffffff,
      alpha,
      cap: 'round',
      join: 'round',
    });
  }
}

export function createTutorialHand(viewW: number, viewH: number): TutorialHand {
  const container = new Container();
  container.eventMode = 'none';
  container.visible = false;
  container.position.set(viewW * 0.42, viewH * 0.72);

  const motion = new Container();
  motion.eventMode = 'none';

  const hand = new Graphics();
  drawHand(hand);
  hand.eventMode = 'none';

  const chevrons = new Graphics();
  drawChevrons(chevrons);
  chevrons.eventMode = 'none';

  motion.addChild(hand, chevrons);
  container.addChild(motion);

  let dismissed = false;
  let loop: gsap.core.Tween | null = null;

  function stopLoop(): void {
    loop?.kill();
    loop = null;
    gsap.killTweensOf(motion);
    motion.x = 0;
    motion.alpha = 1;
  }

  function startLoop(): void {
    stopLoop();
    loop = gsap.fromTo(
      motion,
      { x: -28, alpha: 0.45 },
      { x: 72, alpha: 1, duration: 0.7, ease: 'power2.out', repeat: -1, repeatDelay: 0.32 },
    );
  }

  function show(): void {
    if (dismissed) return;
    container.visible = true;
    startLoop();
  }

  function dismiss(): void {
    if (dismissed && !container.visible) return;
    dismissed = true;
    stopLoop();
    container.visible = false;
  }

  return { container, show, dismiss };
}
