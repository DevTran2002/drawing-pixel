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
