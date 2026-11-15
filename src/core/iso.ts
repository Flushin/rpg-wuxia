import type { Point } from './types';
export const TILE_W = 64;
export const TILE_H = 32;
export const tileToScreen = (x: number, y: number): Point => ({ x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) });
export const screenToTile = (sx: number, sy: number): Point => {
  const a = sx / (TILE_W / 2), b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
};
