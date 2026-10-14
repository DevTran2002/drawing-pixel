// apps/studio/src/animation/onion-skin-renderer.ts
// Render bong mo (Onion Skinning) co phan biet mau sac truoc/sau

import { CanvasProject } from '@pixel-draw/shared-types';

export class OnionSkinRenderer {
  private offscreenCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
    const context = this.offscreenCanvas.getContext('2d');
    if (!context) {
      throw new Error('Khong the khoi tao Onion Skin canvas context');
    }
    this.ctx = context;
  }

  resize(width: number, height: number): void {
    this.offscreenCanvas.width = width;
    this.offscreenCanvas.height = height;
  }

  // Render bong mo cua khung hinh truoc (mau do) va khung hinh sau (mau xanh)
  render(project: CanvasProject, enabled: boolean): HTMLCanvasElement | undefined {
    if (!enabled) return undefined;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

    const currentIndex = project.activeFrameIndex;
    const totalFrames = project.frames.length;

    // 1. Khung hinh truoc (mau do nhat)
    if (currentIndex > 0) {
      const prevFrame = project.frames[currentIndex - 1];
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)'; // Do nhat
      for (const layer of prevFrame.layers) {
        if (!layer.visible) continue;
        for (const [key, color] of Object.entries(layer.pixels)) {
          if (!color) continue;
          const [xStr, yStr] = key.split(',');
          ctx.fillRect(parseInt(xStr, 10), parseInt(yStr, 10), 1, 1);
        }
      }
    }

    // 2. Khung hinh tiep theo (mau xanh luc nhat)
    if (currentIndex < totalFrames - 1) {
      const nextFrame = project.frames[currentIndex + 1];
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)'; // Xanh luc nhat
      for (const layer of nextFrame.layers) {
        if (!layer.visible) continue;
        for (const [key, color] of Object.entries(layer.pixels)) {
          if (!color) continue;
          const [xStr, yStr] = key.split(',');
          ctx.fillRect(parseInt(xStr, 10), parseInt(yStr, 10), 1, 1);
        }
      }
    }

    return this.offscreenCanvas;
  }
}
