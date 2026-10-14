// apps/studio/src/tools/shape-tool.ts
// Thuat toan ve hinh chu nhat va hinh tron Midpoint cho do hoa pixel

import { Point2D } from '@pixel-draw/shared-types';

export function drawRectBorders(x0: number, y0: number, x1: number, y1: number): Point2D[] {
  const points: Point2D[] = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  // Canh ngang tren va duoi
  for (let x = minX; x <= maxX; x++) {
    points.push({ x, y: minY });
    if (minY !== maxY) {
      points.push({ x, y: maxY });
    }
  }

  // Canh doc trai va phai
  for (let y = minY + 1; y < maxY; y++) {
    points.push({ x: minX, y });
    if (minX !== maxX) {
      points.push({ x: maxX, y });
    }
  }

  return points;
}

export function drawRectFilled(x0: number, y0: number, x1: number, y1: number): Point2D[] {
  const points: Point2D[] = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      points.push({ x, y });
    }
  }
  return points;
}

export function drawCircleMidpoint(xc: number, yc: number, r: number): Point2D[] {
  const pointsMap = new Map<string, Point2D>();
  xc = Math.floor(xc);
  yc = Math.floor(yc);
  r = Math.floor(Math.abs(r));

  if (r === 0) {
    return [{ x: xc, y: yc }];
  }

  const addPoint = (x: number, y: number) => {
    pointsMap.set(`${x},${y}`, { x, y });
  };

  let x = 0;
  let y = r;
  let d = 1 - r;

  const plotSymmetric = (cx: number, cy: number, px: number, py: number) => {
    addPoint(cx + px, cy + py);
    addPoint(cx - px, cy + py);
    addPoint(cx + px, cy - py);
    addPoint(cx - px, cy - py);
    addPoint(cx + py, cy + px);
    addPoint(cx - py, cy + px);
    addPoint(cx + py, cy - px);
    addPoint(cx - py, cy - px);
  };

  plotSymmetric(xc, yc, x, y);

  while (x < y) {
    x++;
    if (d < 0) {
      d += 2 * x + 1;
    } else {
      y--;
      d += 2 * (x - y) + 1;
    }
    plotSymmetric(xc, yc, x, y);
  }

  return Array.from(pointsMap.values());
}
