// apps/studio/src/tools/selection-tool.ts
// Module quan ly vung chon (Selection) va di chuyen noi (Floating Selection Move) cho Pixel Art Studio

import { PixelColor, Point2D, coordToKey, keyToCoord } from '@pixel-draw/shared-types';
import { PixelBuffer } from '../core/pixel-buffer';
import { PixelChange } from '../core/history-manager';

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

export interface FloatingSelection {
  originRect: SelectionRect;
  currentRect: SelectionRect;
  pixels: CopiedPixel[];
  cutOriginalChanges: PixelChange[];
}

// Ham ho tro chuyen ma mau HEX sang RGB de tinh sai bien mau
function parseHexToRgb(hex: string | null): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16)
    ];
  }
  if (clean.length >= 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  }
  return null;
}

// So khop mau sac theo dung sai Euclidean trong khong gian mau RGB
function isColorMatch(hexA: string | null, hexB: string | null, tolerance: number): boolean {
  if (hexA === hexB) return true;
  if (!hexA || !hexB) return false;
  if (tolerance <= 0) return hexA.toLowerCase() === hexB.toLowerCase();

  const rgbA = parseHexToRgb(hexA);
  const rgbB = parseHexToRgb(hexB);
  if (!rgbA || !rgbB) return false;

  const dr = rgbA[0] - rgbB[0];
  const dg = rgbA[1] - rgbB[1];
  const db = rgbA[2] - rgbB[2];
  const dist = (Math.sqrt(dr * dr + dg * dg + db * db) / Math.sqrt(255 * 255 * 3)) * 100;
  return dist <= tolerance;
}

export class SelectionManager {
  private currentSelection: SelectionRect | null = null;
  private customMask: Set<string> | null = null;
  private floating: FloatingSelection | null = null;
  private clipboard: {
    pixels: CopiedPixel[];
    width: number;
    height: number;
  } | null = null;

  getSelection(): SelectionRect | null {
    return this.currentSelection;
  }

  getCustomMask(): Set<string> | null {
    return this.customMask;
  }

  setCustomMask(mask: Set<string> | null): void {
    if (!mask || mask.size === 0) {
      this.customMask = null;
      this.currentSelection = null;
      return;
    }
    this.customMask = new Set(mask);
    this.currentSelection = this.getMaskBoundingBox();
  }

