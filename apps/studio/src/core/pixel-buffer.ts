// apps/studio/src/core/pixel-buffer.ts
// Quan ly mang diem anh 2D cho tung lop (layer)

import { PixelColor, PixelPoint, coordToKey, keyToCoord } from '@pixel-draw/shared-types';

export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  private pixels: Map<string, PixelColor> = new Map();

  constructor(width: number, height: number, initialPixels?: Record<string, PixelColor>) {
    this.width = width;
    this.height = height;
    if (initialPixels) {
      for (const [key, color] of Object.entries(initialPixels)) {
        if (color !== null && color !== undefined) {
          this.pixels.set(key, color);
        }
      }
    }
  }

  // Kiem tra toa do co hop le trong khung canvas khong
  isValidCoord(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // Lay ma mau pixel tai toa do
  getPixel(x: number, y: number): PixelColor {
    if (!this.isValidCoord(x, y)) {
      return null;
    }
    return this.pixels.get(coordToKey(x, y)) || null;
  }

  // Dat ma mau cho pixel tai toa do, tra ve true neu hop le
  setPixel(x: number, y: number, color: PixelColor): boolean {
    if (!this.isValidCoord(x, y)) {
      return false;
    }
    const key = coordToKey(x, y);
    if (!color) {
      this.pixels.delete(key);
    } else {
      this.pixels.set(key, color);
    }
    return true;
  }

  // Xoa toan bo buffer ve trong suot
  clear(): void {
    this.pixels.clear();
  }

  // Nap ma tran ky tu kem bang mau
  fromMatrix(matrix: string[], paletteMap: Record<string, PixelColor>, offsetX = 0, offsetY = 0): void {
    for (let row = 0; row < matrix.length; row++) {
      const line = matrix[row];
      for (let col = 0; col < line.length; col++) {
        const char = line[col];
        const targetX = col + offsetX;
        const targetY = row + offsetY;
        if (this.isValidCoord(targetX, targetY)) {
          const color = paletteMap[char] !== undefined ? paletteMap[char] : null;
          this.setPixel(targetX, targetY, color);
        }
      }
    }
  }

  // Xuat danh sach tat ca cac pixel hien co
  getAllPixels(): PixelPoint[] {
    const list: PixelPoint[] = [];
    for (const [key, color] of this.pixels.entries()) {
      const coord = keyToCoord(key);
      list.push({ x: coord.x, y: coord.y, color });
    }
    return list;
  }

  // Chuyen thanh doi tuong Record de luu vao JSON project hoac truyen qua mang
  toRecord(): Record<string, PixelColor> {
    const record: Record<string, PixelColor> = {};
    for (const [key, color] of this.pixels.entries()) {
      record[key] = color;
    }
    return record;
  }

  // Sao chep mot ban sao doc lap cua buffer
  clone(): PixelBuffer {
    const copy = new PixelBuffer(this.width, this.height);
    for (const [key, color] of this.pixels.entries()) {
      copy.pixels.set(key, color);
    }
    return copy;
  }
}
