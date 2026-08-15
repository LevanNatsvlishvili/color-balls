// Ball sprite, color cycling, and squash-stretch animation.

export type BallColor = 'magenta' | 'cyan' | 'yellow';

export const COLORS: readonly BallColor[] = ['magenta', 'cyan', 'yellow'];

export const COLOR_HEX: Record<BallColor, number> = {
  magenta: 0xff2fd0,
  cyan: 0x2fe8ff,
  yellow: 0xfff42f,
};
