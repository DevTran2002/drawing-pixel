// Giao dien bang dieu khien LPC Character Studio Modal
// Bo cuc 3 cot: Chon Layer phu kien, Live Preview 4 huong kem dieu khien, va Cong cu dong bo Studio/AI

import { LpcCompositor, LpcAssetItem } from './lpc-compositor';
import { LpcDirection, LPC_ACTION_GROUPS, LPC_GRID_CONFIG } from './lpc-matrix';
import {
  convertCanvasToLayerData,
  createAnimationClipFromLpc,
  exportLpcActionStrip,
  getAllActionFrames
} from './lpc-studio-bridge';
import { CanvasProject, AnimationClip, LayerData } from '@pixel-draw/shared-types';
import {
  getPalettesByCategory,
  LPC_PALETTES,
  LpcPaletteCategory,
  PaletteRamp,
  CHARACTER_THEMES,
  CharacterPaletteTheme,
  findThemeByPrompt
} from './lpc-palette';

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
  ],
  tails: [
    { id: 'tail_cat', name: 'Đuôi Mèo (Cat)', imageUrl: '/lpc_assets/tail_cat.png' },
    { id: 'tail_wolf', name: 'Đuôi Sói (Wolf)', imageUrl: '/lpc_assets/tail_wolf.png' },
    { id: 'tail_fluffy', name: 'Đuôi Cáo Xù (Fluffy)', imageUrl: '/lpc_assets/tail_fluffy.png' }
  ],
  ears: [
    { id: 'ears_cat', name: 'Tai Mèo (Cat)', imageUrl: '/lpc_assets/ears_cat.png' },
    { id: 'ears_wolf', name: 'Tai Sói (Wolf)', imageUrl: '/lpc_assets/ears_wolf.png' },
    { id: 'ears_lykon', name: 'Tai Thú Lykon (Lykon)', imageUrl: '/lpc_assets/ears_lykon.png' }
  ]
};

export class LpcStudioModal {
  private container: HTMLDivElement | null = null;
  private compositor: LpcCompositor;
  private previewCanvas: HTMLCanvasElement | null = null;
  private previewCtx: CanvasRenderingContext2D | null = null;
  private callbacks: LpcModalCallbacks;
  private isInitialized = false;

  // Trạng thái lưu trữ của Phương án 2: AI Keyframe Concept + Motion Transfer
  private currentKeyframeConcept: { imageUrl: string; seed: number; outputPath: string; prompt?: string; strength?: number } | null = null;
  private currentTransferFrames: any[] = [];
  private transferPreviewInterval: any = null;
  private transferCurrentFrameIndex = 0;

