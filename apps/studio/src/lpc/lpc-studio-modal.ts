// Giao dien bang dieu khien LPC Character Studio Modal
// Bo cuc 3 cot: Chon Layer phu kien, Live Preview 4 huong kem dieu khien, va Cong cu dong bo Studio/AI

import { LpcCompositor, LpcAssetItem } from './lpc-compositor';
import { LpcDirection, LPC_ACTION_GROUPS } from './lpc-matrix';
import {
  convertCanvasToLayerData,
  createAnimationClipFromLpc,
  exportLpcActionStrip,
  getAllActionFrames
} from './lpc-studio-bridge';
import { CanvasProject, AnimationClip, LayerData } from '@pixel-draw/shared-types';
import { getPalettesByCategory, LPC_PALETTES, LpcPaletteCategory, PaletteRamp } from './lpc-palette';

// Metadata đi kèm batch frame khi chuyển sang AI Studio để AI biết hành động và nhịp phim
export interface LpcBatchAiPayload {
  frames: HTMLCanvasElement[];   // Toàn bộ N khung hình composite của hành động
  stripCanvas: HTMLCanvasElement; // Dải ảnh ngang chứa toàn bộ N khung hình ghép liền nhau
  stripBase64: string;           // Dữ liệu Base64 PNG của dải ảnh để gửi cho Model AI
  prompt: string;                // Prompt mô tả nhân vật mới
  actionId: string;              // Mã hành động: walk, slash, hurt...
  direction: LpcDirection;       // Hướng nhìn: down, up, left, right
  fps: number;                   // Nhịp phát khuyến nghị của hành động
  loop: boolean;                 // Hành động lặp hay chỉ phát 1 lần
  seed?: number;                 // Mã hạt giống nhân vật (Seed Lock) để đồng nhất nhân vật
}

export interface LpcModalCallbacks {
  onLoadFrameToCanvas: (layer: LayerData) => void;
  onLoadClipToTimeline: (clip: AnimationClip) => void;
  // Nhận TOÀN BỘ N frame của hành động LPC, không còn 1 frame đơn nữa
  onBatchAiReskin?: (payload: LpcBatchAiPayload) => void;
}

// Danh mục các mẫu kiểu dáng phụ kiện chuẩn Universal LPC vẽ tay tinh xảo
export interface LpcPresetStyle {
  id: string;
  name: string;
  imageUrl: string;
}

export const LPC_PRESET_STYLES: Record<string, LpcPresetStyle[]> = {
  hair: [
    { id: 'hair_messy', name: 'Tóc Xù Lãng Tử (Messy)', imageUrl: '/lpc_assets/hair_messy.png' },
    { id: 'hair_spiked', name: 'Tóc Gai Chiến Binh (Spiked)', imageUrl: '/lpc_assets/hair_spiked.png' },
    { id: 'hair_curtains', name: 'Tóc Rẽ Ngôi Quý Tộc (Curtains)', imageUrl: '/lpc_assets/hair_curtains.png' },
    { id: 'hair_bob', name: 'Tóc Bob Hiện Đại (Bob)', imageUrl: '/lpc_assets/hair_bob.png' },
    { id: 'hair_pixie', name: 'Tóc Ngắn Cá Tính (Pixie)', imageUrl: '/lpc_assets/hair_pixie.png' }
  ],
  torso: [
    { id: 'armor_plate', name: 'Giáp Sắt Hiệp Sĩ (Plate)', imageUrl: '/lpc_assets/armor_plate.png' },
    { id: 'armor_leather', name: 'Giáp Da Thợ Săn (Leather)', imageUrl: '/lpc_assets/armor_leather.png' },
    { id: 'armor_legion', name: 'Giáp Quân Đoàn La Mã (Legion)', imageUrl: '/lpc_assets/armor_legion.png' }
  ],
  legs: [
    { id: 'pants_leather', name: 'Quần Dài Chiến Binh (Pants)', imageUrl: '/lpc_assets/pants_leather.png' }
  ],
  feet: [
    { id: 'boots_basic', name: 'Ủng Da Hiệp Sĩ (Basic)', imageUrl: '/lpc_assets/boots_leather.png' },
    { id: 'boots_fold', name: 'Ủng Gấp Cổ Cao (Fold)', imageUrl: '/lpc_assets/boots_fold.png' }
  ],
  hat: [
    { id: 'helmet_greathelm', name: 'Mũ Sắt Hiệp Sĩ (Greathelm)', imageUrl: '/lpc_assets/hat_helmet.png' }
  ]
};

