// apps/studio/src/tools/selection-tool.ts
// Module quan ly vung chon (Selection) va di chuyen (Move) cho Pixel Art Studio

import { PixelColor, Point2D, coordToKey, keyToCoord } from '@pixel-draw/shared-types';
import { PixelBuffer } from '../core/pixel-buffer';
import { HistoryManager, PixelChange } from '../core/history-manager';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CopiedPixel {
  relX: number;
  relY: number;
  color: PixelColor;
}

export class SelectionManager {
  private currentSelection: SelectionRect | null = null;
  private clipboard: {
    pixels: CopiedPixel[];
    width: number;
    height: number;
  } | null = null;

  getSelection(): SelectionRect | null {
    return this.currentSelection;
  }

  setSelection(rect: SelectionRect | null): void {
    if (!rect) {
      this.currentSelection = null;
      return;
    }
    // Chuan hoa de x, y luon la goc tren ben trai va width, height duong
    const x = Math.min(rect.x, rect.x + rect.width);
    const y = Math.min(rect.y, rect.y + rect.height);
    const width = Math.abs(rect.width);
    const height = Math.abs(rect.height);

    if (width === 0 || height === 0) {
      this.currentSelection = null;
    } else {
      this.currentSelection = { x, y, width, height };
    }
  }

  clearSelection(): void {
    this.currentSelection = null;
  }

  // Sao chep cac pixel trong vung chon tu layer dang hoat dong
  copySelection(buffer: PixelBuffer): boolean {
    if (!this.currentSelection) return false;

    const { x, y, width, height } = this.currentSelection;
    const pixels: CopiedPixel[] = [];

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const px = x + c;
        const py = y + r;
        const color = buffer.getPixel(px, py);
        if (color) {
          pixels.push({ relX: c, relY: r, color });
        }
      }
    }

    this.clipboard = { pixels, width, height };
    return true;
  }

  // Dan cac pixel tu clipboard vao vi tri target (mac dinh la goc tren cua vung chon hoac toa do chi dinh)
  pasteSelection(
    buffer: PixelBuffer,
    targetX: number,
    targetY: number,
    layerId: string,
    frameIndex: number,
    layerPixels: Record<string, PixelColor>
  ): PixelChange[] {
    if (!this.clipboard || this.clipboard.pixels.length === 0) return [];

    const changes: PixelChange[] = [];

    for (const item of this.clipboard.pixels) {
      const px = targetX + item.relX;
      const py = targetY + item.relY;

      if (buffer.isValidCoord(px, py)) {
        const oldColor = buffer.getPixel(px, py);
        if (oldColor !== item.color) {
          buffer.setPixel(px, py, item.color);
          layerPixels[coordToKey(px, py)] = item.color;
          changes.push({
            x: px,
            y: py,
            oldColor,
            newColor: item.color,
            layerId,
            frameIndex
          });
        }
      }
    }

    // Dat lai vung chon quanh khu vuc vua dan
    this.currentSelection = {
      x: targetX,
      y: targetY,
      width: this.clipboard.width,
      height: this.clipboard.height
    };

    return changes;
  }

  // Xoa toan bo pixel trong vung chon
  deleteSelection(
    buffer: PixelBuffer,
    layerId: string,
    frameIndex: number,
    layerPixels: Record<string, PixelColor>
  ): PixelChange[] {
    if (!this.currentSelection) return [];

    const { x, y, width, height } = this.currentSelection;
    const changes: PixelChange[] = [];

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const px = x + c;
        const py = y + r;
        if (buffer.isValidCoord(px, py)) {
          const oldColor = buffer.getPixel(px, py);
          if (oldColor !== null) {
            buffer.setPixel(px, py, null);
            delete layerPixels[coordToKey(px, py)];
            changes.push({
              x: px,
              y: py,
              oldColor,
              newColor: null,
              layerId,
              frameIndex
            });
          }
        }
      }
    }

    return changes;
  }

  // Dich chuyen pixel trong vung chon hoac toan bo layer theo do lech (dx, dy)
  movePixels(
    buffer: PixelBuffer,
    dx: number,
    dy: number,
    layerId: string,
    frameIndex: number,
    layerPixels: Record<string, PixelColor>
  ): PixelChange[] {
    if (dx === 0 && dy === 0) return [];

    const changes: PixelChange[] = [];

    if (this.currentSelection) {
      // Chi di chuyen pixel ben trong vung chon
      const { x, y, width, height } = this.currentSelection;
      const selectedPixels: { x: number; y: number; color: PixelColor }[] = [];

      // Thu thap va xoa vi tri cu
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const px = x + c;
          const py = y + r;
          if (buffer.isValidCoord(px, py)) {
            const color = buffer.getPixel(px, py);
            if (color) {
              selectedPixels.push({ x: px, y: py, color });
              buffer.setPixel(px, py, null);
              delete layerPixels[coordToKey(px, py)];
              changes.push({
                x: px,
                y: py,
                oldColor: color,
                newColor: null,
                layerId,
                frameIndex
              });
            }
          }
        }
      }

      // Gan vao vi tri moi
      for (const sp of selectedPixels) {
        const nx = sp.x + dx;
        const ny = sp.y + dy;
        if (buffer.isValidCoord(nx, ny)) {
          const oldColor = buffer.getPixel(nx, ny);
          buffer.setPixel(nx, ny, sp.color);
          layerPixels[coordToKey(nx, ny)] = sp.color;
          changes.push({
            x: nx,
            y: ny,
            oldColor,
            newColor: sp.color,
            layerId,
            frameIndex
          });
        }
      }

      // Cap nhat vung chon theo do lech
      this.currentSelection.x += dx;
      this.currentSelection.y += dy;
    } else {
      // Di chuyen toan bo layer
      const allPixels = buffer.getAllPixels();
      for (const p of allPixels) {
        buffer.setPixel(p.x, p.y, null);
        delete layerPixels[coordToKey(p.x, p.y)];
        changes.push({
          x: p.x,
          y: p.y,
          oldColor: p.color,
          newColor: null,
          layerId,
          frameIndex
        });
      }

      for (const p of allPixels) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (buffer.isValidCoord(nx, ny) && p.color) {
          const oldColor = buffer.getPixel(nx, ny);
          buffer.setPixel(nx, ny, p.color);
          layerPixels[coordToKey(nx, ny)] = p.color;
          changes.push({
            x: nx,
            y: ny,
            oldColor,
            newColor: p.color,
            layerId,
            frameIndex
          });
        }
      }
    }

    return changes;
  }
}
