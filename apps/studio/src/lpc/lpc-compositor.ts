// Trinh ghep lop do hoa da tang (Modular Paper Doll Compositor) theo chuan LPC 64x64
// Quan ly cac lop phu kien, thu tu Z-Order va vong lap hoat canh thoi gian thuc

import {
  LpcDirection,
  LpcActionGroup,
  LpcFrameRect,
  LPC_GRID_CONFIG,
  LPC_ACTION_GROUPS,
  getLpcFrameRect,
  LPC_MOTION_RIG_OFFSETS
} from './lpc-matrix';
import {
  recolorCanvasByPalette,
  DEFAULT_SOURCE_RAMPS,
  LPC_PALETTES,
  LpcPaletteCategory,
  generateRampFromHex
} from './lpc-palette';

export type LpcLayerCategory =
  | 'shadow'
  | 'body'
  | 'head'
  | 'torso'
  | 'legs'
  | 'feet'
  | 'hat'
  | 'hair'
  | 'tails'
  | 'ears'
  | 'weapons'
  | 'cape'
  | 'belt'
  | 'shield'
  | 'quiver'
  | 'gloves';



export interface LpcAssetItem {
  id: string;
  name: string;
  category: LpcLayerCategory;
  zIndex: number;
  imageUrl: string;
  imageElement?: HTMLImageElement;
  tintColor?: string;
  paletteId?: string; // ID bảng màu đang kích hoạt (ví dụ: 'hair_blonde', 'torso_golden')
  customColor?: string; // Mã màu tự do do người dùng tự chọn (Hex)
  customRamp?: string[]; // Dải màu bóng khối sinh tự động từ màu tự do
  cachedRecolorCanvas?: HTMLCanvasElement | null; // Bộ nhớ đệm canvas toàn sheet đã đổi màu
  activeRows?: Set<number>; // Tập hợp các chỉ số hàng có chứa pixel thực tế trên sheet
  enabled: boolean;
}

export interface LpcLayerDrawInfo {
  rect: LpcFrameRect;
  offsetX: number;
  offsetY: number;
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