export class LpcStudioModal {
  private container: HTMLDivElement | null = null;
  private compositor: LpcCompositor;
  private previewCanvas: HTMLCanvasElement | null = null;
  private previewCtx: CanvasRenderingContext2D | null = null;
  private callbacks: LpcModalCallbacks;
  private isInitialized = false;

  constructor(callbacks: LpcModalCallbacks) {
    this.callbacks = callbacks;
    this.compositor = new LpcCompositor();
  }

  // Khởi tạo và mở Modal
  public async open(defaultBodyUrl = '/sprites.png'): Promise<void> {
    if (!this.container) {
      this.createDom();
    }

    if (!this.isInitialized) {
      // Nạp bộ phôi hoàn chỉnh gồm 6 Layer chuẩn Paper Doll với Asset vẽ tay tinh xảo từ Universal LPC
      await this.compositor.addOrUpdateLayer({
        id: 'layer_base_body',
        name: 'Phôi cơ thể (Base Body)',
        category: 'body',
        zIndex: 20,
        imageUrl: defaultBodyUrl,
        paletteId: 'body_fair',
        enabled: true
      });

      await this.compositor.addOrUpdateLayer({
        id: 'layer_pants',
        name: 'Quần Dài Chiến Binh (Pants)',
        category: 'legs',
        zIndex: 30,
        imageUrl: '/lpc_assets/pants_leather.png',
        paletteId: 'pants_leather_brown',
        enabled: true
      });

      await this.compositor.addOrUpdateLayer({
        id: 'layer_feet',
        name: 'Ủng Da Hiệp Sĩ (Boots)',
        category: 'feet',
        zIndex: 35,
        imageUrl: '/lpc_assets/boots_leather.png',
        paletteId: 'feet_brown',
        enabled: true
      });

      await this.compositor.addOrUpdateLayer({
        id: 'layer_armor',
        name: 'Giáp Sắt Hiệp Sĩ (Plate)',
        category: 'torso',
        zIndex: 40,
        imageUrl: '/lpc_assets/armor_plate.png',
        paletteId: 'armor_steel_blue',
        enabled: true
      });

      await this.compositor.addOrUpdateLayer({
        id: 'layer_hair',
        name: 'Tóc Xù Lãng Tử (Messy)',
        category: 'hair',
        zIndex: 50,
        imageUrl: '/lpc_assets/hair_messy.png',
        paletteId: 'hair_brown',
        enabled: true
      });

      await this.compositor.addOrUpdateLayer({
        id: 'layer_hat',
        name: 'Mũ Sắt Hiệp Sĩ (Greathelm)',
        category: 'hat',
        zIndex: 55,
        imageUrl: '/lpc_assets/hat_helmet.png',
        paletteId: 'hat_steel',
        enabled: false // Mặc định tắt để thấy tóc, người dùng có thể tick chọn để đội mũ
      });



      this.isInitialized = true;
      this.renderLayerList();
      this.updateAiPromptSuggestion();
    }


    if (this.container) {
      this.container.classList.add('active');
    }

    // Bat dau phat preview
    this.compositor.startAnimation(() => {
      this.drawPreview();
      this.updateFrameCounter();
    });
  }

  // Dong Modal
  public close(): void {
    this.compositor.stopAnimation();
    if (this.container) {
      this.container.classList.remove('active');
    }
  }

