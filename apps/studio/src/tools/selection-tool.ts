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

export class SelectionManager {
  private currentSelection: SelectionRect | null = null;
  private floating: FloatingSelection | null = null;
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
    this.floating = null;
  }

  isPointInsideSelection(px: number, py: number): boolean {
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
