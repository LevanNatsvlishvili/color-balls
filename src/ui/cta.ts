// CTA overlay with dim layer, app icon, and pulsing PLAY NOW button.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';
import { BALL_HEX } from '../game/ball';

const DIM_ALPHA = 0.72;
const DIM_FADE_DURATION = 0.35;
const PANEL_SLIDE_DURATION = 0.55;
const PULSE_SCALE = 1.06;
const PULSE_DURATION = 0.6;

/** Standard playable behavior: after the CTA has been up this long, a tap anywhere converts. */
const TAP_ANYWHERE_DELAY_MS = 2000;
/** Collapses the overlay hit and the window listener seeing the same physical tap into one clickthrough. */
const CLICKTHROUGH_DEDUPE_MS = 500;

const PANEL_HEIGHT = 560;
const PANEL_FILL = 0x161a2e;
const PANEL_STROKE = 0x2f3658;
const BUTTON_FILL = 0x22c55e;
const BUTTON_WIDTH = 440;
const BUTTON_HEIGHT = 112;
const ICON_SIZE = 168;

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const titleStyle = new TextStyle({
  fontFamily: FONT_STACK,
  fontSize: 52,
  fontWeight: '800',
  fill: '#ffffff',
});

const subtitleStyle = new TextStyle({
  fontFamily: FONT_STACK,
  fontSize: 28,
  fontWeight: '500',
  fill: '#9aa0c8',
});

const buttonStyle = new TextStyle({
  fontFamily: FONT_STACK,
  fontSize: 42,
  fontWeight: '800',
  fill: '#06240f',
  letterSpacing: 1.5,
});

export interface Cta {
  readonly container: Container;
  readonly isVisible: boolean;
  show(): void;
  dispose(): void;
}

/** Procedural app icon — shielded ball threading a wall gap. No image assets. */
function createAppIcon(): Container {
  const icon = new Container();
  icon.eventMode = 'none';

  const tile = new Graphics()
    .roundRect(-ICON_SIZE / 2, -ICON_SIZE / 2, ICON_SIZE, ICON_SIZE, 38)
    .fill({ color: 0x0d1022 })
    .stroke({ width: 3, color: 0x3a4270 });

  const wall = new Graphics()
    .roundRect(-62, -12, 44, 24, 6)
    .fill({ color: 0x2b3150 })
    .stroke({ width: 3, color: 0xff7a3d, alpha: 0.9 })
    .roundRect(18, -12, 44, 24, 6)
    .fill({ color: 0x2b3150 })
    .stroke({ width: 3, color: 0xff7a3d, alpha: 0.9 });

  const shield = new Graphics().circle(0, 22, 42).stroke({ width: 5, color: 0x6ee7ff, alpha: 0.75 });
  const ball = new Graphics().circle(0, 22, 30).fill({ color: BALL_HEX });

  icon.addChild(tile, wall, shield, ball);
  return icon;
}

export function createCta(viewW: number, viewH: number, onClickthrough: () => void): Cta {
  const container = new Container();
  container.visible = false;
  // Entire overlay converts, not just the button.
  container.eventMode = 'static';
  container.cursor = 'pointer';
  container.hitArea = { contains: () => true };

  const dim = new Graphics().rect(0, 0, viewW, viewH).fill({ color: 0x05060f });
  dim.alpha = 0;
  dim.eventMode = 'none';

  const panel = new Container();
  panel.eventMode = 'none';

  const panelTop = viewH - PANEL_HEIGHT;
  const panelBg = new Graphics()
    .roundRect(24, panelTop, viewW - 48, PANEL_HEIGHT + 40, 44)
    .fill({ color: PANEL_FILL })
    .stroke({ width: 3, color: PANEL_STROKE });
  panel.addChild(panelBg);

  const icon = createAppIcon();
  icon.position.set(viewW / 2, panelTop + 130);
  panel.addChild(icon);

  const title = new Text({ text: 'Wall Run', style: titleStyle });
  title.anchor.set(0.5);
  title.position.set(viewW / 2, panelTop + 262);
  panel.addChild(title);

  const subtitle = new Text({ text: 'Can you clear every wall?', style: subtitleStyle });
  subtitle.anchor.set(0.5);
  subtitle.position.set(viewW / 2, panelTop + 312);
  panel.addChild(subtitle);

  const button = new Container();
  button.eventMode = 'none';
  const buttonBg = new Graphics()
    .roundRect(-BUTTON_WIDTH / 2, -BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_HEIGHT / 2)
    .fill({ color: BUTTON_FILL });
  const buttonLabel = new Text({ text: 'PLAY NOW', style: buttonStyle });
  buttonLabel.anchor.set(0.5);
  button.addChild(buttonBg, buttonLabel);
  button.position.set(viewW / 2, panelTop + 424);
  panel.addChild(button);

  container.addChild(dim, panel);

  let isVisible = false;
  let shownAtMs = 0;
  let lastClickthroughAtMs = 0;

  function fireClickthrough(): void {
    const now = performance.now();
    if (now - lastClickthroughAtMs < CLICKTHROUGH_DEDUPE_MS) return;
    lastClickthroughAtMs = now;
    onClickthrough();
  }

  function onTapAnywhere(): void {
    if (!isVisible) return;
    if (performance.now() - shownAtMs < TAP_ANYWHERE_DELAY_MS) return;
    fireClickthrough();
  }

  container.on('pointertap', fireClickthrough);
  window.addEventListener('pointerdown', onTapAnywhere);

  function show(): void {
    if (isVisible) return;
    isVisible = true;
    shownAtMs = performance.now();
    container.visible = true;

    gsap.to(dim, { alpha: DIM_ALPHA, duration: DIM_FADE_DURATION, ease: 'power2.out' });

    panel.y = PANEL_HEIGHT + 40;
    gsap.to(panel, { y: 0, duration: PANEL_SLIDE_DURATION, ease: 'back.out(1.1)' });

    gsap.to(button.scale, {
      x: PULSE_SCALE,
      y: PULSE_SCALE,
      duration: PULSE_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      delay: PANEL_SLIDE_DURATION,
    });
  }

  function dispose(): void {
    gsap.killTweensOf(dim);
    gsap.killTweensOf(panel);
    gsap.killTweensOf(button.scale);
    container.off('pointertap', fireClickthrough);
    window.removeEventListener('pointerdown', onTapAnywhere);
  }

  return {
    container,
    get isVisible() {
      return isVisible;
    },
    show,
    dispose,
  };
}
