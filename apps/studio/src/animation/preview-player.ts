// apps/studio/src/animation/preview-player.ts
// Bộ phát hoạt ảnh xem trước mini thời gian thực (Real-time Preview Player)

import { CanvasProject } from '@pixel-draw/shared-types';
import { AnimationController } from './animation-controller';

export class PreviewPlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: CanvasProject;
  private controller: AnimationController;
  private extraCanvases: HTMLCanvasElement[] = [];

  private isPlaying = false;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private previewFrameIndex = 0;

  // Hàm gọi lại thông báo khi khung hình hiện tại thay đổi
  public onFrameChange?: (frameIndex: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    project: CanvasProject,
    controller: AnimationController
  ) {
    this.canvas = canvas;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Không thể khởi tạo ngữ cảnh vẽ Preview Player');
    }
    this.ctx = context;
    this.project = project;
    this.controller = controller;

    this.renderCurrent();
  }

  // Đăng ký thêm canvas phụ để đồng bộ hoạt cảnh thời gian thực (ví dụ trên Timeline)
  public addExtraCanvas(c: HTMLCanvasElement): void {
    if (!this.extraCanvases.includes(c)) {
      this.extraCanvases.push(c);
      this.renderCurrent();
    }
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

  getCurrentPreviewFrameIndex(): number {
    return this.previewFrameIndex;
  }

  private loop = (): void => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const clip = this.controller.getActiveClip();
    const fps = (clip && clip.fps && clip.fps > 0) ? clip.fps : 10;
    const currentFrameData = this.project.frames[this.previewFrameIndex];
    // Tinh frameInterval theo FPS hien tai cua clip de slider FPS dieu toc tuc thi
    const frameInterval = Math.max(16, Math.floor(1000 / fps));

    if (now - this.lastFrameTime >= frameInterval) {
      this.lastFrameTime = now;
      this.previewFrameIndex = this.controller.getNextFrameIndex(this.previewFrameIndex);
      this.renderFrame(this.previewFrameIndex);

      if (this.onFrameChange) {
        this.onFrameChange(this.previewFrameIndex);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  renderCurrent(): void {
    this.previewFrameIndex = this.project.activeFrameIndex;
    this.renderFrame(this.previewFrameIndex);
  }

  private renderFrame(frameIndex: number): void {
    const frame = this.project.frames[frameIndex];
    if (!frame) return;

    const allCanvases = [this.canvas, ...this.extraCanvases];

    for (const cv of allCanvases) {
      const cContext = cv.getContext('2d');
      if (!cContext) continue;

      cContext.imageSmoothingEnabled = false;
      cContext.clearRect(0, 0, cv.width, cv.height);

      const scale = Math.min(
        Math.floor(cv.width / this.project.width),
        Math.floor(cv.height / this.project.height)
      ) || 1;

      const offsetX = Math.floor((cv.width - this.project.width * scale) / 2);
      const offsetY = Math.floor((cv.height - this.project.height * scale) / 2);

      for (const layer of frame.layers) {
        if (!layer.visible) continue;
        if (layer.groupId) {
          const grp = this.project.groups?.find(g => g.id === layer.groupId);
          if (grp && grp.visible === false) continue;
        }
        for (const [key, color] of Object.entries(layer.pixels)) {
          if (!color) continue;
          const [xStr, yStr] = key.split(',');
          const px = parseInt(xStr, 10);
          const py = parseInt(yStr, 10);

          cContext.fillStyle = color;
          cContext.fillRect(offsetX + px * scale, offsetY + py * scale, scale, scale);
        }
      }
    }
  }
}
