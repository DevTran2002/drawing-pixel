// apps/studio/src/tools/bucket-tool.ts
// Thuat toan Flood Fill (thung son) do mau theo hang doi BFS

import { PixelColor } from '@pixel-draw/shared-types';
import { PixelBuffer } from '../core/pixel-buffer';
import { PixelChange } from '../core/history-manager';

export function floodFill(
  buffer: PixelBuffer,
  startX: number,
  startY: number,
  newColor: PixelColor
): PixelChange[] {
  const targetColor = buffer.getPixel(startX, startY);
  if (targetColor === newColor) {
    return [];
  }

  const changes: PixelChange[] = [];
  const visited = new Uint8Array(buffer.width * buffer.height);
  const queueX: number[] = [startX];
  const queueY: number[] = [startY];

  const getIdx = (x: number, y: number) => y * buffer.width + x;
  visited[getIdx(startX, startY)] = 1;

  while (queueX.length > 0) {
    const cx = queueX.shift()!;
    const cy = queueY.shift()!;

    const oldColor = buffer.getPixel(cx, cy);
    if (oldColor === targetColor) {
      buffer.setPixel(cx, cy, newColor);
      changes.push({ x: cx, y: cy, oldColor, newColor });

      // 4 huong lan toa: Tren, Duoi, Trai, Phai
      const neighbors = [
        { x: cx + 1, y: cy },
        { x: cx - 1, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx, y: cy - 1 }
      ];

      for (const n of neighbors) {
        if (buffer.isValidCoord(n.x, n.y)) {
          const idx = getIdx(n.x, n.y);
          if (!visited[idx]) {
            visited[idx] = 1;
            if (buffer.getPixel(n.x, n.y) === targetColor) {
              queueX.push(n.x);
              queueY.push(n.y);
            }
          }
        }
      }
    }
  }

  return changes;
}
