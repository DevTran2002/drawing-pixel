// apps/studio/src/animation/preview-player.ts
// Bo phat hoat anh xem truoc mini realtime

import { CanvasProject } from '@pixel-draw/shared-types';
import { AnimationController } from './animation-controller';

export class PreviewPlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: CanvasProject;
  private controller: AnimationController;

  private isPlaying = false;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private previewFrameIndex = 0;

  constructor(
    canvas: HTMLCanvasElement,
    project: CanvasProject,
    controller: AnimationController
  ) {
    this.canvas = canvas;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Khong the khoi tao Preview Player context');
    }
    this.ctx = context;
    this.project = project;
    this.controller = controller;

    this.renderCurrent();
  }

  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  toggle(): boolean {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private loop = (): void => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const clip = this.controller.getActiveClip();
    const fps = clip ? clip.fps : 10;
    const frameInterval = 1000 / fps;

    if (now - this.lastFrameTime >= frameInterval) {
      this.lastFrameTime = now;
      this.previewFrameIndex = this.controller.getNextFrameIndex(this.previewFrameIndex);
      this.renderFrame(this.previewFrameIndex);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  renderCurrent(): void {
    this.renderFrame(this.project.activeFrameIndex);
  }

  private renderFrame(frameIndex: number): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const frame = this.project.frames[frameIndex];
    if (!frame) return;

    const scale = Math.min(
      Math.floor(this.canvas.width / this.project.width),
      Math.floor(this.canvas.height / this.project.height)
    ) || 1;

    const offsetX = Math.floor((this.canvas.width - this.project.width * scale) / 2);
    const offsetY = Math.floor((this.canvas.height - this.project.height * scale) / 2);

    for (const layer of frame.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;

      for (const [key, color] of Object.entries(layer.pixels)) {
        if (!color) continue;
        const [xStr, yStr] = key.split(',');
        const px = parseInt(xStr, 10);
        const py = parseInt(yStr, 10);
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + px * scale, offsetY + py * scale, scale, scale);
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
