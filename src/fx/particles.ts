// Pooled particle burst emitter for wall pass feedback.

import { Container, Graphics } from 'pixi.js';

export interface Particles {
  readonly container: Container;
  burst(x: number, y: number, tint: number): void;
  /** Emits a few idle-pool dots — used as the finish-stretch confetti trail. */
  spray(x: number, y: number, tint: number): void;
  update(deltaMS: number): void;
}

const POOL_SIZE = 24;
const BURST_COUNT = 16;
const SPRAY_COUNT = 4;
const LIFE_MS = 400;
const GRAVITY = 2400;
const PARTICLE_RADIUS = 7;

interface Particle {
  graphic: Graphics;
  vx: number;
  vy: number;
  life: number;
}

export function createParticles(): Particles {
  const container = new Container();
  container.eventMode = 'none';

  const particles: Particle[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const graphic = new Graphics().circle(0, 0, PARTICLE_RADIUS).fill({ color: 0xffffff });
    graphic.visible = false;
    graphic.eventMode = 'none';
    container.addChild(graphic);
    particles.push({ graphic, vx: 0, vy: 0, life: 0 });
  }

  function burst(x: number, y: number, tint: number): void {
    for (let i = 0; i < BURST_COUNT; i++) {
      const particle = particles[i];
      const angle = (i / BURST_COUNT) * Math.PI * 2;
      const speed = 280 + (i % 4) * 90;

      particle.graphic.visible = true;
      particle.graphic.tint = tint;
      particle.graphic.alpha = 1;
      particle.graphic.scale.set(1);
      particle.graphic.position.set(x, y);
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - 420;
      particle.life = LIFE_MS;
    }
  }

  let sprayCursor = BURST_COUNT;

  function spray(x: number, y: number, tint: number): void {
    let spawned = 0;
    for (let n = 0; n < POOL_SIZE && spawned < SPRAY_COUNT; n++) {
      const particle = particles[(sprayCursor + n) % POOL_SIZE];
      if (particle.life > 0) continue;

      const angle = -0.6 + spawned * 0.4 + (sprayCursor % 5) * 0.12;
      const speed = 90 + spawned * 40;
      particle.graphic.visible = true;
      particle.graphic.tint = tint;
      particle.graphic.alpha = 1;
      particle.graphic.scale.set(0.85);
      particle.graphic.position.set(x, y);
      particle.vx = Math.sin(angle) * speed;
      particle.vy = -220 - spawned * 50;
      particle.life = LIFE_MS;
      spawned++;
    }
    sprayCursor = (sprayCursor + SPRAY_COUNT) % POOL_SIZE;
  }

  function update(deltaMS: number): void {
    const dt = deltaMS / 1000;
    for (let i = 0; i < POOL_SIZE; i++) {
      const particle = particles[i];
      if (particle.life <= 0) continue;

      particle.life -= deltaMS;
      if (particle.life <= 0) {
        particle.graphic.visible = false;
        continue;
      }

      particle.vy += GRAVITY * dt;
      particle.graphic.x += particle.vx * dt;
      particle.graphic.y += particle.vy * dt;
      const frac = particle.life / LIFE_MS;
      particle.graphic.alpha = frac;
      particle.graphic.scale.set(0.35 + frac * 0.65);
    }
  }

  return { container, burst, spray, update };
}
