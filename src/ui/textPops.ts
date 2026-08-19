// Elastic text pop animations for GREAT, PERFECT, and win messages.

import { Container, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';

export interface TextPops {
  readonly container: Container;
  show(message: string): void;
  showWin(): void;
}

const POP_LIFE = 0.5;
const WIN_LIFE = 1.4;

const POP_STYLE = new TextStyle({
  fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
  fontSize: 72,
  fontWeight: '800',
  fill: '#ffffff',
  stroke: { color: '#111118', width: 10 },
  letterSpacing: -1,
});

const WIN_STYLE = new TextStyle({
  fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
  fontSize: 52,
  fontWeight: '800',
  fill: '#fff42f',
  stroke: { color: '#111118', width: 8 },
  align: 'center',
  letterSpacing: -0.5,
});

export function createTextPops(viewW: number, viewH: number): TextPops {
  const container = new Container();
  container.eventMode = 'none';

  const popText = new Text({ text: '', style: POP_STYLE });
  popText.anchor.set(0.5);
  popText.position.set(viewW / 2, viewH * 0.46);
  popText.visible = false;
  popText.eventMode = 'none';

  const winText = new Text({ text: "YOU'RE A NATURAL!", style: WIN_STYLE });
  winText.anchor.set(0.5);
  winText.position.set(viewW / 2, viewH * 0.36);
  winText.visible = false;
  winText.eventMode = 'none';

  container.addChild(popText, winText);

  function play(target: Text, life: number, baseY: number): void {
    gsap.killTweensOf(target);
    gsap.killTweensOf(target.scale);
    target.visible = true;
    target.alpha = 1;
    target.scale.set(0.15);
    target.position.set(viewW / 2, baseY);
    gsap.to(target.scale, { x: 1, y: 1, duration: Math.min(0.4, life * 0.7), ease: 'elastic.out(1, 0.5)' });
    gsap.to(target, { y: baseY - 40, duration: life, ease: 'power1.out' });
    gsap.to(target, {
      alpha: 0,
      duration: 0.12,
      delay: Math.max(0, life - 0.12),
      onComplete: () => {
        target.visible = false;
      },
    });
  }

  function show(message: string): void {
    popText.text = message;
    play(popText, POP_LIFE, viewH * 0.46);
  }

  function showWin(): void {
    play(winText, WIN_LIFE, viewH * 0.36);
  }

  return { container, show, showWin };
}