  // Trạng thái lưu trữ của Phương án 1: AI Modular Re-skin & Trang Phục Chủ Đề (Chuẩn khớp giải phẫu 100%)
  private currentReskinFrames: any[] = [];
  private reskinPreviewInterval: any = null;
  private reskinCurrentFrameIndex = 0;
  private themePreviewCanvas: HTMLCanvasElement | null = null;
  private themePreviewCtx: CanvasRenderingContext2D | null = null;
  private currentSelectedThemeId = 'theme_paladin';


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
      // Nạp bộ phôi hoàn chỉnh gồm các Layer chuẩn Paper Doll với Asset vẽ tay tinh xảo từ Universal LPC
      // 1. Đuôi thú (Z: 12 - nằm sau lưng thân người)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_tails',
        name: 'Đuôi Thú (Tail)',
        category: 'tails',
        zIndex: 12,
        imageUrl: '/lpc_assets/tail_cat.png',
        paletteId: 'fur_orange',
        enabled: false // Mặc định tắt, người dùng có thể bật khi muốn tạo nhân vật thú/furry
      });

      // 2. Thân người (Z: 20)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_base_body',
        name: 'Phôi cơ thể (Base Body)',
        category: 'body',
        zIndex: 20,
        imageUrl: defaultBodyUrl,
        paletteId: 'body_fair',
        enabled: true
      });

      // 3. Quần dài (Z: 30)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_pants',
        name: 'Quần Dài Chiến Binh (Pants)',
        category: 'legs',
        zIndex: 30,
        imageUrl: '/lpc_assets/pants_leather.png',
        paletteId: 'legs_leather_brown',
        enabled: true
      });

      // 4. Ủng da (Z: 35)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_feet',
        name: 'Ủng Da Hiệp Sĩ (Boots)',
        category: 'feet',
        zIndex: 35,
        imageUrl: '/lpc_assets/boots_leather.png',
        paletteId: 'feet_brown',
        enabled: true
      });

      // 5. Giáp ngực (Z: 40)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_armor',
        name: 'Giáp Sắt Hiệp Sĩ (Plate)',
        category: 'torso',
        zIndex: 40,
        imageUrl: '/lpc_assets/armor_plate.png',
        paletteId: 'torso_steel_blue',
        enabled: true
      });

      // 6. Mái tóc (Z: 50)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_hair',
        name: 'Tóc Xù Lãng Tử (Messy)',
        category: 'hair',
        zIndex: 50,
        imageUrl: '/lpc_assets/hair_messy.png',
        paletteId: 'hair_brown',
        enabled: true
      });

      // 7. Tai thú (Z: 52 - nằm trên tóc)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_ears',
        name: 'Tai Thú (Ears)',
        category: 'ears',
        zIndex: 52,
        imageUrl: '/lpc_assets/ears_cat.png',
        paletteId: 'ear_orange',
        enabled: false // Mặc định tắt, người dùng có thể bật khi muốn tạo nhân vật thú/furry
      });

      // 8. Mũ sắt (Z: 55)
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
    if (this.transferPreviewInterval) {
      clearInterval(this.transferPreviewInterval);
      this.transferPreviewInterval = null;
    }
    if (this.reskinPreviewInterval) {
      clearInterval(this.reskinPreviewInterval);
      this.reskinPreviewInterval = null;
    }
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

            <!-- Bộ chuyển đổi Tab Phương Án AI -->
            <div class="lpc-method-tabs">
              <button type="button" class="lpc-tab-nav-btn active" data-tab="tab-p1">
                Phương Án 1 (Chuẩn Khớp 100%)
              </button>
              <button type="button" class="lpc-tab-nav-btn tab-p2" data-tab="tab-p2">
                Phương Án 2 (Keyframe Warp)
              </button>
            </div>

            <!-- Tab 1: Trang Phục Chủ Đề & Palette Shading (Phương Án 1 - Chuẩn Khớp 100%, Không Biến Đổi Chi Tiết) -->
            <div id="lpc-tab-p1" class="lpc-tab-pane active">
              <div class="lpc-reskin-studio">
                <div class="lpc-reskin-header">
                  <h5>Trang Phục Chủ Đề & Bảng Màu (Paper Doll)</h5>
                  <span class="lpc-badge" style="background:#2563eb;color:#ffffff;">Chuẩn 100% Khớp</span>
                </div>
                <p class="lpc-reskin-desc">
                  Áp dụng dải màu bóng khối đồng nhất lên toàn bộ các Layer vẽ tay của LPC. Cầu vai, nếp áo, viền quần giữ nguyên 100% chi tiết trên mọi khung hình, không bị nhấp nháy hay biến dạng!
                </p>

                <!-- Các bộ trang phục chủ đề nhanh -->
                <div class="lpc-reskin-tags" id="lpc-theme-tags">
                  ${CHARACTER_THEMES.map(t => `
                    <button type="button" class="lpc-reskin-tag-btn ${t.id === 'theme_paladin' ? 'active' : ''}" data-theme-id="${t.id}" title="${t.description}">
                      ${t.name}
                    </button>
                  `).join('')}
                </div>

                <!-- Ô nhập Prompt thông minh tìm kiếm hoặc mô tả trang phục -->
                <div style="display:flex;gap:6px;">
                  <input type="text" id="lpc-reskin-prompt" class="lpc-input" style="flex:1;" placeholder="Nhập tên trang phục (ví dụ: paladin, rồng lửa, cyberpunk, ninja...)" value="Hiệp Sĩ Thánh Paladin" />
                  <button id="lpc-btn-apply-theme" class="lpc-btn-primary" style="padding:6px 12px;white-space:nowrap;">
                    Áp Dụng
                  </button>
                </div>

                <div id="lpc-theme-applied-info" style="font-size:11px;color:#38bdf8;background:rgba(56,189,248,0.1);padding:6px 10px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);">
                  Đang dùng: <b>Hiệp Sĩ Thánh Paladin (Vàng Kim)</b> - 100% đồng nhất tất cả khung hình.
                </div>

                <!-- Màn hình xem trước vòng lặp chuyển động trực tiếp của trang phục đã đổi màu -->
                <div class="lpc-reskin-preview-area active" style="margin-top:4px;">
                  <div style="font-size:11px;font-weight:600;color:#60a5fa;">Xem trước chuyển động đồng nhất 100%:</div>
                  <div class="lpc-preview-canvas-box" style="box-shadow: 0 0 16px rgba(37, 99, 235, 0.4);">
                    <canvas id="lpc-reskin-anim-canvas" width="128" height="128"></canvas>
                  </div>
                  <div style="display:flex;gap:6px;width:100%;margin-top:4px;">
                    <button id="lpc-btn-load-theme-timeline" class="lpc-btn-primary" style="flex:1;">
                      Nạp Hoạt Cảnh Vào Timeline
                    </button>
                    <button id="lpc-btn-export-theme-strip" class="lpc-btn-secondary" style="flex:1;">
                      Xuất Spritesheet (PNG)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab 2: AI Keyframe Studio (Phương Án 2: Sáng tạo theo khung mẫu) -->
            <div id="lpc-tab-p2" class="lpc-tab-pane">
              <div class="lpc-keyframe-studio">
                <div class="lpc-keyframe-header">
                  <h5>AI Keyframe Studio</h5>
                  <span class="lpc-badge" style="background:#7c3aed;color:#ffffff;">Phương Án 2</span>
                </div>
                <p class="lpc-subtext">Sáng tạo trang phục mới trên 1 Frame mẫu, sau đó chuyển giao chuyển động sang toàn bộ hoạt cảnh:</p>

                <!-- Các thẻ phong cách nhanh -->
                <div class="lpc-keyframe-tags">
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, cyberpunk glowing armor, neon visor, futuristic battle suit, sharp outline">Cyberpunk</button>
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, flame dragon plate armor, molten gold trims, glowing runes, sharp outline">Giáp Rồng</button>
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, dark mystic wizard robes, void energy aura, glowing runes, sharp outline">Phù Thủy</button>
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, holy paladin royal plate armor, shining golden crest, sharp outline">Hiệp Sĩ</button>
                </div>

                <!-- Ô nhập Prompt sáng tạo -->
                <input type="text" id="lpc-keyframe-prompt" class="lpc-input" placeholder="Mô tả ý tưởng trang phục sáng tạo..." />

                <!-- Thanh trượt độ sáng tạo Strength -->
                <div class="lpc-strength-row">
                  <span>Độ sáng tạo:</span>
                  <input type="range" id="lpc-keyframe-strength" min="35" max="75" value="58" />
                  <b id="lpc-keyframe-strength-val" style="color:#c084fc;">0.58</b>
                </div>

                <!-- Nút sinh mẫu thử -->
                <button id="lpc-btn-gen-keyframe" class="lpc-btn-accent" style="background:linear-gradient(135deg, #7c3aed, #a855f7);">
                  Sinh Mẫu Thử Keyframe
                </button>

                <!-- Khung xem trước mẫu thử Keyframe đã sinh -->
                <div class="lpc-keyframe-preview-area" id="lpc-keyframe-preview-area">
                  <div class="lpc-preview-canvas-box">
                    <canvas id="lpc-keyframe-preview-canvas" width="128" height="128"></canvas>
                  </div>
                  <div id="lpc-keyframe-seed-info" style="font-size:11px;color:#cbd5e1;">Seed: -</div>
                  <div class="lpc-keyframe-actions-row">
                    <button id="lpc-btn-reroll-keyframe" class="lpc-btn-secondary" title="Sinh lại mẫu khác với Seed ngẫu nhiên mới">Thử Khác</button>
                    <button id="lpc-btn-apply-transfer" class="lpc-btn-accent" style="background:linear-gradient(135deg, #059669, #10b981);">Duyệt & Chuyển Giao</button>
                  </div>
                </div>

                <!-- Trạng thái tiến trình & Khung xem trước hoạt cảnh chuyển giao -->
                <div class="lpc-transfer-status" id="lpc-transfer-status">
                  <div id="lpc-transfer-msg">Đang chuẩn bị...</div>
                </div>

                <div class="lpc-keyframe-preview-area" id="lpc-transfer-result-area" style="border-color:#10b981;">
                  <div style="font-size:11px;font-weight:600;color:#34d399;">Hoạt cảnh hoàn chỉnh đã chuyển giao:</div>
                  <div class="lpc-preview-canvas-box" style="box-shadow: 0 0 16px rgba(16, 185, 129, 0.3);">
                    <canvas id="lpc-transfer-anim-canvas" width="128" height="128"></canvas>
                  </div>
                  <button id="lpc-btn-load-transfer-timeline" class="lpc-btn-primary" style="width:100%;margin-top:4px;">
                    Nạp Hoạt Cảnh Vào Timeline
                  </button>
                </div>
              </div>
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

    // Khởi tạo Canvas xem trước Trang Phục Chủ Đề ở Cột 3
    this.themePreviewCanvas = modal.querySelector('#lpc-reskin-anim-canvas') as HTMLCanvasElement;
    if (this.themePreviewCanvas) {
      this.themePreviewCtx = this.themePreviewCanvas.getContext('2d');
      if (this.themePreviewCtx) {
        this.themePreviewCtx.imageSmoothingEnabled = false;
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

    // 12. Chuyển đổi qua lại giữa Tab Phương Án 1 và Phương Án 2
    const tabNavBtns = modal.querySelectorAll('.lpc-tab-nav-btn');
    const tabPanes = modal.querySelectorAll('.lpc-tab-pane');
    tabNavBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabNavBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        tabPanes.forEach((p) => {
          if (p.id === `lpc-${targetTab}`) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });
      });
    });

    // Cài đặt các sự kiện cho công cụ AI Modular Re-skin (Phương Án 1: Giữ nguyên 100% giải phẫu chuẩn LPC)
    this.setupModularReskinListeners(modal);

    // Cài đặt các sự kiện cho công cụ AI Keyframe Studio (Phương Án 2: Sáng tạo theo khung mẫu)
    this.setupKeyframeStudioListeners(modal);
  }

  // Cài đặt các sự kiện cho công cụ AI Keyframe Studio (Phương án 2: Sáng tạo theo khung mẫu)
  private setupKeyframeStudioListeners(modal: HTMLElement): void {
    const inputPrompt = modal.querySelector('#lpc-keyframe-prompt') as HTMLInputElement;
    const strengthSlider = modal.querySelector('#lpc-keyframe-strength') as HTMLInputElement;
    const strengthVal = modal.querySelector('#lpc-keyframe-strength-val');
    const btnGenKeyframe = modal.querySelector('#lpc-btn-gen-keyframe') as HTMLButtonElement;
    const previewArea = modal.querySelector('#lpc-keyframe-preview-area') as HTMLElement;
    const previewCanvas = modal.querySelector('#lpc-keyframe-preview-canvas') as HTMLCanvasElement;
    const seedInfo = modal.querySelector('#lpc-keyframe-seed-info');
    const btnReroll = modal.querySelector('#lpc-btn-reroll-keyframe') as HTMLButtonElement;
    const btnApplyTransfer = modal.querySelector('#lpc-btn-apply-transfer') as HTMLButtonElement;
    const statusBox = modal.querySelector('#lpc-transfer-status') as HTMLElement;
    const statusMsg = modal.querySelector('#lpc-transfer-msg') as HTMLElement;
    const resultArea = modal.querySelector('#lpc-transfer-result-area') as HTMLElement;
    const animCanvas = modal.querySelector('#lpc-transfer-anim-canvas') as HTMLCanvasElement;
    const btnLoadTimeline = modal.querySelector('#lpc-btn-load-transfer-timeline') as HTMLButtonElement;

    // 1. Thẻ phong cách nhanh
    const tagButtons = modal.querySelectorAll('.lpc-tag-btn');
    tagButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-prompt');
        if (p && inputPrompt) {
          inputPrompt.value = p;
        }
      });
    });

    // 2. Thanh trượt độ sáng tạo Strength
    strengthSlider?.addEventListener('input', () => {
      const val = (parseInt(strengthSlider.value, 10) / 100).toFixed(2);
      if (strengthVal) strengthVal.textContent = val;
    });

    // Hàm gọi sinh mẫu thử Keyframe
    const runGenerateKeyframe = async (forceNewSeed = false) => {
      const prompt = inputPrompt?.value.trim() || 'pixel art character, detailed glowing outfit';
      const strength = parseFloat(strengthSlider?.value || '52') / 100;
      const seed = forceNewSeed ? undefined : this.currentKeyframeConcept?.seed;

      // Lấy khung hình hiện tại từ Compositor
      const currentCanvas = this.compositor.getCompositeCanvas();
      const keyframeBase64 = currentCanvas.toDataURL('image/png');

      btnGenKeyframe.disabled = true;
      btnGenKeyframe.textContent = 'Đang sinh mẫu thử...';
      if (statusBox) {
        statusBox.classList.add('active');
        if (statusMsg) statusMsg.textContent = 'Đang gửi khung hình mẫu qua Model AI...';
      }

      try {
        const response = await fetch('http://127.0.0.1:3055/api/ai/lpc-keyframe-concept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyframeBase64,
            prompt,
            strength,
            seed,
            size: 64,
            steps: 20
          })
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Lỗi sinh mẫu thử');
        }

        this.currentKeyframeConcept = {
          imageUrl: data.imageUrl,
          outputPath: data.outputPath,
          seed: data.seed,
          prompt,
          strength
        };

        // Vẽ ảnh lên canvas xem trước 128x128
        const img = new Image();
        img.onload = () => {
          const ctx = previewCanvas?.getContext('2d');
          if (ctx && previewCanvas) {
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
          }
          if (previewArea) previewArea.classList.add('active');
          if (seedInfo) seedInfo.textContent = `Seed: ${data.seed}`;
          if (statusBox) statusBox.classList.remove('active');
        };
        img.onerror = () => {
          console.warn('Lỗi tải ảnh từ URL, bật khu vực điều khiển mẫu thử với fallback...');
          if (previewArea) previewArea.classList.add('active');
          if (seedInfo) seedInfo.textContent = `Seed: ${data.seed}`;
          if (statusBox) statusBox.classList.remove('active');
        };
        
        // Ưu tiên nạp trực tiếp qua data URI Base64 trong bộ nhớ
        const targetSrc = data.imageBase64 || (data.imageUrl?.startsWith('http') ? data.imageUrl : `http://127.0.0.1:3055${data.imageUrl}`);
        img.src = targetSrc;
      } catch (err: any) {
        alert('Lỗi sinh mẫu thử Keyframe: ' + err.message);
        if (statusBox) statusBox.classList.remove('active');
      } finally {
        btnGenKeyframe.disabled = false;
        btnGenKeyframe.textContent = 'Sinh Mẫu Thử Keyframe';
      }
    };

    btnGenKeyframe?.addEventListener('click', () => runGenerateKeyframe(true));
    btnReroll?.addEventListener('click', () => runGenerateKeyframe(true));

    // 3. Chuyển giao chuyển động sang toàn bộ hoạt cảnh
    btnApplyTransfer?.addEventListener('click', async () => {
      if (!this.currentKeyframeConcept) {
        alert('Vui lòng sinh và duyệt mẫu thử Keyframe trước.');
        return;
      }

      const actionId = this.compositor.getCurrentActionId();
      const direction = this.compositor.getCurrentDirection();
      const { canvas: stripCanvas, metadata } = exportLpcActionStrip(this.compositor, actionId, direction);
      const frameCount = metadata.frameCount || Math.round(stripCanvas.width / LPC_GRID_CONFIG.frameWidth) || 6;
      // Tái sử dụng chính xác prompt và seed đã duyệt từ mẫu Keyframe Concept
      const prompt = this.currentKeyframeConcept.prompt || inputPrompt?.value.trim() || 'pixel art character';
      const seed = this.currentKeyframeConcept.seed;
      const conceptPath = this.currentKeyframeConcept.outputPath;
      const conceptBase64 = this.currentKeyframeConcept.imageUrl;

      btnApplyTransfer.disabled = true;
      btnApplyTransfer.textContent = 'Đang chuyển giao...';
      if (statusBox) {
        statusBox.classList.add('active');
        if (statusMsg) statusMsg.textContent = `Đang áp dụng kết cấu giáp và chuyển giao sang ${frameCount} khung hình...`;
      }

      try {
        const response = await fetch('http://127.0.0.1:3055/api/ai/lpc-motion-transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripBase64: stripCanvas.toDataURL('image/png'),
            conceptPath,
            conceptBase64,
            frameCount,
            action: actionId,
            prompt,
            seed,
            strength: 0.24,
            steps: 18,
            size: 64
          })
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Lỗi chuyển giao hoạt cảnh');
        }

        this.currentTransferFrames = data.frames || [];
        if (statusBox) {
          statusBox.classList.add('active');
          if (statusMsg) statusMsg.textContent = `Hoàn tất chuyển giao ${this.currentTransferFrames.length} khung hình!`;
        }

        if (resultArea) resultArea.classList.add('active');

        // Bắt đầu phát vòng lặp hoạt cảnh xem trước
        if (this.transferPreviewInterval) {
          clearInterval(this.transferPreviewInterval);
        }
        this.transferCurrentFrameIndex = 0;
        const animCtx = animCanvas?.getContext('2d');
        if (animCtx) {
          animCtx.imageSmoothingEnabled = false;
        }

        const loadedImgs: HTMLImageElement[] = [];
        let loadedCount = 0;
        this.currentTransferFrames.forEach((fr, idx) => {
          const img = new Image();
          img.onload = () => {
            loadedCount++;
            if (loadedCount === this.currentTransferFrames.length) {
              // Phát hoạt cảnh ở 10 FPS
              this.transferPreviewInterval = setInterval(() => {
                if (!animCtx || !animCanvas) return;
                const curImg = loadedImgs[this.transferCurrentFrameIndex];
                if (curImg) {
                  animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
                  animCtx.drawImage(curImg, 0, 0, animCanvas.width, animCanvas.height);
                }
                this.transferCurrentFrameIndex = (this.transferCurrentFrameIndex + 1) % loadedImgs.length;
              }, 100);
            }
          };
          // Ưu tiên nạp Base64 trực tiếp từ RAM
          const p = fr.imageBase64 || (fr.imagePath ? `http://127.0.0.1:3055/storage/outputs/${fr.filename}` : fr.filename);
          img.src = p;
          loadedImgs[idx] = img;
        });
      } catch (err: any) {
        alert('Lỗi chuyển giao chuyển động: ' + err.message);
      } finally {
        btnApplyTransfer.disabled = false;
        btnApplyTransfer.textContent = 'Duyệt & Chuyển Giao';
      }
    });

    // 4. Nạp hoạt cảnh hoàn chỉnh vào Timeline Studio
    btnLoadTimeline?.addEventListener('click', () => {
      if (!this.currentTransferFrames || this.currentTransferFrames.length === 0) {
        alert('Chưa có dữ liệu hoạt cảnh chuyển giao để nạp.');
        return;
      }

      const actionId = this.compositor.getCurrentActionId();
      const direction = this.compositor.getCurrentDirection();
      const group = this.compositor.getActionGroup(actionId);
      const durationMs = Math.max(20, Math.floor(1000 / (group?.defaultFps ?? 10)));

      // Chuyển danh sách frame của server thành AnimationClip cho Studio Timeline
      const frames = this.currentTransferFrames.map((fr, idx) => {
        const pixels: Record<string, any> = {};
        if (Array.isArray(fr.pixels)) {
          fr.pixels.forEach((p: any) => {
            if (p.color) {
              pixels[`${p.x},${p.y}`] = p.color;
            }
          });
        }
        return {
          id: `frame_ai_transfer_${idx}_${Date.now()}`,
          durationMs,
          layers: [
            {
              id: `layer_ai_transfer_${idx}_${Date.now()}`,
              name: `AI Concept Frame ${idx + 1}`,
              visible: true,
              locked: false,
              opacity: 1.0,
              pixels
            }
          ]
        };
      });

      const clip = {
        id: `clip_ai_transfer_${Date.now()}`,
        name: `AI ${group?.name || actionId} (${direction})`,
        frames,
        fps: group?.defaultFps ?? 10,
        loop: group?.loop ?? true
      };

      this.callbacks.onLoadClipToTimeline(clip as any);
      this.close();
    });
  }

  // Cài đặt các sự kiện cho công cụ Trang Phục Chủ Đề & Palette Shading (Phương Án 1: Chuẩn 100% Khớp, Không Biến Đổi Chi Tiết)
  private setupModularReskinListeners(modal: HTMLElement): void {
    const inputPrompt = modal.querySelector('#lpc-reskin-prompt') as HTMLInputElement;
    const btnApplyTheme = modal.querySelector('#lpc-btn-apply-theme') as HTMLButtonElement;
    const themeAppliedInfo = modal.querySelector('#lpc-theme-applied-info') as HTMLElement;
    const btnLoadTimeline = modal.querySelector('#lpc-btn-load-theme-timeline') as HTMLButtonElement;
    const btnExportStrip = modal.querySelector('#lpc-btn-export-theme-strip') as HTMLButtonElement;
    const tagButtons = modal.querySelectorAll('#lpc-theme-tags .lpc-reskin-tag-btn');

    // Hàm áp dụng một bộ Trang Phục Chủ Đề (Character Palette Theme)
    const applyTheme = (theme: CharacterPaletteTheme) => {
      this.currentSelectedThemeId = theme.id;

      // 1. Cập nhật palette cho từng Layer tương ứng trong Compositor theo danh mục (category)
      const currentLayers = this.compositor.getLayers();
      currentLayers.forEach((lyr) => {
        const cat = lyr.category as keyof typeof theme.palettes;
        const targetPaletteId = theme.palettes[cat];
        if (targetPaletteId) {
          this.compositor.setLayerPalette(lyr.id, targetPaletteId);
        }
      });

      // 2. Xóa cache và vẽ lại toàn bộ các màn hình hiển thị
      this.compositor.clearAllPaletteCaches();
      this.renderLayerList();
      this.drawPreview();
      this.updateFrameCounter();

      // 3. Cập nhật trạng thái hiển thị
      tagButtons.forEach((b) => {
        if (b.getAttribute('data-theme-id') === theme.id) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      if (themeAppliedInfo) {
        themeAppliedInfo.innerHTML = `Đang dùng: <b>${theme.name}</b> - 100% đồng nhất tất cả khung hình.`;
      }
      if (inputPrompt) {
        inputPrompt.value = theme.name;
      }
    };

    // 1. Sự kiện click vào các thẻ bộ trang phục nhanh
    tagButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const themeId = btn.getAttribute('data-theme-id');
        const theme = CHARACTER_THEMES.find((t) => t.id === themeId);
        if (theme) {
          applyTheme(theme);
        }
      });
    });

    // 2. Sự kiện bấm nút Áp Dụng theo Prompt thông minh
    btnApplyTheme?.addEventListener('click', () => {
      const promptText = inputPrompt?.value.trim() || '';
      if (!promptText) return;
      const matchedTheme = findThemeByPrompt(promptText) || CHARACTER_THEMES[0];
      if (matchedTheme) {
        applyTheme(matchedTheme);
      }
    });

    // Cho phép ấn Enter trong ô nhập prompt để áp dụng theme
    inputPrompt?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnApplyTheme?.click();
      }
    });

    // 3. Nạp toàn bộ hoạt cảnh đã đổi bảng màu vào Timeline của Studio
    btnLoadTimeline?.addEventListener('click', () => {
      const actionId = this.compositor.getCurrentActionId();
      const direction = this.compositor.getCurrentDirection();
      const clip = createAnimationClipFromLpc(this.compositor, actionId, direction);
      this.callbacks.onLoadClipToTimeline(clip);
      this.close();
    });

    // 4. Xuất dải Spritesheet Strip (PNG)
    btnExportStrip?.addEventListener('click', () => {
      const actionId = this.compositor.getCurrentActionId();
      const direction = this.compositor.getCurrentDirection();
      const { canvas } = exportLpcActionStrip(this.compositor, actionId, direction);

      const linkPng = document.createElement('a');
      linkPng.download = `lpc_${actionId}_${direction}_${this.currentSelectedThemeId}.png`;
      linkPng.href = canvas.toDataURL('image/png');
      linkPng.click();
    });

    // Áp dụng theme mặc định Paladin khi vừa mở modal
    const defaultTheme = CHARACTER_THEMES.find((t) => t.id === 'theme_paladin');
    if (defaultTheme) {
      applyTheme(defaultTheme);
    }
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
      } else if (layer.category === 'tails') {
        descriptors.push('furry animal tail');
      } else if (layer.category === 'ears') {
        descriptors.push('cute beastly ears');
      }
    });

    descriptors.push('16bit pixel art', 'clean outline', 'high detail sprite', 'rpg game asset');
    inputAiPrompt.value = descriptors.join(', ');
  }

  // Ve khung hinh len canvas xem truoc
  private drawPreview(): void {
    if (this.previewCtx) {
      this.compositor.renderCurrentFrame(this.previewCtx, 256, 256);
    }
    if (this.themePreviewCtx) {
      this.compositor.renderCurrentFrame(this.themePreviewCtx, 128, 128);
    }
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
