// apps/studio/src/tools/symmetry-manager.ts
// Tinh toan cac toa do doi xung truc ngang va doc

import { Point2D } from '@pixel-draw/shared-types';

export function getSymmetricPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  axisX: boolean,
  axisY: boolean
): Point2D[] {
  const pointsMap = new Map<string, Point2D>();

  const addPoint = (px: number, py: number) => {
    if (px >= 0 && px < width && py >= 0 && py < height) {
      pointsMap.set(`${px},${py}`, { x: px, y: py });
    }
  };

  // Diem goc
  addPoint(x, y);

  // Doi xung qua truc doc (bien X doi xung qua tam)
  const symX = width - 1 - x;
  // Doi xung qua truc ngang (bien Y doi xung qua tam)
  const symY = height - 1 - y;

  if (axisX) {
    addPoint(symX, y);
  }

  if (axisY) {
    addPoint(x, symY);
  }

  if (axisX && axisY) {
    addPoint(symX, symY);
  }

  return Array.from(pointsMap.values());
}
