// Animated swipe hint shown at gate 2 until first input.

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

export interface TutorialHand {
  readonly container: Container;
  show(): void;
  dismiss(): void;
}

const SKIN = 0xffd4b8;
const OUTLINE = 0x2a1a12;
const SIDE_INSET = 58;

function drawHand(g: Graphics): void {
  g.roundRect(-16, -4, 32, 36, 12).fill({ color: SKIN }).stroke({ width: 2.5, color: OUTLINE });
  for (let i = 0; i < 4; i++) {
    const x = -14 + i * 9;
    g.roundRect(x, -28, 7, 26, 4).fill({ color: SKIN }).stroke({ width: 2, color: OUTLINE });
  }
  g.roundRect(-28, 2, 14, 18, 7).fill({ color: SKIN }).stroke({ width: 2, color: OUTLINE });
}

function drawChevrons(g: Graphics, dir: 1 | -1): void {
  for (let i = 0; i < 3; i++) {
    const x = dir * (36 + i * 16);
    const alpha = 0.95 - i * 0.22;
    g.moveTo(x - dir * 10, -11)
      .lineTo(x + dir * 8, 0)
      .lineTo(x - dir * 10, 11)
      .stroke({
        width: 5,
        color: 0xffffff,
        alpha,
        cap: 'round',
        join: 'round',
      });
  }
}

function createSide(dir: 1 | -1): Container {
  const side = new Container();
  side.eventMode = 'none';

  const hand = new Graphics();
  drawHand(hand);
  hand.eventMode = 'none';
  if (dir === -1) hand.scale.x = -1;

  const chevrons = new Graphics();
  drawChevrons(chevrons, dir);
  chevrons.eventMode = 'none';

  side.addChild(hand, chevrons);
  return side;
}

export function createTutorialHand(viewW: number, viewH: number): TutorialHand {
  const container = new Container();
  container.eventMode = 'none';
  container.visible = false;

  const left = createSide(-1);
  left.position.set(SIDE_INSET, viewH * 0.58);

  const right = createSide(1);
  right.position.set(viewW - SIDE_INSET, viewH * 0.58);

  container.addChild(left, right);

  let dismissed = false;
  const loops: gsap.core.Tween[] = [];

  function stopLoop(): void {
    for (const tween of loops) tween.kill();
    loops.length = 0;
    gsap.killTweensOf(left);
    gsap.killTweensOf(right);
    left.x = SIDE_INSET;
    right.x = viewW - SIDE_INSET;
    left.alpha = 1;
    right.alpha = 1;
  }

  function startLoop(): void {
    stopLoop();
    loops.push(
      gsap.fromTo(
        left,
        { x: SIDE_INSET + 18, alpha: 0.45 },
        { x: SIDE_INSET - 10, alpha: 1, duration: 0.7, ease: 'power2.out', repeat: -1, repeatDelay: 0.32 },
      ),
      gsap.fromTo(
        right,
        { x: viewW - SIDE_INSET - 18, alpha: 0.45 },
        { x: viewW - SIDE_INSET + 10, alpha: 1, duration: 0.7, ease: 'power2.out', repeat: -1, repeatDelay: 0.32 },
      ),
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
