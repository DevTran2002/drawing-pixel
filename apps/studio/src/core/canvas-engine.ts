// apps/studio/src/core/canvas-engine.ts
// Dieu khien hien thi HTML5 Canvas, xu ly thu phong, keo luoi va toa do

import { CanvasProject, FrameData, LayerData, Point2D } from '@pixel-draw/shared-types';
import { PixelBuffer } from './pixel-buffer';

export interface CanvasEngineOptions {
  canvas: HTMLCanvasElement;
  project: CanvasProject;
  showGrid?: boolean;
  showPivot?: boolean;
  onPixelClick?: (x: number, y: number, isRightClick: boolean) => void;
}

export class CanvasEngine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  project: CanvasProject;

  // Viewport states
  zoom = 16; // He so phong to (vi du 16x tuong duong 1600%)
  panOffset: Point2D = { x: 0, y: 0 };
  showGrid = true;
  showPivot = true;

  // Cache buffer cho frame va layer dang duoc chon
  private layerBuffers: Map<string, PixelBuffer> = new Map();
  private layerOffscreenCanvases: Map<string, HTMLCanvasElement> = new Map();

  constructor(options: CanvasEngineOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Khong the khoi tao Canvas 2D context');
    }
    this.ctx = context;
    this.project = options.project;
    this.showGrid = options.showGrid ?? true;
    this.showPivot = options.showPivot ?? true;

    this.rebuildBuffers();
    this.centerViewport();
  }

  // Tao lai buffer tu project data
  rebuildBuffers(): void {
    this.layerBuffers.clear();
    const currentFrame = this.getCurrentFrame();
    if (currentFrame) {
      for (const layer of currentFrame.layers) {
        this.layerBuffers.set(
          layer.id,
          new PixelBuffer(this.project.width, this.project.height, layer.pixels)
        );
      }
    }
  }

  getCurrentFrame(): FrameData | undefined {
    return this.project.frames[this.project.activeFrameIndex];
  }

  getLayerBuffer(layerId: string): PixelBuffer | undefined {
    return this.layerBuffers.get(layerId);
  }

  getActiveLayerBuffer(): PixelBuffer | undefined {
    return this.layerBuffers.get(this.project.activeLayerId);
  }

  // Can giua canvas vao trung tam viewport
  centerViewport(): void {
    const totalWidth = this.project.width * this.zoom;
    const totalHeight = this.project.height * this.zoom;
    this.panOffset = {
      x: Math.floor((this.canvas.width - totalWidth) / 2),
      y: Math.floor((this.canvas.height - totalHeight) / 2)
    };
  }

  // Tu dong tinh toan Zoom de toan bo buc tranh nam vua van chinh giua Viewport
  fitToScreen(): void {
    if (this.canvas.width <= 0 || this.canvas.height <= 0 || this.project.width <= 0 || this.project.height <= 0) return;
    const padding = 60;
    const availW = Math.max(100, this.canvas.width - padding);
    const availH = Math.max(100, this.canvas.height - padding);
    const maxZoomW = availW / this.project.width;
    const maxZoomH = availH / this.project.height;
    const bestZoom = Math.min(maxZoomW, maxZoomH);

    if (bestZoom >= 1) {
      this.zoom = Math.max(1, Math.min(32, Math.floor(bestZoom)));
    } else {
      this.zoom = Math.max(1, Math.round(bestZoom * 10) / 10);
    }
    this.centerViewport();
  }

  // Thay doi kich thuoc canvas viewport phu hop voi container thuc te
  resizeToContainer(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      const isInitial = this.panOffset.x === 0 && this.panOffset.y === 0;
      const dx = (width - this.canvas.width) / 2;
      const dy = (height - this.canvas.height) / 2;

      this.canvas.width = width;
      this.canvas.height = height;

      if (isInitial) {
        this.centerViewport();
      } else {
        this.panOffset.x = Math.round(this.panOffset.x + dx);
        this.panOffset.y = Math.round(this.panOffset.y + dy);
      }
    }
  }

  // Thu phong giu vi tri diem anh duoi con tro chuot
  zoomAt(clientX: number, clientY: number, deltaZoom: number): void {
    const targetPixelX = (clientX - this.panOffset.x) / this.zoom;
    const targetPixelY = (clientY - this.panOffset.y) / this.zoom;
    const oldZoom = this.zoom;
    this.zoom = Math.max(2, Math.min(64, this.zoom + deltaZoom));
    if (this.zoom !== oldZoom) {
      this.panOffset.x = Math.round(clientX - targetPixelX * this.zoom);
      this.panOffset.y = Math.round(clientY - targetPixelY * this.zoom);
    }
  }

  // Chuyen doi toa do chuot tren canvas sang toa do pixel thuc
  screenToPixel(screenX: number, screenY: number): Point2D | null {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = screenX - rect.left;
    const clientY = screenY - rect.top;

    const pixelX = Math.floor((clientX - this.panOffset.x) / this.zoom);
    const pixelY = Math.floor((clientY - this.panOffset.y) / this.zoom);

    if (pixelX < 0 || pixelX >= this.project.width || pixelY < 0 || pixelY >= this.project.height) {
      return null;
    }
    return { x: pixelX, y: pixelY };
  }

  // Ve toan bo khung nhin
  render(onionSkinCanvas?: HTMLCanvasElement): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false; // Luon giu pixelated sac canh

    // 1. Xoa nen toan bo khung canvas voi mau toi studio
    ctx.fillStyle = '#121215';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.panOffset.x, this.panOffset.y);

    const artWidth = this.project.width * this.zoom;
    const artHeight = this.project.height * this.zoom;

    // 2. Ve nen caro trong suot (checkerboard) cho vung lam viec
    this.renderCheckerboard(artWidth, artHeight);

    // Vien vien nhe bao quanh buc tranh de de nhan dien vung ve
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-0.5, -0.5, artWidth + 1, artHeight + 1);

    // 3. Neu co Onion Skin, ve len truoc
    if (onionSkinCanvas) {
      ctx.drawImage(onionSkinCanvas, 0, 0, artWidth, artHeight);
    }

    // 4. Ve cac layer theo thu tu
    const currentFrame = this.getCurrentFrame();
    if (currentFrame) {
      for (const layer of currentFrame.layers) {
        if (!layer.visible) continue;
        // Neu layer thuoc group va group bi an thi khong ve
        if (layer.groupId) {
          const group = this.project.groups?.find(g => g.id === layer.groupId);
          if (group && group.visible === false) continue;
        }
        const buffer = this.layerBuffers.get(layer.id);
        if (!buffer) continue;

        ctx.save();
        ctx.globalAlpha = layer.opacity;

        const pixels = buffer.getAllPixels();
        if (pixels.length > 2500 || this.project.width * this.project.height > 10000) {
          let off = this.layerOffscreenCanvases.get(layer.id);
          if (!off || off.width !== this.project.width || off.height !== this.project.height) {
            off = document.createElement('canvas');
            off.width = this.project.width;
            off.height = this.project.height;
            this.layerOffscreenCanvases.set(layer.id, off);
          }
          const offCtx = off.getContext('2d');
          if (offCtx) {
            offCtx.clearRect(0, 0, off.width, off.height);
            const imgData = offCtx.createImageData(off.width, off.height);
            const data32 = new Uint32Array(imgData.data.buffer);
            for (const p of pixels) {
              if (!p.color) continue;
              const idx = p.y * off.width + p.x;
              const hex = p.color.replace('#', '');
              if (hex.length >= 6) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                data32[idx] = (255 << 24) | (b << 16) | (g << 8) | r;
              }
            }
            offCtx.putImageData(imgData, 0, 0);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(off, 0, 0, artWidth, artHeight);
          }
        } else {
          for (const p of pixels) {
            if (!p.color) continue;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x * this.zoom, p.y * this.zoom, this.zoom, this.zoom);
          }
        }
        ctx.restore();
      }
    }

    // 5. Ve luoi diem anh neu dang bat va do phong to >= 4x
    if (this.showGrid && this.zoom >= 6) {
      this.renderPixelGrid(artWidth, artHeight);
    }

    // 6. Ve diem neo pivot nhan vat
    if (this.showPivot && this.project.pivot) {
      this.renderPivotMarker(this.project.pivot.x, this.project.pivot.y);
    }

    // 7. Ve vung chon noi (Floating Selection) neu co
    if (this.floatingSelection) {
      ctx.save();
      for (const p of this.floatingSelection.pixels) {
        if (!p.color) continue;
        const px = this.floatingSelection.currentRect.x + p.relX;
        const py = this.floatingSelection.currentRect.y + p.relY;
        ctx.fillStyle = p.color;
        ctx.fillRect(px * this.zoom, py * this.zoom, this.zoom, this.zoom);
      }
      ctx.restore();
    }

    // 8. Ve duong vien vung chon (Selection Overlay)
    if (this.selectionRect) {
      this.renderSelectionOverlay(this.selectionRect);
    }

    // 9. Ve duong vien bao quanh toan bo canvas
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, artWidth, artHeight);

    ctx.restore();
  }

  // Thuoc tinh luu tru vung chon va floating selection
  public selectionRect: { x: number; y: number; width: number; height: number } | null = null;
  public floatingSelection: any | null = null;

  public setSelection(rect: { x: number; y: number; width: number; height: number } | null): void {
    this.selectionRect = rect;
  }

  public setFloatingSelection(floating: any | null): void {
    this.floatingSelection = floating;
  }

  private renderSelectionOverlay(rect: { x: number; y: number; width: number; height: number }): void {
    const ctx = this.ctx;
    const rx = rect.x * this.zoom;
    const ry = rect.y * this.zoom;
    const rw = rect.width * this.zoom;
    const rh = rect.height * this.zoom;

    // Phu mau xanh duong nhe
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fillRect(rx, ry, rw, rh);

    // Vien net dut marching ants
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }

  private renderCheckerboard(width: number, height: number): void {
    const tileSize = Math.max(8, Math.floor(this.zoom / 2));
    const ctx = this.ctx;
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const isDark = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 1;
        ctx.fillStyle = isDark ? '#27272a' : '#323238';
        const w = Math.min(tileSize, width - x);
        const h = Math.min(tileSize, height - y);
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  private renderPixelGrid(width: number, height: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    // Duong doc
    for (let x = 0; x <= width; x += this.zoom) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    // Duong ngang
    for (let y = 0; y <= height; y += this.zoom) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
  }

  private renderPivotMarker(pivotX: number, pivotY: number): void {
    const ctx = this.ctx;
    const cx = (pivotX + 0.5) * this.zoom;
    const cy = (pivotY + 0.5) * this.zoom;
    const size = Math.max(4, Math.floor(this.zoom * 0.4));

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - size, cy);
    ctx.lineTo(cx + size, cy);
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx, cy + size);
    ctx.stroke();
  }
}