  getMaskBoundingBox(): SelectionRect | null {
    if (!this.customMask || this.customMask.size === 0) {
      return this.currentSelection;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const key of this.customMask) {
      const { x, y } = keyToCoord(key);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    if (minX === Infinity) return null;
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  // Chon vung bang Cay dua than (Magic Wand)
  selectByWand(
    startX: number,
    startY: number,
    contiguous: boolean,
    tolerance: number,
    pixels: Record<string, string>,
    width: number,
    height: number
  ): Set<string> {
    const mask = new Set<string>();
    const startKey = coordToKey(startX, startY);
    const targetColor = pixels[startKey] || null;

    if (contiguous) {
      // Thuat toan BFS loang 4 huong cho che do lien ke
      const queue: Point2D[] = [{ x: startX, y: startY }];
      const visited = new Set<string>();
      visited.add(startKey);

      while (queue.length > 0) {
        const { x, y } = queue.shift()!;
        const key = coordToKey(x, y);
        const curColor = pixels[key] || null;

        if (isColorMatch(curColor, targetColor, tolerance)) {
          mask.add(key);

          const neighbors: Point2D[] = [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 }
          ];

          for (const n of neighbors) {
            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
              const nKey = coordToKey(n.x, n.y);
              if (!visited.has(nKey)) {
                visited.add(nKey);
                queue.push(n);
              }
            }
          }
        }
      }
    } else {
      // Quet toan bo pixel tren canvas
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const key = coordToKey(x, y);
          const curColor = pixels[key] || null;
          if (isColorMatch(curColor, targetColor, tolerance)) {
            mask.add(key);
          }
        }
      }
    }

    this.setCustomMask(mask);
    return mask;
  }

  setSelection(rect: SelectionRect | null): void {
    if (!rect) {
      this.currentSelection = null;
      this.customMask = null;
      return;
    }
    // Chuan hoa de x, y luon la goc tren ben trai va width, height duong
    const x = Math.min(rect.x, rect.x + rect.width);
    const y = Math.min(rect.y, rect.y + rect.height);
    const width = Math.abs(rect.width);
    const height = Math.abs(rect.height);

    if (width === 0 || height === 0) {
      this.currentSelection = null;
      this.customMask = null;
    } else {
      this.currentSelection = { x, y, width, height };
      this.customMask = null; // Chuyen sang che do vung chon hinh chu nhat
    }
  }

  clearSelection(): void {
    this.currentSelection = null;
    this.customMask = null;
    this.floating = null;
  }

  isPixelSelected(x: number, y: number): boolean {
    if (this.customMask) {
      return this.customMask.has(coordToKey(x, y));
    }
    return this.isPointInsideSelection(x, y);
  }

  isPointInsideSelection(px: number, py: number): boolean {
    if (this.customMask) {
      return this.customMask.has(coordToKey(px, py));
    }
    if (!this.currentSelection) return false;
    const { x, y, width, height } = this.currentSelection;
    return px >= x && px < x + width && py >= y && py < y + height;
  }

  // --- FLOATING SELECTION MOVE (Co che vung chon noi nhu Photoshop/Aseprite) ---

  hasFloating(): boolean {
    return this.floating !== null;
  }

  getFloating(): FloatingSelection | null {
    return this.floating;
  }

  // Nhac cac pixel trong vung chon thanh Floating Selection va lam trong vung chon ban dau
  liftSelection(
    buffer: PixelBuffer,
    layerId: string,
    frameIndex: number,
    layerPixels: Record<string, PixelColor>
  ): boolean {
    if (!this.currentSelection) return false;

    // Neu da co floating selection dang hoat dong thi khong nhac lai
    if (this.floating) return true;

    const { x, y, width, height } = this.currentSelection;
    const pixels: CopiedPixel[] = [];
    const cutChanges: PixelChange[] = [];

    // Trich xuat cac pixel co mau va lam trong vung chon ban dau tren Layer
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const px = x + c;
        const py = y + r;
        if (buffer.isValidCoord(px, py)) {
          const color = buffer.getPixel(px, py);
          if (color) {
            pixels.push({ relX: c, relY: r, color });
            // Lam trong diem anh tai vi tri ban dau
            buffer.setPixel(px, py, null);
            delete layerPixels[coordToKey(px, py)];
            cutChanges.push({
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

    if (pixels.length === 0) {
      return false;
    }

    this.floating = {
      originRect: { ...this.currentSelection },
      currentRect: { ...this.currentSelection },
      pixels,
      cutOriginalChanges: cutChanges
    };

    return true;
  }

  // Cap nhat vi tri noi theo do lech chuot (dx, dy) tu vi tri bat dau keo
  updateFloatingOffset(dx: number, dy: number): void {
    if (!this.floating) return;
    this.floating.currentRect = {
      x: this.floating.originRect.x + dx,
      y: this.floating.originRect.y + dy,
      width: this.floating.originRect.width,
      height: this.floating.originRect.height
    };
    // Vung chon chay theo vi tri noi
    this.currentSelection = { ...this.floating.currentRect };
  }

  // Ap cac pixel noi xuong Layer tai vi tri moi khi nguoi dung nha chuot hoac hoan tat
  commitFloating(
    buffer: PixelBuffer,
    layerId: string,
    frameIndex: number,
    layerPixels: Record<string, PixelColor>
  ): PixelChange[] {
    if (!this.floating) return [];

    const finalChanges: PixelChange[] = [...this.floating.cutOriginalChanges];
    const { currentRect, pixels } = this.floating;

    // Gan cac diem anh noi vao vi tri moi
    for (const item of pixels) {
      const destX = currentRect.x + item.relX;
      const destY = currentRect.y + item.relY;

      if (buffer.isValidCoord(destX, destY)) {
        const oldColor = buffer.getPixel(destX, destY);
        buffer.setPixel(destX, destY, item.color);
        layerPixels[coordToKey(destX, destY)] = item.color;
        finalChanges.push({
          x: destX,
          y: destY,
          oldColor,
          newColor: item.color,
          layerId,
          frameIndex
        });
      }
    }

    // Dat vung chon tai vi tri moi
    this.currentSelection = { ...currentRect };
    this.floating = null;

    return finalChanges;
  }

  // Huy bo trang thai floating ma khong commit xuong layer cu (dung cho Ctrl+J)
  cancelFloating(): void {
    this.floating = null;
  }

  // --- CLIPBOARD (Copy, Paste, Delete) ---

  copySelection(buffer: PixelBuffer): boolean {
    if (!this.currentSelection) return false;

    // Neu dang co floating selection, copy truc tiep tu floating
    if (this.floating) {
      this.clipboard = {
        pixels: [...this.floating.pixels],
        width: this.floating.currentRect.width,
        height: this.floating.currentRect.height
      };
      return true;
    }

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

    this.currentSelection = {
      x: targetX,
      y: targetY,
      width: this.clipboard.width,
      height: this.clipboard.height
    };

    return changes;
  }

  deleteSelection(
    buffer: PixelBuffer,
    layerId: string,
    frameIndex: number,
    layerPixels: Record<string, PixelColor>
  ): PixelChange[] {
    if (!this.currentSelection) return [];

    // Neu dang co floating selection thi chi can huy floating
    if (this.floating) {
      const changes = [...this.floating.cutOriginalChanges];
      this.floating = null;
      this.currentSelection = null;
      return changes;
    }

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
}