  // Tao cau truc DOM cua Modal
  private createDom(): void {
    const modal = document.createElement('div');
    modal.className = 'lpc-modal-backdrop';
    modal.id = 'lpc-studio-modal';

    modal.innerHTML = `
      <div class="lpc-modal-dialog">
        <!-- Header -->
        <div class="lpc-modal-header">
          <div class="lpc-header-title">
            <span class="lpc-badge">LPC 2.5D</span>
            <h3>LPC Character Studio & Motion Rig</h3>
          </div>
          <button class="lpc-btn-close" id="lpc-btn-close" title="Đóng">&times;</button>
        </div>

        <!-- Body: 3 Columns -->
        <div class="lpc-modal-body">
          <!-- Col 1: Kho phu kien (Layers & Equipment) -->
          <div class="lpc-col lpc-col-layers">
            <div class="lpc-panel-header">
              <h4>Kho Phụ Kiện (Paper Doll)</h4>
              <label class="lpc-btn-upload" title="Nạp thêm ảnh layer PNG chuẩn LPC 832x3456">
                + Tải Layer
                <input type="file" id="lpc-layer-file-input" accept="image/png" style="display:none;" />
              </label>
            </div>
            <div class="lpc-layer-list" id="lpc-layer-list">
              <!-- Danh sach layer do renderLayerList() sinh -->
            </div>
            <div class="lpc-hint-box">
              Hỗ trợ xếp tầng Z-Order: Thân &rarr; Mắt &rarr; Quần &rarr; Áo &rarr; Tóc &rarr; Vũ khí.
            </div>
          </div>

          <!-- Col 2: Live Animation Preview & Controls -->
          <div class="lpc-col lpc-col-preview">
            <div class="lpc-preview-box">
              <canvas id="lpc-preview-canvas" width="256" height="256"></canvas>
            </div>

            <!-- Dieu huong 4 chieu (D-Pad) -->
            <div class="lpc-direction-controls">
              <span class="lpc-control-label">Hướng nhìn:</span>
              <div class="lpc-dpad">
                <button class="lpc-dpad-btn" data-dir="up" title="Hướng Lên">Lên</button>
                <div class="lpc-dpad-mid">
                  <button class="lpc-dpad-btn" data-dir="left" title="Hướng Trái">Trái</button>
                  <button class="lpc-dpad-btn active" data-dir="down" title="Hướng Xuống">Xuống</button>
                  <button class="lpc-dpad-btn" data-dir="right" title="Hướng Phải">Phải</button>
                </div>
              </div>
            </div>

            <!-- Chon hoat canh & Dieu toc -->
            <div class="lpc-action-controls">
              <div class="lpc-form-row">
                <label>Động tác:</label>
                <select id="lpc-action-select" class="lpc-select">
                  ${LPC_ACTION_GROUPS.map(
                    (g) => `<option value="${g.id}">${g.name}</option>`
                  ).join('')}
                </select>
              </div>

              <div class="lpc-playback-controls">
                <button id="lpc-btn-play-pause" class="lpc-btn-secondary">Tạm dừng</button>
                <button id="lpc-btn-step" class="lpc-btn-secondary">Khung tiếp &gt;</button>
                <div class="lpc-fps-box">
                  <span>FPS: <b id="lpc-fps-val">10</b></span>
                  <input type="range" id="lpc-fps-slider" min="1" max="24" value="10" />
                </div>
                <div class="lpc-frame-indicator" id="lpc-frame-indicator">Khung: 1 / 9</div>
              </div>
            </div>
          </div>

          <!-- Col 3: Cong cu dong bo Studio & AI Re-skin -->
          <div class="lpc-col lpc-col-tools">
            <div class="lpc-panel-header">
              <h4>Đồng Bộ Vào Studio</h4>
            </div>

            <div class="lpc-action-buttons">
              <button id="lpc-btn-load-canvas" class="lpc-btn-primary">
                Nạp Khung Hình Vào Canvas
              </button>
              <button id="lpc-btn-load-timeline" class="lpc-btn-primary">
                Nạp Hoạt Cảnh Vào Timeline
              </button>
              <button id="lpc-btn-export-strip" class="lpc-btn-secondary">
                Xuất Dải Spritesheet (PNG + JSON)
              </button>
            </div>

            <!-- Khoi AI Re-skin -->
            <div class="lpc-ai-box">
              <h5>AI Pose Re-skinning</h5>
              <p class="lpc-subtext">Biến đổi khung xương hoạt cảnh này thành nhân vật phong cách mới bằng Stable Diffusion & LoRA:</p>
              <input type="text" id="lpc-ai-prompt" class="lpc-input" placeholder="Ví dụ: cyberpunk android soldier, glowing visor, 16bit pixel art" />
              <button id="lpc-btn-ai-reskin" class="lpc-btn-accent">
                Chuyển Sang AI Studio
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.container = modal;

    // Khoi tao Canvas xem truoc
    this.previewCanvas = modal.querySelector('#lpc-preview-canvas') as HTMLCanvasElement;
    if (this.previewCanvas) {
      this.previewCtx = this.previewCanvas.getContext('2d');
      if (this.previewCtx) {
        this.previewCtx.imageSmoothingEnabled = false;
      }
    }

    // Dang ky cac su kien tuong tac
    this.bindEvents(modal);
  }

  // Dang ky su kien giao dien
  private bindEvents(modal: HTMLDivElement): void {
    // 1. Dong Modal
    const btnClose = modal.querySelector('#lpc-btn-close');
    btnClose?.addEventListener('click', () => this.close());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // 2. Chuyen doi huong nhin (D-Pad)
    const dpadBtns = modal.querySelectorAll('.lpc-dpad-btn');
    dpadBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        dpadBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const dir = btn.getAttribute('data-dir') as LpcDirection;
        if (dir) {
          this.compositor.setDirection(dir);
          this.drawPreview();
          this.updateFrameCounter();
        }
      });
    });

    // 3. Chon hanh dong
    const actionSelect = modal.querySelector('#lpc-action-select') as HTMLSelectElement;
    actionSelect?.addEventListener('change', () => {
      this.compositor.setAction(actionSelect.value);
      const fpsVal = modal.querySelector('#lpc-fps-val');
      const fpsSlider = modal.querySelector('#lpc-fps-slider') as HTMLInputElement;
      if (fpsVal && fpsSlider) {
        fpsVal.textContent = `${this.compositor.getFps()}`;
        fpsSlider.value = `${this.compositor.getFps()}`;
      }
      this.drawPreview();
      this.updateFrameCounter();
    });

    // 4. Play / Pause
    const btnPlayPause = modal.querySelector('#lpc-btn-play-pause') as HTMLButtonElement;
    btnPlayPause?.addEventListener('click', () => {
      if (this.compositor.isAnimationRunning()) {
        this.compositor.stopAnimation();
        btnPlayPause.textContent = 'Phát';
      } else {
        this.compositor.startAnimation(() => {
          this.drawPreview();
          this.updateFrameCounter();
        });
        btnPlayPause.textContent = 'Tạm dừng';
      }
    });

    // 5. Next Frame (Step)
    const btnStep = modal.querySelector('#lpc-btn-step');
    btnStep?.addEventListener('click', () => {
      this.compositor.stopAnimation();
      if (btnPlayPause) btnPlayPause.textContent = 'Phát';
      this.compositor.stepNextFrame();
      this.drawPreview();
      this.updateFrameCounter();
    });

    // 6. Dieu toc FPS
    const fpsSlider = modal.querySelector('#lpc-fps-slider') as HTMLInputElement;
    const fpsVal = modal.querySelector('#lpc-fps-val');
    fpsSlider?.addEventListener('input', () => {
      const val = parseInt(fpsSlider.value, 10);
      if (fpsVal) fpsVal.textContent = `${val}`;
      this.compositor.setFps(val);
    });

    // 7. Tai layer tuy chinh tu may tinh
    const layerInput = modal.querySelector('#lpc-layer-file-input') as HTMLInputElement;
    layerInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        if (dataUrl) {
          const layerId = `layer_custom_${Date.now()}`;
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          await this.compositor.addOrUpdateLayer({
            id: layerId,
            name: cleanName,
            category: 'torso',
            zIndex: 50,
            imageUrl: dataUrl,
            enabled: true
          });
          this.renderLayerList();
          this.drawPreview();
        }
      };
      reader.readAsDataURL(file);
    });

    // 8. Nap vao Canvas
    const btnLoadCanvas = modal.querySelector('#lpc-btn-load-canvas');
    btnLoadCanvas?.addEventListener('click', () => {
      const compositeCanvas = this.compositor.getCompositeCanvas();
      const currentAction = this.compositor.getCurrentActionId();
      const currentDir = this.compositor.getCurrentDirection();
      const layerId = `layer_lpc_${currentAction}_${currentDir}_${Date.now()}`;
      const layer = convertCanvasToLayerData(
        compositeCanvas,
        layerId,
        `LPC ${currentAction} (${currentDir})`
      );
      this.callbacks.onLoadFrameToCanvas(layer);
      this.close();
    });

    // 9. Nap vao Timeline
    const btnLoadTimeline = modal.querySelector('#lpc-btn-load-timeline');
    btnLoadTimeline?.addEventListener('click', () => {
      const actionId = this.compositor.getCurrentActionId();
      const direction = this.compositor.getCurrentDirection();
      const clip = createAnimationClipFromLpc(this.compositor, actionId, direction);
      this.callbacks.onLoadClipToTimeline(clip);
      this.close();
    });

    // 10. Xuat Spritesheet Strip (PNG + JSON)
    const btnExportStrip = modal.querySelector('#lpc-btn-export-strip');
    btnExportStrip?.addEventListener('click', () => {
      const actionId = this.compositor.getCurrentActionId();
      const direction = this.compositor.getCurrentDirection();
      const { canvas, metadata } = exportLpcActionStrip(this.compositor, actionId, direction);

      // Tai file PNG
      const linkPng = document.createElement('a');
      linkPng.download = `lpc_${actionId}_${direction}.png`;
      linkPng.href = canvas.toDataURL('image/png');
      linkPng.click();

      // Tai file JSON
      const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], {
        type: 'application/json'
      });
      const linkJson = document.createElement('a');
      linkJson.download = `lpc_${actionId}_${direction}.json`;
      linkJson.href = URL.createObjectURL(jsonBlob);
      linkJson.click();
    });

    // 11. AI Pose Re-skinning Batch - gửi toàn bộ N frame, bỏ qua Wizard
    const btnAiReskin = modal.querySelector('#lpc-btn-ai-reskin');
    const inputAiPrompt = modal.querySelector('#lpc-ai-prompt') as HTMLInputElement;
    btnAiReskin?.addEventListener('click', () => {
      const prompt = inputAiPrompt?.value.trim() || 'pixel art character, 16bit clean outline';

      if (!this.callbacks.onBatchAiReskin) {
        alert('Chức năng AI Batch Reskin chưa được đăng ký trong Studio.');
        return;
      }

      // Thu thập toàn bộ N frame composite của hành động đang hiển thị
      const actionId = this.compositor.getCurrentActionId();
      const direction = this.compositor.getCurrentDirection();

      let allFrames: HTMLCanvasElement[];
      try {
        allFrames = getAllActionFrames(this.compositor, actionId, direction);
      } catch (err: any) {
        alert('Không thể lấy danh sách frame: ' + err.message);
        return;
      }

      if (allFrames.length === 0) {
        alert('Hành động này không có frame nào để chuyển sang AI.');
        return;
      }

      // Lấy thông tin hành động và xuất dải ảnh ngang chứa toàn bộ N khung hình
      const group = this.compositor.getActionGroup(actionId);
      const fps = group?.defaultFps ?? 8;
      const loop = group?.loop ?? true;

      const { canvas: stripCanvas } = exportLpcActionStrip(this.compositor, actionId, direction);

      const payload: LpcBatchAiPayload = {
        frames: allFrames,
        stripCanvas,
        stripBase64: stripCanvas.toDataURL('image/png'),
        prompt,
        actionId,
        direction,
        fps,
        loop
      };

      // Đóng modal LPC và chuyển sang AI Studio
      this.close();
      this.callbacks.onBatchAiReskin(payload);
    });
  }


  // Cập nhật danh sách layer hiển thị ở cột 1 kèm bộ chọn bảng màu (Palette Shading)
  private renderLayerList(): void {
    if (!this.container) return;
    const listContainer = this.container.querySelector('#lpc-layer-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const layers = this.compositor.getLayers();

    if (layers.length === 0) {
      listContainer.innerHTML = '<div class="lpc-empty-hint">Chưa có layer nào được nạp.</div>';
      return;
    }

    layers.forEach((layer) => {
      const itemRow = document.createElement('div');
      itemRow.className = `lpc-layer-item ${layer.enabled ? 'active' : ''}`;

      // Lấy danh sách mẫu kiểu dáng có sẵn cho danh mục layer này
      const availableStyles = LPC_PRESET_STYLES[layer.category] || [];
      const hasStyles = availableStyles.length > 1;

      // Lấy danh sách bảng màu phù hợp cho danh mục layer này
      const availablePalettes = getPalettesByCategory(layer.category);
      const hasPalettes = availablePalettes.length > 0;

      const styleOptionsHtml = hasStyles
        ? availableStyles
            .map(
              (s: LpcPresetStyle) =>
                `<option value="${s.imageUrl}" ${layer.imageUrl === s.imageUrl ? 'selected' : ''}>${s.name}</option>`
            )
            .join('')
        : '';

      const paletteOptionsHtml = hasPalettes
        ? availablePalettes
            .map(
              (p: PaletteRamp) =>
                `<option value="${p.id}" ${layer.paletteId === p.id ? 'selected' : ''}>${p.name}</option>`
            )
            .join('')
        : '';

      itemRow.innerHTML = `
        <div class="lpc-layer-item-header">
          <label class="lpc-layer-checkbox">
            <input type="checkbox" ${layer.enabled ? 'checked' : ''} />
            <span class="lpc-layer-name">${layer.name}</span>
          </label>
          <div class="lpc-layer-badges">
            <span class="lpc-z-badge">Z:${layer.zIndex}</span>
            ${
              layer.category !== 'body'
                ? `<button class="lpc-btn-remove-layer" title="Xóa layer">&times;</button>`
                : ''
            }
          </div>
        </div>
        ${
          hasStyles
            ? `
          <div class="lpc-layer-palette-row">
            <span class="lpc-palette-label">Kiểu:</span>
            <select class="lpc-style-select" data-layer-id="${layer.id}">
              ${styleOptionsHtml}
            </select>
          </div>
        `
            : ''
        }
        ${
          hasPalettes
            ? `
          <div class="lpc-layer-palette-row">
            <span class="lpc-palette-label">Màu:</span>
            <select class="lpc-palette-select" data-layer-id="${layer.id}">
              <option value="" ${!layer.paletteId ? 'selected' : ''}>Màu gốc (Original)</option>
              ${paletteOptionsHtml}
            </select>
          </div>
        `
            : ''
        }
      `;

      // Checkbox bật/tắt layer
      const checkbox = itemRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox?.addEventListener('change', () => {
        this.compositor.setLayerEnabled(layer.id, checkbox.checked);
        itemRow.classList.toggle('active', checkbox.checked);
        this.drawPreview();
        this.updateAiPromptSuggestion();
      });

      // Bắt sự kiện đổi kiểu dáng phụ kiện
      const styleSelect = itemRow.querySelector('.lpc-style-select') as HTMLSelectElement;
      styleSelect?.addEventListener('change', async () => {
        const selectedStyle = availableStyles.find((s) => s.imageUrl === styleSelect.value);
        if (selectedStyle) {
          await this.compositor.changeLayerImage(layer.id, selectedStyle.imageUrl, selectedStyle.name);
          const nameSpan = itemRow.querySelector('.lpc-layer-name');
          if (nameSpan) nameSpan.textContent = selectedStyle.name;
          this.drawPreview();
          this.updateAiPromptSuggestion();
        }
      });

      // Bắt sự kiện đổi bảng màu
      const paletteSelect = itemRow.querySelector('.lpc-palette-select') as HTMLSelectElement;
      paletteSelect?.addEventListener('change', () => {
        this.compositor.setLayerPalette(layer.id, paletteSelect.value || undefined);
        this.drawPreview();
        this.updateAiPromptSuggestion();
      });

      // Nút xóa layer (ngoại trừ layer gốc)
      const btnRemove = itemRow.querySelector('.lpc-btn-remove-layer');
      btnRemove?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.compositor.removeLayer(layer.id);
        this.renderLayerList();
        this.drawPreview();
        this.updateAiPromptSuggestion();
      });

      listContainer.appendChild(itemRow);
    });
  }

  // Tự động tạo gợi ý prompt cho AI dựa trên các phụ kiện và màu sắc đang được bật
  private updateAiPromptSuggestion(): void {
    if (!this.container) return;
    const inputAiPrompt = this.container.querySelector('#lpc-ai-prompt') as HTMLInputElement;
    if (!inputAiPrompt) return;

    const layers = this.compositor.getLayers().filter((l) => l.enabled);
    const descriptors: string[] = ['warrior character'];

    layers.forEach((layer) => {
      if (layer.category === 'hair' && layer.paletteId) {
        if (layer.paletteId.includes('blonde')) descriptors.push('blonde hair');
        else if (layer.paletteId.includes('red')) descriptors.push('red hair');
        else if (layer.paletteId.includes('black')) descriptors.push('black hair');
        else if (layer.paletteId.includes('platinum')) descriptors.push('platinum silver hair');
        else if (layer.paletteId.includes('blue')) descriptors.push('blue hair');
        else descriptors.push('brown hair');
      } else if (layer.category === 'torso' && layer.paletteId) {
        if (layer.paletteId.includes('gold')) descriptors.push('golden plate armor');
        else if (layer.paletteId.includes('crimson')) descriptors.push('crimson armor');
        else if (layer.paletteId.includes('emerald')) descriptors.push('emerald armor');
        else if (layer.paletteId.includes('dark_iron')) descriptors.push('dark iron armor');
        else if (layer.paletteId.includes('white_cloth')) descriptors.push('white cloth tunic');
        else descriptors.push('steel blue armor');
      } else if (layer.category === 'legs' && layer.paletteId) {
        if (layer.paletteId.includes('iron_gray')) descriptors.push('iron gray pants');
        else if (layer.paletteId.includes('denim_blue')) descriptors.push('indigo blue pants');
        else if (layer.paletteId.includes('khaki')) descriptors.push('khaki pants');
        else descriptors.push('leather brown pants');
      } else if (layer.category === 'feet') {
        if (layer.paletteId?.includes('black')) descriptors.push('black leather boots');
        else if (layer.paletteId?.includes('iron')) descriptors.push('iron armored boots');
        else descriptors.push('brown leather boots');
      } else if (layer.category === 'hat') {
        if (layer.paletteId?.includes('gold')) descriptors.push('golden knight greathelm');
        else descriptors.push('steel knight greathelm');
      }
    });

    descriptors.push('16bit pixel art', 'clean outline', 'high detail sprite', 'rpg game asset');
    inputAiPrompt.value = descriptors.join(', ');
  }

  // Ve khung hinh len canvas xem truoc
  private drawPreview(): void {
    if (!this.previewCtx) return;
    this.compositor.renderCurrentFrame(this.previewCtx, 256, 256);
  }

  // Cap nhat bo dem khung hinh (Frame X / N)
  private updateFrameCounter(): void {
    if (!this.container) return;
    const indicator = this.container.querySelector('#lpc-frame-indicator');
    if (indicator) {
      const current = this.compositor.getCurrentFrameIndex() + 1;
      const total = this.compositor.getCurrentTotalFrames();
      indicator.textContent = `Khung: ${current} / ${total}`;
    }
  }
}
