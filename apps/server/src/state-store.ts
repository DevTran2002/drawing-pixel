// apps/server/src/state-store.ts
// Bo dem luu tru trang thai Canvas trong RAM phia Server

import {
  CanvasProject,
  createDefaultProject,
  PixelColor,
  PixelPoint,
  coordToKey,
  keyToCoord
} from '@pixel-draw/shared-types';
import { exportPngBuffer, exportSpriteSheetBuffer, generateSpriteSheetMetadata, saveToFile } from './exporter';
import path from 'path';

export class StateStore {
  private project: CanvasProject;

  constructor() {
    this.project = createDefaultProject(24, 24, 'HeroSprite');
  }

  getProject(): CanvasProject {
    return this.project;
  }

  setProject(proj: CanvasProject): void {
    this.project = proj;
  }

  // Tao canvas moi
  createCanvas(width: number, height: number, name = 'Sprite'): CanvasProject {
    this.project = createDefaultProject(width, height, name);
    return this.project;
  }

  // Thay doi kich thuoc Canvas va can chinh vi tri pixel cu
  resizeCanvas(newWidth: number, newHeight: number, anchor = 'center'): CanvasProject {
    const oldWidth = this.project.width;
    const oldHeight = this.project.height;

    let dx = 0;
    let dy = 0;

    switch (anchor) {
      case 'top-left':
        dx = 0;
        dy = 0;
        break;
      case 'top-center':
        dx = Math.floor((newWidth - oldWidth) / 2);
        dy = 0;
        break;
      case 'top-right':
        dx = newWidth - oldWidth;
        dy = 0;
        break;
      case 'center-left':
        dx = 0;
        dy = Math.floor((newHeight - oldHeight) / 2);
        break;
      case 'center':
      default:
        dx = Math.floor((newWidth - oldWidth) / 2);
        dy = Math.floor((newHeight - oldHeight) / 2);
        break;
      case 'center-right':
        dx = newWidth - oldWidth;
        dy = Math.floor((newHeight - oldHeight) / 2);
        break;
      case 'bottom-left':
        dx = 0;
        dy = newHeight - oldHeight;
        break;
      case 'bottom-center':
        dx = Math.floor((newWidth - oldWidth) / 2);
        dy = newHeight - oldHeight;
        break;
      case 'bottom-right':
        dx = newWidth - oldWidth;
        dy = newHeight - oldHeight;
        break;
    }

    for (const frame of this.project.frames) {
      for (const layer of frame.layers) {
        const newPixels: Record<string, PixelColor> = {};
        for (const [key, color] of Object.entries(layer.pixels)) {
          const coord = keyToCoord(key);
          const nx = coord.x + dx;
          const ny = coord.y + dy;
          if (nx >= 0 && nx < newWidth && ny >= 0 && ny < newHeight) {
            newPixels[coordToKey(nx, ny)] = color;
          }
        }
        layer.pixels = newPixels;
      }
    }

    this.project.width = newWidth;
    this.project.height = newHeight;
    this.project.pivot = {
      x: Math.floor(newWidth / 2),
      y: newHeight
    };

    return this.project;
  }

  // Them layer chua anh sinh boi AI vao Canvas, tu dong tang kich thuoc neu can
  addAiLayer(
    pixels: PixelPoint[],
    width: number,
    height: number,
    layerName?: string,
    hidePrevious = true
  ): string {
    // Neu kich thuoc anh lon hon canvas hien tai thi mo rong canvas
    if (width > this.project.width || height > this.project.height) {
      const targetW = Math.max(width, this.project.width);
      const targetH = Math.max(height, this.project.height);
      this.resizeCanvas(targetW, targetH, 'center');
    }

    const offsetX = Math.floor((this.project.width - width) / 2);
    const offsetY = Math.floor((this.project.height - height) / 2);

    const newLayerId = `layer_${Date.now()}`;
    const newLayerName = layerName || 'AI Generated';

    const activeFrame = this.project.frames[this.project.activeFrameIndex] || this.project.frames[0];
    if (!activeFrame) return newLayerId;

    // Tu dong tam an cac layer cu de tranh bi chong hinh len nhau
    if (hidePrevious) {
      for (const layer of activeFrame.layers) {
        layer.visible = false;
      }
    }

    const newLayer = {
      id: newLayerId,
      name: newLayerName,
      visible: true,
      locked: false,
      opacity: 1.0,
      pixels: {} as Record<string, PixelColor>
    };

    for (const p of pixels) {
      const targetX = p.x + offsetX;
      const targetY = p.y + offsetY;
      if (targetX >= 0 && targetX < this.project.width && targetY >= 0 && targetY < this.project.height) {
        if (p.color) {
          newLayer.pixels[coordToKey(targetX, targetY)] = p.color;
        }
      }
    }

    activeFrame.layers.push(newLayer);
    this.project.activeLayerId = newLayerId;
    return newLayerId;
  }

