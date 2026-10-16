// apps/studio/src/tools/transform-tool.ts
// Module bien doi hinh hoc: Lat ngang (Flip H), Lat doc (Flip V), Xoay 90 do (Rotate)

import { PixelColor, coordToKey } from '@pixel-draw/shared-types';
import { PixelBuffer } from '../core/pixel-buffer';
import { PixelChange } from '../core/history-manager';
import { SelectionRect } from './selection-tool';

export function flipHorizontal(
  buffer: PixelBuffer,
  width: number,
  height: number,
  layerId: string,
  frameIndex: number,
  layerPixels: Record<string, PixelColor>,
  selection?: SelectionRect | null
): PixelChange[] {
  const changes: PixelChange[] = [];
  const minX = selection ? selection.x : 0;
  const maxX = selection ? selection.x + selection.width - 1 : width - 1;
  const minY = selection ? selection.y : 0;
  const maxY = selection ? selection.y + selection.height - 1 : height - 1;

  const originalState: { x: number; y: number; color: PixelColor }[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (buffer.isValidCoord(x, y)) {
        originalState.push({ x, y, color: buffer.getPixel(x, y) });
      }
    }
  }

  // Xoa cac diem cu
  for (const item of originalState) {
    buffer.setPixel(item.x, item.y, null);
    delete layerPixels[coordToKey(item.x, item.y)];
  }

  // Gan lai cac diem da lat ngang
  for (const item of originalState) {
    const nx = minX + (maxX - item.x);
    const ny = item.y;
    if (buffer.isValidCoord(nx, ny) && item.color) {
      buffer.setPixel(nx, ny, item.color);
      layerPixels[coordToKey(nx, ny)] = item.color;
    }
  }

  // Ghi nhan toan bo thay doi
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (buffer.isValidCoord(x, y)) {
        const oldC = originalState.find(o => o.x === x && o.y === y)?.color || null;
        const newC = buffer.getPixel(x, y);
        if (oldC !== newC) {
          changes.push({ x, y, oldColor: oldC, newColor: newC, layerId, frameIndex });
        }
      }
    }
  }

  return changes;
}

export function flipVertical(
  buffer: PixelBuffer,
  width: number,
  height: number,
  layerId: string,
  frameIndex: number,
  layerPixels: Record<string, PixelColor>,
  selection?: SelectionRect | null
): PixelChange[] {
  const changes: PixelChange[] = [];
  const minX = selection ? selection.x : 0;
  const maxX = selection ? selection.x + selection.width - 1 : width - 1;
  const minY = selection ? selection.y : 0;
  const maxY = selection ? selection.y + selection.height - 1 : height - 1;

  const originalState: { x: number; y: number; color: PixelColor }[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (buffer.isValidCoord(x, y)) {
        originalState.push({ x, y, color: buffer.getPixel(x, y) });
      }
    }
  }

  // Xoa cac diem cu
  for (const item of originalState) {
    buffer.setPixel(item.x, item.y, null);
    delete layerPixels[coordToKey(item.x, item.y)];
  }

  // Gan lai cac diem da lat doc
  for (const item of originalState) {
    const nx = item.x;
    const ny = minY + (maxY - item.y);
    if (buffer.isValidCoord(nx, ny) && item.color) {
      buffer.setPixel(nx, ny, item.color);
      layerPixels[coordToKey(nx, ny)] = item.color;
    }
  }

  // Ghi nhan toan bo thay doi
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (buffer.isValidCoord(x, y)) {
        const oldC = originalState.find(o => o.x === x && o.y === y)?.color || null;
        const newC = buffer.getPixel(x, y);
        if (oldC !== newC) {
          changes.push({ x, y, oldColor: oldC, newColor: newC, layerId, frameIndex });
        }
      }
    }
  }

  return changes;
}

export function rotate90Clockwise(
  buffer: PixelBuffer,
  width: number,
  height: number,
  layerId: string,
  frameIndex: number,
  layerPixels: Record<string, PixelColor>,
  selection?: SelectionRect | null
): PixelChange[] {
  const changes: PixelChange[] = [];
  const minX = selection ? selection.x : 0;
  const maxX = selection ? selection.x + selection.width - 1 : width - 1;
  const minY = selection ? selection.y : 0;
  const maxY = selection ? selection.y + selection.height - 1 : height - 1;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  const originalState: { x: number; y: number; color: PixelColor }[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (buffer.isValidCoord(x, y)) {
        originalState.push({ x, y, color: buffer.getPixel(x, y) });
      }
    }
  }

  // Xoa cac diem cu
  for (const item of originalState) {
    buffer.setPixel(item.x, item.y, null);
    delete layerPixels[coordToKey(item.x, item.y)];
  }

  // Xoay 90 do theo chieu kim dong ho:
  // (x - minX, y - minY) -> (boxH - 1 - (y - minY), x - minX)
  for (const item of originalState) {
    const relX = item.x - minX;
    const relY = item.y - minY;
    const nx = minX + (boxH - 1 - relY);
    const ny = minY + relX;

    if (buffer.isValidCoord(nx, ny) && item.color) {
      buffer.setPixel(nx, ny, item.color);
      layerPixels[coordToKey(nx, ny)] = item.color;
    }
  }

  // Thu thap thay doi
  const checkMaxX = Math.max(maxX, minX + boxH - 1);
  const checkMaxY = Math.max(maxY, minY + boxW - 1);
  for (let y = minY; y <= checkMaxY; y++) {
    for (let x = minX; x <= checkMaxX; x++) {
      if (buffer.isValidCoord(x, y)) {
        const oldC = originalState.find(o => o.x === x && o.y === y)?.color || null;
        const newC = buffer.getPixel(x, y);
        if (oldC !== newC) {
          changes.push({ x, y, oldColor: oldC, newColor: newC, layerId, frameIndex });
        }
      }
    }
  }

  return changes;
}
