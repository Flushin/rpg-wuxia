// Contas de distância usadas pelo World e pelos módulos de src/core/world/.
import type { Point } from '../types';

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