  // Ap dung danh sach pixel
  applyPixels(pixels: PixelPoint[], layerId?: string, frameIndex?: number): void {
    const fIdx = frameIndex !== undefined ? frameIndex : this.project.activeFrameIndex;
    const frame = this.project.frames[fIdx];
    if (!frame) return;

    const lId = layerId || this.project.activeLayerId;
    const layer = frame.layers.find(l => l.id === lId) || frame.layers[0];
    if (!layer) return;

    for (const p of pixels) {
      if (p.x >= 0 && p.x < this.project.width && p.y >= 0 && p.y < this.project.height) {
        if (p.color) {
          layer.pixels[coordToKey(p.x, p.y)] = p.color;
        } else {
          delete layer.pixels[coordToKey(p.x, p.y)];
        }
      }
    }
  }

  // Ap dung ma tran ky tu kem bang mau
  applyMatrix(
    matrix: string[],
    paletteMap: Record<string, PixelColor>,
    offsetX = 0,
    offsetY = 0,
    layerId?: string,
    frameIndex?: number
  ): void {
    const pixels: PixelPoint[] = [];
    for (let r = 0; r < matrix.length; r++) {
      const line = matrix[r];
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        const color = paletteMap[ch] !== undefined ? paletteMap[ch] : null;
        pixels.push({
          x: c + offsetX,
          y: r + offsetY,
          color
        });
      }
    }
    this.applyPixels(pixels, layerId, frameIndex);
  }

  // Them frame moi
  addFrame(clipName = 'idle', copyPrevious = true): number {
    const prevFrame = this.project.frames[this.project.frames.length - 1];
    const newLayers = prevFrame.layers.map(l => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      pixels: copyPrevious ? { ...l.pixels } : {}
    }));

    this.project.frames.push({
      id: `frame_${Date.now()}`,
      durationMs: 100,
      layers: newLayers
    });

    const clip = this.project.clips.find(c => c.name === clipName);
    if (clip) {
      clip.endFrame = this.project.frames.length - 1;
    } else {
      this.project.clips.push({
        id: `clip_${Date.now()}`,
        name: clipName,
        startFrame: this.project.frames.length - 1,
        endFrame: this.project.frames.length - 1,
        fps: 10,
        loop: true
      });
    }

    this.project.activeFrameIndex = this.project.frames.length - 1;
    return this.project.activeFrameIndex;
  }

  // Xuat SpriteSheet va metadata ra thu muc du an
  async exportSpriteSheet(
    outputPath: string,
    scale = 1,
    includeJsonMeta = true
  ): Promise<{ pngPath: string; jsonPath?: string }> {
    const buffer = await exportSpriteSheetBuffer(
      this.project.width,
      this.project.height,
      this.project.frames,
      scale
    );

    const savedPng = await saveToFile(outputPath, buffer);

    let savedJson: string | undefined;
    if (includeJsonMeta) {
      const parsedPath = path.parse(outputPath);
      const jsonPath = path.join(parsedPath.dir, `${parsedPath.name}.json`);
      const meta = generateSpriteSheetMetadata(
        this.project.width,
        this.project.height,
        scale,
        this.project.frames,
        this.project.clips,
        parsedPath.base
      );
      savedJson = await saveToFile(jsonPath, JSON.stringify(meta, null, 2));
    }

    return { pngPath: savedPng, jsonPath: savedJson };
  }
}
