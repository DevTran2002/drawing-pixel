// Trinh ghep lop do hoa da tang (Modular Paper Doll Compositor) theo chuan LPC 64x64
// Quan ly cac lop phu kien, thu tu Z-Order va vong lap hoat canh thoi gian thuc

import {
  LpcDirection,
  LpcActionGroup,
  LPC_GRID_CONFIG,
  LPC_ACTION_GROUPS,
  getLpcFrameRect
} from './lpc-matrix';

export type LpcLayerCategory =
  | 'shadow'
  | 'body'
  | 'head'
  | 'torso'
  | 'legs'
  | 'hair'
  | 'weapons';

export interface LpcAssetItem {
  id: string;
  name: string;
  category: LpcLayerCategory;
  zIndex: number;
  imageUrl: string;
  imageElement?: HTMLImageElement;
  tintColor?: string;
  enabled: boolean;
}

export class LpcCompositor {
  private layers: LpcAssetItem[] = [];
  private currentActionId = 'walk';
  private currentDirection: LpcDirection = 'down';
  private currentFrameIndex = 0;
  private fps = 10;
  private isPlaying = false;
  private animationTimer: any = null;

  // Canvas dem an 64x64 de ghep cac lop voi do net pixel toi da
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;

  // Ham lang nghe cap nhat frame khi dang phat
  public onFrameUpdate?: (frameIndex: number) => void;

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = LPC_GRID_CONFIG.frameWidth;
    this.offscreenCanvas.height = LPC_GRID_CONFIG.frameHeight;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    if (this.offscreenCtx) {
      this.offscreenCtx.imageSmoothingEnabled = false;
    }
  }

  // Nap hoac cap nhat mot layer phu kien
  public async addOrUpdateLayer(item: LpcAssetItem): Promise<void> {
    if (!item.imageElement) {
      item.imageElement = await this.loadImage(item.imageUrl);
    }
    const idx = this.layers.findIndex((l) => l.id === item.id);
    if (idx >= 0) {
      this.layers[idx] = item;
    } else {
      this.layers.push(item);
    }
    // Sap xep cac layer tang dan theo Z-Order
    this.layers.sort((a, b) => a.zIndex - b.zIndex);
  }

  // Xoa mot layer
  public removeLayer(layerId: string): void {
    this.layers = this.layers.filter((l) => l.id !== layerId);
  }

  // Bat hoac tat mot layer
  public setLayerEnabled(layerId: string, enabled: boolean): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.enabled = enabled;
    }
  }

  // Lay danh sach cac layer hien co
  public getLayers(): LpcAssetItem[] {
    return [...this.layers];
  }

  // Chon hanh dong
  public setAction(actionId: string): void {
    const group = this.getActionGroup(actionId);
    if (group) {
      this.currentActionId = actionId;
      this.fps = group.defaultFps;
      this.currentFrameIndex = 0;
    }
  }

  // Chon huong nhin (up, left, down, right)
  public setDirection(direction: LpcDirection): void {
    this.currentDirection = direction;
    const maxFrames = this.getCurrentTotalFrames();
    if (this.currentFrameIndex >= maxFrames) {
      this.currentFrameIndex = 0;
    }
  }

  // Chinh toc do khung hinh
  public setFps(fps: number): void {
    this.fps = Math.max(1, Math.min(60, fps));
    if (this.isPlaying) {
      this.stopAnimation();
      this.startAnimation();
    }
  }

  public getFps(): number {
    return this.fps;
  }

  public getCurrentActionId(): string {
    return this.currentActionId;
  }

  public getCurrentDirection(): LpcDirection {
    return this.currentDirection;
  }

  public getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  // Lay thong tin nhom hanh dong hien tai
  public getActionGroup(actionId = this.currentActionId): LpcActionGroup | undefined {
    return LPC_ACTION_GROUPS.find((g) => g.id === actionId);
  }

  // Lay tong so khung hinh cua huong nhin va hanh dong hien tai
  public getCurrentTotalFrames(): number {
    const group = this.getActionGroup();
    if (!group) return 1;
    const dirInfo = group.directions[this.currentDirection];
    return dirInfo ? dirInfo.frameCount : 1;
  }

  // Lay chi so hang tren sheet LPC cua huong nhin hien tai
  public getCurrentRowIndex(): number {
    const group = this.getActionGroup();
    if (!group) return 0;
    const dirInfo = group.directions[this.currentDirection];
    return dirInfo ? dirInfo.rowIndex : 0;
  }

  // Bat dau vong lap hoat canh
  public startAnimation(callback?: (frameIndex: number) => void): void {
    if (callback) this.onFrameUpdate = callback;
    this.isPlaying = true;
    if (this.animationTimer) clearInterval(this.animationTimer);

    const interval = Math.max(16, Math.floor(1000 / this.fps));
    this.animationTimer = setInterval(() => {
      this.stepNextFrame();
    }, interval);
  }

  // Tam dung vong lap hoat canh
  public stopAnimation(): void {
    this.isPlaying = false;
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  public isAnimationRunning(): boolean {
    return this.isPlaying;
  }

  // Nhay sang khung hinh tiep theo
  public stepNextFrame(): void {
    const total = this.getCurrentTotalFrames();
    const group = this.getActionGroup();
    const isLoop = group ? group.loop : true;

    if (this.currentFrameIndex + 1 < total) {
      this.currentFrameIndex++;
    } else {
      if (isLoop) {
        this.currentFrameIndex = 0;
      } else {
        // Neu khong lap, dung o frame cuoi
        this.currentFrameIndex = total - 1;
      }
    }

    if (this.onFrameUpdate) {
      this.onFrameUpdate(this.currentFrameIndex);
    }
  }

  public setFrameIndex(index: number): void {
    const total = this.getCurrentTotalFrames();
    this.currentFrameIndex = Math.max(0, Math.min(total - 1, index));
    if (this.onFrameUpdate) {
      this.onFrameUpdate(this.currentFrameIndex);
    }
  }

  // Render toan bo cac lop tai frame hien tai len mot context dich
  public renderCurrentFrame(
    targetCtx: CanvasRenderingContext2D,
    destWidth = 256,
    destHeight = 256,
    clearTarget = true
  ): void {
    if (!this.offscreenCtx) return;

    // 1. Xoa canvas dem an
    this.offscreenCtx.clearRect(0, 0, LPC_GRID_CONFIG.frameWidth, LPC_GRID_CONFIG.frameHeight);

    const col = this.currentFrameIndex;
    const row = this.getCurrentRowIndex();
    const rect = getLpcFrameRect(col, row);

    // 2. Ve cac layer da kich hoat theo thu tu Z-Order
    for (const layer of this.layers) {
      if (!layer.enabled || !layer.imageElement) continue;

      this.offscreenCtx.drawImage(
        layer.imageElement,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        LPC_GRID_CONFIG.frameWidth,
        LPC_GRID_CONFIG.frameHeight
      );
    }

    // 3. Phong to len Canvas xem truoc voi che do pixelated
    targetCtx.imageSmoothingEnabled = false;
    if (clearTarget) {
      targetCtx.clearRect(0, 0, destWidth, destHeight);
    }
    targetCtx.drawImage(
      this.offscreenCanvas,
      0,
      0,
      LPC_GRID_CONFIG.frameWidth,
      LPC_GRID_CONFIG.frameHeight,
      0,
      0,
      destWidth,
      destHeight
    );
  }

  // Lay canvas composite 64x64 hien tai de chuyen doi sang LayerData
  public getCompositeCanvas(): HTMLCanvasElement {
    if (!this.offscreenCtx) return this.offscreenCanvas;

    this.offscreenCtx.clearRect(0, 0, LPC_GRID_CONFIG.frameWidth, LPC_GRID_CONFIG.frameHeight);
    const col = this.currentFrameIndex;
    const row = this.getCurrentRowIndex();
    const rect = getLpcFrameRect(col, row);

    for (const layer of this.layers) {
      if (!layer.enabled || !layer.imageElement) continue;

      this.offscreenCtx.drawImage(
        layer.imageElement,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        LPC_GRID_CONFIG.frameWidth,
        LPC_GRID_CONFIG.frameHeight
      );
    }

    // Tra ve ban clone canvas de tranh xung dot
    const clone = document.createElement('canvas');
    clone.width = LPC_GRID_CONFIG.frameWidth;
    clone.height = LPC_GRID_CONFIG.frameHeight;
    const cloneCtx = clone.getContext('2d');
    if (cloneCtx) {
      cloneCtx.imageSmoothingEnabled = false;
      cloneCtx.drawImage(this.offscreenCanvas, 0, 0);
    }
    return clone;
  }

  // Cat mot frame cu the (col, row) sau khi da ghep tat ca layer
  public compositeFrameAt(col: number, row: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = LPC_GRID_CONFIG.frameWidth;
    canvas.height = LPC_GRID_CONFIG.frameHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = false;
    const rect = getLpcFrameRect(col, row);

    for (const layer of this.layers) {
      if (!layer.enabled || !layer.imageElement) continue;
      ctx.drawImage(
        layer.imageElement,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        LPC_GRID_CONFIG.frameWidth,
        LPC_GRID_CONFIG.frameHeight
      );
    }
    return canvas;
  }

  // Helper tai anh bat dong bo
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error(`Khong the tai anh LPC tu ${src}: ${err}`));
      img.src = src;
    });
  }
}