  // Phan tich nhanh 54 hang de biet hang nao co pixel thuc te
  private analyzeLayerActiveRows(layer: LpcAssetItem): void {
    if (!layer.imageElement) return;
    const active = new Set<number>();
    try {
      const img = layer.imageElement;
      const canvas = document.createElement('canvas');
      canvas.width = 13;
      canvas.height = LPC_GRID_CONFIG.totalRows;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        layer.activeRows = undefined;
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let r = 0; r < canvas.height; r++) {
        let hasPixel = false;
        for (let c = 0; c < canvas.width; c++) {
          const alphaIndex = (r * canvas.width + c) * 4 + 3;
          if (imgData[alphaIndex] > 0) {
            hasPixel = true;
            break;
          }
        }
        if (hasPixel) {
          active.add(r);
        }
      }
      layer.activeRows = active;
    } catch {
      layer.activeRows = undefined;
    }
  }

  // Nap hoac cap nhat mot layer phu kien
  public async addOrUpdateLayer(item: LpcAssetItem): Promise<void> {
    if (!item.imageElement) {
      item.imageElement = await this.loadImage(item.imageUrl);
    }
    this.analyzeLayerActiveRows(item);
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

  // Bật hoặc tắt một layer
  public setLayerEnabled(layerId: string, enabled: boolean): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.enabled = enabled;
    }
  }

  // Thay đổi tệp ảnh nguồn của layer (ví dụ đổi kiểu tóc, kiểu giáp)
  public async changeLayerImage(layerId: string, newImageUrl: string, newName?: string): Promise<void> {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.imageUrl = newImageUrl;
      if (newName) layer.name = newName;
      layer.imageElement = await this.loadImage(newImageUrl);
      this.analyzeLayerActiveRows(layer);
      layer.cachedRecolorCanvas = null;
    }
  }


  // Cài đặt hoặc đổi bảng màu cho một layer
  public setLayerPalette(layerId: string, paletteId?: string): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.paletteId = paletteId || undefined;
      layer.customColor = undefined; // Bỏ custom color khi người dùng chọn palette mẫu
      layer.customRamp = undefined;
      // Xóa cache cũ để lần vẽ tiếp theo tự động recolor lại với bảng màu mới
      layer.cachedRecolorCanvas = null;
    }
  }

  // Cài đặt màu tùy biến tự do cho một layer (tự động tính dải màu bóng khối)
  public setLayerCustomColor(layerId: string, hexColor?: string): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      if (!hexColor) {
        layer.customColor = undefined;
        layer.customRamp = undefined;
      } else {
        layer.customColor = hexColor;
        layer.paletteId = undefined; // Ưu tiên màu tự do
        layer.customRamp = generateRampFromHex(hexColor, layer.category);
      }
      layer.cachedRecolorCanvas = null;
    }
  }

  // Xóa toàn bộ cache đổi màu
  public clearAllPaletteCaches(): void {
    for (const l of this.layers) {
      l.cachedRecolorCanvas = null;
    }
  }

  // Lấy nguồn ảnh để vẽ (tự động recolor theo Palette Shading hoặc Custom Ramp nếu có)
  public getLayerRenderSource(layer: LpcAssetItem): CanvasImageSource | null {
    if (!layer.imageElement) return null;

    // Nếu không cấu hình bảng màu và cũng không có màu tùy chọn, dùng ảnh gốc
    if (!layer.paletteId && (!layer.customRamp || layer.customRamp.length === 0)) {
      return layer.imageElement;
    }

    // Nếu đã có cache recolor toàn sheet, trả về ngay lập tức để đạt 60 FPS
    if (layer.cachedRecolorCanvas) {
      return layer.cachedRecolorCanvas;
    }

    const cat = layer.category as LpcPaletteCategory;
    const sourceRamp = DEFAULT_SOURCE_RAMPS[cat];
    if (!sourceRamp) {
      return layer.imageElement;
    }

    let targetColors: string[] | undefined;
    if (layer.customRamp && layer.customRamp.length > 0) {
      targetColors = layer.customRamp;
    } else if (layer.paletteId) {
      const targetPalettes = LPC_PALETTES[cat];
      const targetPalette = targetPalettes?.find(p => p.id === layer.paletteId);
      targetColors = targetPalette?.colors;
    }

    if (!targetColors || targetColors.length === 0) {
      return layer.imageElement;
    }

    // Tạo canvas tạm chứa toàn bộ sheet ảnh
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = layer.imageElement.width;
    tempCanvas.height = layer.imageElement.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return layer.imageElement;

    tempCtx.drawImage(layer.imageElement, 0, 0);

    // Ánh xạ dải màu giữ nguyên bóng khối
    const recolored = recolorCanvasByPalette(tempCanvas, sourceRamp, targetColors);
    layer.cachedRecolorCanvas = recolored;
    return recolored;
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
      this.currentFrameIndex = 0;
      this.setFps(group.defaultFps);
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

  // Lùi về khung hình trước đó
  public stepPrevFrame(): void {
    const total = this.getCurrentTotalFrames();
    if (this.currentFrameIndex > 0) {
      this.currentFrameIndex--;
    } else {
      this.currentFrameIndex = total - 1;
    }
    if (this.onFrameUpdate) {
      this.onFrameUpdate(this.currentFrameIndex);
    }
  }

  // Đặt trực tiếp chỉ số khung hình (Scrubbing)
  public setFrameIndex(index: number): void {
    const total = this.getCurrentTotalFrames();
    this.currentFrameIndex = Math.max(0, Math.min(total - 1, index));
    if (this.onFrameUpdate) {
      this.onFrameUpdate(this.currentFrameIndex);
    }
  }

  // Xoay 360 độ sang hướng kế tiếp: Xuống -> Trái -> Lên -> Phải
  public rotateDirection360(): LpcDirection {
    const sequence: LpcDirection[] = ['down', 'left', 'up', 'right'];
    const idx = sequence.indexOf(this.currentDirection);
    const nextDir = sequence[(idx + 1) % sequence.length];
    this.setDirection(nextDir);
    return nextDir;
  }

  // Thay đổi Z-Index của layer (Di chuyển lên/xuống)
  public moveLayerZIndex(layerId: string, delta: number): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.zIndex = Math.max(1, layer.zIndex + delta);
      this.layers.sort((a, b) => a.zIndex - b.zIndex);
    }
  }

  // Helper lay toa do cat frame an toan cho tung layer kem fallback va bu tru offset toa do
  // Ngan chan tinh trang mat quan ao, mu hoac giap bi lech vi tri khi ngoi hoac thu the
  // Helper lay toa do cat frame an toan cho tung layer kem fallback va bu tru offset toa do
  // Ngan chan tinh trang mat quan ao, mu hoac giap bi lech vi tri khi ngoi hoac thu the
  private getFrameDrawInfoForLayer(
    layer: LpcAssetItem,
    col: number,
    row: number,
    src: CanvasImageSource
  ): LpcLayerDrawInfo {
    // 1. Phôi thân người (Body) luôn dùng trực tiếp tọa độ frame gốc
    if (layer.category === 'body') {
      return {
        rect: getLpcFrameRect(col, row),
        offsetX: 0,
        offsetY: 0
      };
    }

    // 2. Kiểm tra chiều cao của nguồn ảnh:
    // Toàn bộ hơn 1.200 tệp trong kho LPC Assets đã được biên soạn và vá chuẩn xác 54 hàng (chiều cao >= 3456px)
    // với ma trận chuyển động khung xương chuẩn từng pixel. Ta cắt trực tiếp ô (col, row).
    const srcHeight = (layer.imageElement as HTMLImageElement)?.naturalHeight ||
                      (layer.imageElement as any)?.height || 0;

    if (srcHeight >= LPC_GRID_CONFIG.sheetHeight || (layer.imageUrl && layer.imageUrl.includes('/lpc_assets/'))) {
      return {
        rect: getLpcFrameRect(col, row),
        offsetX: 0,
        offsetY: 0
      };
    }

    // 3. ĐỐI VỚI TỆP CUSTOM DO NGƯỜI DÙNG TỰ TẢI LÊN (Chỉ có 21 hàng LPC cổ điển):
    // Tự động áp dụng ma trận chuyển động khung xương LPC_MOTION_RIG_OFFSETS cho 9 hành động mở rộng
    const rigAction = LPC_MOTION_RIG_OFFSETS[this.currentActionId];
    if (rigAction) {
      const currentDir = this.currentDirection;
      const dirOffsets = rigAction[currentDir] || rigAction['up'];

      let baseRow = 10;
      let baseCol = 0;
      switch (currentDir) {
        case 'up': baseRow = 8; break;
        case 'left': baseRow = 9; break;
        case 'down': baseRow = 10; break;
        case 'right': baseRow = 11; break;
      }

      if (this.currentActionId === 'climb') {
        baseRow = 8; // Leo trèo luôn nhìn từ sau lưng (Up)
        baseCol = 0;
      } else if (this.currentActionId === 'run') {
        baseCol = col % 9; // Chạy nhanh sải bước theo chu kỳ Walk
      } else if (this.currentActionId === 'halfslash' || this.currentActionId === 'backslash') {
        // Đối với chém kiếm, lấy từ tư thế Slash (Hàng 12..15)
        const slashBase = currentDir === 'up' ? 12 : currentDir === 'left' ? 13 : currentDir === 'down' ? 14 : 15;
        baseRow = slashBase;
        baseCol = col % 6;
      } else {
        baseCol = 0;
      }

      let offsetX = 0;
      let offsetY = 0;
      if (dirOffsets && dirOffsets.length > 0) {
        const offsetObj = dirOffsets[col % dirOffsets.length];
        if (offsetObj) {
          offsetX = offsetObj.dx;
          offsetY = offsetObj.dy;
        }
      }

      return {
        rect: getLpcFrameRect(baseCol, baseRow),
        offsetX,
        offsetY
      };
    }

    // 4. Đối với các hành động cơ bản (walk, slash, spellcast, thrust, shoot, hurt)
    return {
      rect: getLpcFrameRect(col, row),
      offsetX: 0,
      offsetY: 0
    };
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

    // 2. Ve cac layer da kich hoat theo thu tu Z-Order
    for (const layer of this.layers) {
      if (!layer.enabled) continue;
      const src = this.getLayerRenderSource(layer);
      if (!src) continue;

      const drawInfo = this.getFrameDrawInfoForLayer(layer, col, row, src);

      this.offscreenCtx.drawImage(
        src,
        drawInfo.rect.x,
        drawInfo.rect.y,
        drawInfo.rect.width,
        drawInfo.rect.height,
        drawInfo.offsetX,
        drawInfo.offsetY,
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

    for (const layer of this.layers) {
      if (!layer.enabled) continue;
      const src = this.getLayerRenderSource(layer);
      if (!src) continue;

      const drawInfo = this.getFrameDrawInfoForLayer(layer, col, row, src);

      this.offscreenCtx.drawImage(
        src,
        drawInfo.rect.x,
        drawInfo.rect.y,
        drawInfo.rect.width,
        drawInfo.rect.height,
        drawInfo.offsetX,
        drawInfo.offsetY,
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

    for (const layer of this.layers) {
      if (!layer.enabled) continue;
      const src = this.getLayerRenderSource(layer);
      if (!src) continue;

      const drawInfo = this.getFrameDrawInfoForLayer(layer, col, row, src);

      ctx.drawImage(
        src,
        drawInfo.rect.x,
        drawInfo.rect.y,
        drawInfo.rect.width,
        drawInfo.rect.height,
        drawInfo.offsetX,
        drawInfo.offsetY,
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
