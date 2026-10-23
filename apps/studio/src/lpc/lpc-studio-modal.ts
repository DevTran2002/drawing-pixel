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
  findThemeByPrompt,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  generateRampFromHex
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

// Danh sách các danh mục bộ lọc cho phép người dùng tích chọn nhiều phụ kiện
export interface LpcFilterCategory {
  id: string;
  name: string;
}

export const LPC_FILTER_CATEGORIES: LpcFilterCategory[] = [
  { id: 'body', name: 'Thân người' },
  { id: 'torso', name: 'Áo / Giáp' },
  { id: 'legs', name: 'Quần' },
  { id: 'feet', name: 'Ủng' },
  { id: 'cape', name: 'Áo Choàng' },
  { id: 'hat', name: 'Mũ' },
  { id: 'hair', name: 'Tóc' },
  { id: 'weapon', name: 'Vũ Khí / Khiên' },
  { id: 'belt', name: 'Thắt Lưng' },
  { id: 'beast', name: 'Tai / Đuôi' }
];

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
    { id: 'armor_plate_heavy', name: 'Giáp Sắt Đại Hiệp Sĩ (Heavy Plate)', imageUrl: '/lpc_assets/armor_plate_heavy.png' },
    { id: 'armor_plate', name: 'Giáp Sắt Hiệp Sĩ (Steel Plate)', imageUrl: '/lpc_assets/armor_plate.png' },
    { id: 'armor_leather', name: 'Giáp Da Chiến Binh (Leather Armor)', imageUrl: '/lpc_assets/armor_leather.png' },
    { id: 'armor_leather_vest', name: 'Áo Giáp Da Thợ Săn (Leather Vest)', imageUrl: '/lpc_assets/armor_leather_vest.png' },
    { id: 'armor_legion', name: 'Giáp Quân Đoàn La Mã (Legion)', imageUrl: '/lpc_assets/armor_legion.png' },
    { id: 'armor_chainmail', name: 'Áo Giáp Lưới Xích (Chainmail)', imageUrl: '/lpc_assets/armor_chainmail.png' },
    { id: 'jacket_purple_chain', name: 'Áo Khoác Hoàng Gia Lót Xích (Purple Jacket)', imageUrl: '/lpc_assets/jacket_purple_chain.png' },
    { id: 'armor_plate_shoulders', name: 'Giáp Vai Bọc Sắt (Pauldrons)', imageUrl: '/lpc_assets/armor_plate_shoulders.png' },
    { id: 'shirt_white', name: 'Áo Sơ Mi Trắng Lữ Khách (White Shirt)', imageUrl: '/lpc_assets/shirt_white.png' },
    { id: 'robe_brown', name: 'Áo Choàng Đạo Sĩ Nâu (Mage Robe)', imageUrl: '/lpc_assets/robe_brown.png' },
    { id: 'torso_longsleeve', name: 'Áo Sơ Mi Tay Dài (Longsleeve)', imageUrl: '/lpc_assets/torso_longsleeve.png' },
    { id: 'torso_shortsleeve', name: 'Áo Cộc Tay Năng Động (Shortsleeve)', imageUrl: '/lpc_assets/torso_shortsleeve.png' }
  ],
  legs: [
    { id: 'pants_leather', name: 'Quần Da Chiến Binh (Leather Pants)', imageUrl: '/lpc_assets/pants_leather.png' },
    { id: 'pants_plate', name: 'Giáp Chân Bọc Thép (Plate Greaves)', imageUrl: '/lpc_assets/pants_plate.png' },
    { id: 'pants_forest', name: 'Quần Vải Lục Lâm (Forest Green Pants)', imageUrl: '/lpc_assets/pants_forest.png' },
    { id: 'skirt_robe', name: 'Váy Choàng Đạo Sĩ (Mage Robe Skirt)', imageUrl: '/lpc_assets/skirt_robe.png' },
    { id: 'pants_pantaloons', name: 'Quần Thụng Quý Tộc (Noble Pantaloons)', imageUrl: '/lpc_assets/pants_pantaloons.png' },
    { id: 'pants_shorts', name: 'Quần Đùi Dã Chiến (Adventurer Shorts)', imageUrl: '/lpc_assets/pants_shorts.png' },
    { id: 'pants_cuffed', name: 'Quần Túm Gấu Du Mục (Cuffed Pants)', imageUrl: '/lpc_assets/pants_cuffed.png' }
  ],
  feet: [
    { id: 'boots_basic', name: 'Ủng Da Hiệp Sĩ (Basic Boots)', imageUrl: '/lpc_assets/boots_leather.png' },
    { id: 'boots_fold', name: 'Ủng Gấp Cổ Cao (Fold Boots)', imageUrl: '/lpc_assets/boots_fold.png' },
    { id: 'boots_plate', name: 'Ủng Sắt Thiết Kỵ (Iron Plate Boots)', imageUrl: '/lpc_assets/boots_plate.png' },
    { id: 'shoes_brown', name: 'Giày Da Nâu Du Hành (Brown Shoes)', imageUrl: '/lpc_assets/shoes_brown.png' },
    { id: 'boots_sandals', name: 'Dép Quai Hậu Sandal (Traveler Sandals)', imageUrl: '/lpc_assets/boots_sandals.png' }
  ],
  hat: [
    { id: 'helmet_greathelm', name: 'Mũ Sắt Hiệp Sĩ (Greathelm)', imageUrl: '/lpc_assets/hat_helmet.png' },
    { id: 'hat_plate_helm', name: 'Mũ Sắt Toàn Diện (Full Plate Helm)', imageUrl: '/lpc_assets/hat_plate_helm.png' },
    { id: 'hat_chain_helm', name: 'Mũ Nồi Giáp Xích (Chainmail Coif)', imageUrl: '/lpc_assets/hat_chain_helm.png' },
    { id: 'hat_chain_hood', name: 'Mũ Trùm Đầu Giáp Xích (Chain Hood)', imageUrl: '/lpc_assets/hat_chain_hood.png' },
    { id: 'hat_leather', name: 'Mũ Da Cung Thủ (Ranger Leather Hat)', imageUrl: '/lpc_assets/hat_leather.png' },
    { id: 'hat_robe_hood', name: 'Mũ Trùm Pháp Sư Huyền Bí (Mage Hood)', imageUrl: '/lpc_assets/hat_robe_hood.png' },
    { id: 'hat_horned', name: 'Mũ Sừng Chiến Binh Viking (Horned Helm)', imageUrl: '/lpc_assets/hat_horned.png' },
    { id: 'hat_barbuta', name: 'Mũ Thiết Kỵ Barbuta (Barbuta Helm)', imageUrl: '/lpc_assets/hat_barbuta.png' }
  ],
  cape: [
    { id: 'cape_solid', name: 'Áo Choàng Hiệp Sĩ (Knight Cloak)', imageUrl: '/lpc_assets/cape_solid.png' }
  ],
  weapons: [
    { id: 'weapon_sword', name: 'Thanh Kiếm Hiệp Sĩ (Steel Broadsword)', imageUrl: '/lpc_assets/weapon_sword.png' }
  ],
  shield: [
    { id: 'shield_wooden', name: 'Khiên Gỗ Viền Thép (Wooden Shield)', imageUrl: '/lpc_assets/shield_wooden.png' }
  ],
  belt: [
    { id: 'belt_leather', name: 'Thắt Lưng Da Khóa Đồng (Leather Belt)', imageUrl: '/lpc_assets/belt_leather.png' },
    { id: 'belt_rope', name: 'Thắt Lưng Dây Thừng Đạo Sĩ (Rope Belt)', imageUrl: '/lpc_assets/belt_rope.png' }
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

  // Trạng thái giao diện nâng cao
  private isFullscreen = false;
  private currentZoom = 2; // 1: 128px, 2: 256px, 3: 320px
  private currentBg = 'checker'; // 'checker', 'dark', 'light', 'grass', 'dungeon'
  private isTurntableActive = false;
  private turntableTimer: any = null;
  private selectedCategoryFilters: Set<string> = new Set(LPC_FILTER_CATEGORIES.map((c) => c.id));
  private searchQuery = '';
  private dynamicManifestStyles: Record<string, LpcPresetStyle[]> = {};

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

  // Nạp danh mục phụ kiện phong phú từ tệp lpc_manifest.json (hơn 1.200 asset)
  private async loadDynamicManifest(): Promise<void> {
    try {
      const response = await fetch('/lpc_assets/lpc_manifest.json');
      if (response.ok) {
        const data = await response.json();
        this.dynamicManifestStyles = data;
      }
    } catch (err) {
      console.warn('Khong the doc lpc_manifest.json, dung danh muc mac dinh:', err);
    }
  }

  // Khởi tạo và mở Modal
  public async open(defaultBodyUrl = '/sprites.png'): Promise<void> {
    if (!this.container) {
      this.createDom();
    }

    if (!this.isInitialized) {
      // Nạp danh mục phụ kiện động từ manifest nếu có
      await this.loadDynamicManifest();
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

      // 9. Áo choàng hiệp sĩ (Z: 25)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_cape',
        name: 'Áo Choàng Hiệp Sĩ (Knight Cloak)',
        category: 'cape',
        zIndex: 25,
        imageUrl: '/lpc_assets/cape_solid.png',
        paletteId: 'cape_crimson',
        enabled: false // Mặc định tắt, người dùng có thể bật khi muốn
      });

      // 10. Thắt lưng da (Z: 44)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_belt',
        name: 'Thắt Lưng Da Khóa Đồng (Belt)',
        category: 'belt',
        zIndex: 44,
        imageUrl: '/lpc_assets/belt_leather.png',
        paletteId: 'belt_leather_brown',
        enabled: true
      });

      // 11. Thanh kiếm hiệp sĩ (Z: 58)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_weapon',
        name: 'Thanh Kiếm Hiệp Sĩ (Sword)',
        category: 'weapons',
        zIndex: 58,
        imageUrl: '/lpc_assets/weapon_sword.png',
        paletteId: 'weapon_steel',
        enabled: true
      });

      // 12. Khiên phòng thủ (Z: 60)
      await this.compositor.addOrUpdateLayer({
        id: 'layer_shield',
        name: 'Khiên Gỗ Viền Thép (Shield)',
        category: 'shield',
        zIndex: 60,
        imageUrl: '/lpc_assets/shield_wooden.png',
        paletteId: 'shield_wood_iron',
        enabled: false // Mặc định tắt
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
    if (this.turntableTimer) {
      clearInterval(this.turntableTimer);
      this.turntableTimer = null;
      this.isTurntableActive = false;
    }
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
      <div class="lpc-modal-dialog" id="lpc-modal-dialog">
        <!-- Header Nâng Cao -->
        <div class="lpc-modal-header">
          <div class="lpc-header-title">
            <span class="lpc-badge">LPC 2.5D</span>
            <h3>LPC Character Studio & Motion Rig</h3>
            <span class="lpc-badge-count" id="lpc-active-layers-count">6 Layer Hoạt Động</span>
          </div>
          <div class="lpc-header-actions">
            <button class="lpc-btn-header" id="lpc-btn-random" title="Phối ngẫu nhiên toàn bộ trang phục và màu sắc">
              Ngẫu Nhiên
            </button>
            <button class="lpc-btn-header" id="lpc-btn-reset" title="Khôi phục trạng thái ban đầu">
              ↺ Mặc Định
            </button>
            <button class="lpc-btn-header" id="lpc-btn-fullscreen" title="Phóng to / Thu nhỏ cửa sổ">
              ⛶ Toàn Màn Hình
            </button>
            <button class="lpc-btn-close" id="lpc-btn-close" title="Đóng">&times;</button>
          </div>
        </div>

        <!-- Body: 3 Columns Rộng Rãi -->
        <div class="lpc-modal-body">
          <!-- Col 1: Kho phụ kiện (Layers & Equipment) -->
          <div class="lpc-col lpc-col-layers">
            <div class="lpc-panel-header">
              <h4>Kho Phụ Kiện (Paper Doll)</h4>
              <label class="lpc-btn-upload" title="Nạp thêm ảnh layer PNG chuẩn LPC 832x3456">
                + Tải Layer
                <input type="file" id="lpc-layer-file-input" accept="image/png" style="display:none;" />
              </label>
            </div>

            <!-- Thanh tìm kiếm nhanh -->
            <div class="lpc-search-box">
              <input type="text" id="lpc-layer-search" class="lpc-search-input" placeholder="Tìm kiếm phụ kiện (tóc, giáp, mũ, kiếm...)" />
            </div>

            <!-- Nút Bộ Lọc dạng Popover cho phép tích chọn nhiều danh mục phụ kiện -->
            <div class="lpc-filter-bar">
              <div class="lpc-filter-dropdown-wrap">
                <button type="button" class="lpc-btn-filter-toggle" id="lpc-btn-filter-toggle" title="Nhấp để lọc nhiều loại phụ kiện">
                  <span>Bộ Lọc Phụ Kiện</span>
                  <span class="lpc-filter-badge" id="lpc-filter-badge-text">Tất Cả</span>
                </button>
                <div class="lpc-filter-dropdown" id="lpc-filter-dropdown">
                  <div class="lpc-filter-dropdown-header">
                    <span class="lpc-filter-title">Lọc Danh Mục Phụ Kiện</span>
                    <div class="lpc-filter-header-links">
                      <button type="button" id="lpc-filter-btn-select-all" class="lpc-filter-link">Tất cả</button>
                      <button type="button" id="lpc-filter-btn-clear-all" class="lpc-filter-link">Bỏ chọn</button>
                    </div>
                  </div>
                  <div class="lpc-filter-options-grid" id="lpc-filter-options-grid">
                    ${LPC_FILTER_CATEGORIES.map(
                      (c) => `
                      <label class="lpc-filter-checkbox-item">
                        <input type="checkbox" value="${c.id}" checked />
                        <span>${c.name}</span>
                      </label>
                    `
                    ).join('')}
                  </div>
                </div>
              </div>
              <button type="button" class="lpc-btn-filter-reset" id="lpc-btn-filter-reset" title="Khôi phục hiển thị toàn bộ phụ kiện">
                Hiện Tất Cả
              </button>
            </div>

            <!-- Danh sách Layer -->
            <div class="lpc-layer-list" id="lpc-layer-list">
              <!-- Danh sach layer do renderLayerList() sinh -->
            </div>
            <div class="lpc-hint-box">
              Sử dụng ▲ ▼ để đổi tầng xếp lớp Z-Order: Đuôi &rarr; Thân &rarr; Quần &rarr; Ủng &rarr; Áo &rarr; Áo Choàng &rarr; Thắt Lưng &rarr; Tóc &rarr; Tai &rarr; Mũ &rarr; Vũ Khí &rarr; Khiên.
            </div>
          </div>

          <!-- Col 2: Live Animation Preview & Controls -->
          <div class="lpc-col lpc-col-preview">
            <!-- Toolbar Xem Trước: Zoom, Background, Turntable 360 -->
            <div class="lpc-preview-toolbar">
              <div class="lpc-tool-group">
                <span class="lpc-tool-label">Thu phóng:</span>
                <button class="lpc-btn-mini" data-zoom="1">1x</button>
                <button class="lpc-btn-mini active" data-zoom="2">2x</button>
                <button class="lpc-btn-mini" data-zoom="3">3x</button>
              </div>

              <!-- Nút Xoay 360 Độ -->
              <button class="lpc-btn-turntable" id="lpc-btn-turntable" title="Tự động xoay tròn 4 hướng theo nhịp bước đi">
                Xoay tự động
              </button>

              <div class="lpc-tool-group">
                <span class="lpc-tool-label">Nền:</span>
                <div class="lpc-bg-dot lpc-bg-checker active" data-bg="checker" title="Caro trong suốt"></div>
                <div class="lpc-bg-dot lpc-bg-dark" data-bg="dark" title="Nền Tối"></div>
                <div class="lpc-bg-dot lpc-bg-light" data-bg="light" title="Nền Sáng"></div>
                <div class="lpc-bg-dot lpc-bg-grass" data-bg="grass" title="Thảo Nguyên"></div>
                <div class="lpc-bg-dot lpc-bg-dungeon" data-bg="dungeon" title="Hầm Ngục"></div>
              </div>
            </div>

            <!-- Khung Canvas Xem Trước -->
            <div class="lpc-preview-box" id="lpc-preview-box">
              <canvas id="lpc-preview-canvas" width="256" height="256"></canvas>
            </div>

            <!-- Điều Hướng 4 Hướng Nhìn -->
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

            <!-- Chọn Hoạt Cảnh & Điều Tốc Timeline -->
            <div class="lpc-action-controls">
              <div class="lpc-form-row">
                <label>Động tác:</label>
                <select id="lpc-action-select" class="lpc-select">
                  ${LPC_ACTION_GROUPS.map(
      (g) => `<option value="${g.id}">${g.name}</option>`
    ).join('')}
                </select>
              </div>

              <!-- Thanh Kéo Khung Hình (Timeline Scrubber) -->
              <div class="lpc-scrubber-box">
                <span style="font-size:11px;color:#94a3b8;width:60px;">Tua khung:</span>
                <input type="range" id="lpc-timeline-slider" class="lpc-timeline-slider" min="0" max="8" value="0" />
                <div class="lpc-frame-indicator" id="lpc-frame-indicator">Khung: 1 / 9</div>
              </div>

              <div class="lpc-playback-controls">
                <button id="lpc-btn-prev-frame" class="lpc-btn-secondary" title="Khung trước">&lt; Lùi</button>
                <button id="lpc-btn-play-pause" class="lpc-btn-primary" style="padding:5px 14px;">Tạm dừng</button>
                <button id="lpc-btn-step" class="lpc-btn-secondary" title="Khung tiếp">Tiếp &gt;</button>
                <div class="lpc-fps-box">
                  <span>FPS: <b id="lpc-fps-val">10</b></span>
                  <input type="range" id="lpc-fps-slider" min="1" max="24" value="10" />
                </div>
              </div>
            </div>
          </div>

          <!-- Col 3: Công cụ đồng bộ Studio & Trang phục chủ đề -->
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

            <!-- Tab 1: Trang Phục Chủ Đề & Palette Shading -->
            <div id="lpc-tab-p1" class="lpc-tab-pane active">
              <div class="lpc-reskin-studio">
                <div class="lpc-reskin-header">
                  <h5>Trang Phục Chủ Đề & Bảng Màu (Paper Doll)</h5>
                  <span class="lpc-badge" style="background:#2563eb;color:#ffffff;">Chuẩn 100% Khớp</span>
                </div>
                <p class="lpc-reskin-desc">
                  Áp dụng dải màu bóng khối đồng nhất lên toàn bộ các Layer vẽ tay của LPC. Không nhấp nháy, giữ nguyên 100% nét pixel gốc!
                </p>

                <!-- Grid Theme Cards với Swatch Màu Sắc -->
                <div class="lpc-theme-grid" id="lpc-theme-grid">
                  ${CHARACTER_THEMES.map(t => {
      // Tạo màu swatch đại diện cho từng chủ đề
      const colors = t.id === 'theme_paladin' ? ['#fbbf24', '#f1f5f9', '#2563eb'] :
        t.id === 'theme_flame_dragon' ? ['#ef4444', '#f97316', '#78350f'] :
          t.id === 'theme_cyberpunk' ? ['#06b6d4', '#d946ef', '#1e1b4b'] :
            t.id === 'theme_void_mystic' ? ['#8b5cf6', '#6366f1', '#0f172a'] :
              t.id === 'theme_shadow_assassin' ? ['#475569', '#1e293b', '#94a3b8'] :
                t.id === 'theme_emerald_ranger' ? ['#10b981', '#059669', '#d97706'] :
                  ['#3b82f6', '#60a5fa', '#1e293b'];
      return `
                      <div class="lpc-theme-card ${t.id === 'theme_paladin' ? 'active' : ''}" data-theme-id="${t.id}" title="${t.description}">
                        <div class="lpc-theme-card-title">${t.name}</div>
                        <div class="lpc-swatch-row">
                          <span class="lpc-swatch-pip" style="background:${colors[0]};"></span>
                          <span class="lpc-swatch-pip" style="background:${colors[1]};"></span>
                          <span class="lpc-swatch-pip" style="background:${colors[2]};"></span>
                        </div>
                      </div>
                    `;
    }).join('')}
                </div>

                <!-- Ô nhập Prompt thông minh -->
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                  <input type="text" id="lpc-reskin-prompt" class="lpc-input" style="flex:1;" placeholder="Nhập tên trang phục (paladin, rồng lửa, cyberpunk...)" value="Hiệp Sĩ Thánh Paladin" />
                  <button id="lpc-btn-apply-theme" class="lpc-btn-primary" style="padding:6px 12px;white-space:nowrap;">
                    Áp Dụng
                  </button>
                </div>

                <div id="lpc-theme-applied-info" style="font-size:11px;color:#38bdf8;background:rgba(56,189,248,0.1);padding:6px 10px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);margin-bottom:8px;">
                  Đang dùng: <b>Hiệp Sĩ Thánh Paladin (Vàng Kim)</b> - 100% đồng nhất tất cả khung hình.
                </div>

                <!-- Khối Tùy Biến Bảng Màu Tự Do (Full Custom Color Mixer) -->
                <div class="lpc-custom-palette-box">
                  <div class="lpc-custom-palette-header">
                    <span style="font-size:12px;font-weight:700;color:#38bdf8;">Tùy Biến Màu Tự Do (Color Mixer)</span>
                    <button type="button" id="lpc-btn-reset-all-colors" class="lpc-btn-mini" title="Khôi phục toàn bộ màu về mặc định">Mặc Định</button>
                  </div>

                  <!-- Thanh trượt Xoay Sắc Độ Toàn Thân (Hue Shift 360°) -->
                  <div class="lpc-slider-control-row">
                    <span style="font-size:11px;color:#cbd5e1;white-space:nowrap;">Xoay màu (Hue):</span>
                    <input type="range" id="lpc-hue-slider" min="0" max="360" value="0" class="lpc-slider-rainbow" />
                    <span id="lpc-hue-val" style="font-size:11px;color:#38bdf8;min-width:30px;text-align:right;">0°</span>
                  </div>

                  <!-- Lưới các bộ phận chính để chọn màu trực tiếp -->
                  <div class="lpc-bodypart-color-grid">
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Áo/Giáp</span>
                      <input type="color" id="lpc-color-torso" class="lpc-part-color-picker" value="#3b82f6" title="Chọn màu Áo/Giáp" />
                    </div>
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Quần</span>
                      <input type="color" id="lpc-color-legs" class="lpc-part-color-picker" value="#1e293b" title="Chọn màu Quần" />
                    </div>
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Ủng</span>
                      <input type="color" id="lpc-color-feet" class="lpc-part-color-picker" value="#475569" title="Chọn màu Ủng" />
                    </div>
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Tóc</span>
                      <input type="color" id="lpc-color-hair" class="lpc-part-color-picker" value="#d97706" title="Chọn màu Tóc" />
                    </div>
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Mũ</span>
                      <input type="color" id="lpc-color-hat" class="lpc-part-color-picker" value="#64748b" title="Chọn màu Mũ" />
                    </div>
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Áo Choàng</span>
                      <input type="color" id="lpc-color-cape" class="lpc-part-color-picker" value="#ef4444" title="Chọn màu Áo Choàng" />
                    </div>
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Vũ Khí</span>
                      <input type="color" id="lpc-color-weapons" class="lpc-part-color-picker" value="#94a3b8" title="Chọn màu Vũ Khí" />
                    </div>
                    <div class="lpc-bodypart-item">
                      <span class="lpc-bodypart-label">Khiên</span>
                      <input type="color" id="lpc-color-shield" class="lpc-part-color-picker" value="#78350f" title="Chọn màu Khiên" />
                    </div>
                  </div>

                  <!-- Các dải màu phối nhanh thịnh hành (Quick Swatches) -->
                  <div class="lpc-quick-swatches-box">
                    <span style="font-size:10px;color:#94a3b8;margin-bottom:2px;display:block;">Màu nhanh toàn thân:</span>
                    <div class="lpc-swatches-row">
                      <button type="button" class="lpc-quick-swatch" data-color="#ef4444" style="background:#ef4444;" title="Đỏ Hỏa Long"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#f97316" style="background:#f97316;" title="Cam Hổ Phách"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#eab308" style="background:#eab308;" title="Vàng Hoàng Kim"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#10b981" style="background:#10b981;" title="Xanh Lục Bảo"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#06b6d4" style="background:#06b6d4;" title="Xanh Biển Neon"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#3b82f6" style="background:#3b82f6;" title="Lam Hiệp Sĩ"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#8b5cf6" style="background:#8b5cf6;" title="Tím Hư Không"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#ec4899" style="background:#ec4899;" title="Hồng Sakura"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#f1f5f9" style="background:#f1f5f9;" title="Bạch Kim Tuyết"></button>
                      <button type="button" class="lpc-quick-swatch" data-color="#0f172a" style="background:#0f172a;border:1px solid #475569;" title="Đen Bóng Đêm"></button>
                    </div>
                  </div>
                </div>

                <!-- Xem trước hoạt cảnh đã phối màu -->
                <div class="lpc-reskin-preview-area active">
                  <div style="font-size:11px;font-weight:600;color:#60a5fa;margin-bottom:4px;">Xem trước chuyển động phối màu:</div>
                  <div class="lpc-preview-canvas-box" style="box-shadow: 0 0 16px rgba(37, 99, 235, 0.4);margin-bottom:6px;">
                    <canvas id="lpc-reskin-anim-canvas" width="128" height="128"></canvas>
                  </div>
                  <div style="display:flex;gap:6px;width:100%;">
                    <button id="lpc-btn-load-theme-timeline" class="lpc-btn-primary" style="flex:1;">
                      Nạp Vào Timeline
                    </button>
                    <button id="lpc-btn-export-theme-strip" class="lpc-btn-secondary" style="flex:1;">
                      Xuất PNG
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tab 2: AI Keyframe Studio -->
            <div id="lpc-tab-p2" class="lpc-tab-pane">
              <div class="lpc-keyframe-studio">
                <div class="lpc-keyframe-header">
                  <h5>AI Keyframe Studio</h5>
                  <span class="lpc-badge" style="background:#7c3aed;color:#ffffff;">Phương Án 2</span>
                </div>
                <p class="lpc-subtext">Sáng tạo trang phục mới trên 1 Frame mẫu, sau đó chuyển giao chuyển động sang toàn bộ hoạt cảnh:</p>

                <!-- Thẻ phong cách nhanh -->
                <div class="lpc-keyframe-tags">
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, cyberpunk glowing armor, neon visor, futuristic battle suit, sharp outline">Cyberpunk</button>
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, flame dragon plate armor, molten gold trims, glowing runes, sharp outline">Giáp Rồng</button>
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, dark mystic wizard robes, void energy aura, glowing runes, sharp outline">Phù Thủy</button>
                  <button type="button" class="lpc-tag-btn" data-prompt="pixel art, 16-bit RPG, holy paladin royal plate armor, shining golden crest, sharp outline">Hiệp Sĩ</button>
                </div>

                <input type="text" id="lpc-keyframe-prompt" class="lpc-input" placeholder="Mô tả ý tưởng trang phục sáng tạo..." />

                <div class="lpc-strength-row">
                  <span>Độ sáng tạo:</span>
                  <input type="range" id="lpc-keyframe-strength" min="35" max="75" value="58" />
                  <b id="lpc-keyframe-strength-val" style="color:#c084fc;">0.58</b>
                </div>

                <button id="lpc-btn-gen-keyframe" class="lpc-btn-accent" style="background:linear-gradient(135deg, #7c3aed, #a855f7);">
                  Sinh Mẫu Thử Keyframe
                </button>

                <div class="lpc-keyframe-preview-area" id="lpc-keyframe-preview-area">
                  <div class="lpc-preview-canvas-box">
                    <canvas id="lpc-keyframe-preview-canvas" width="128" height="128"></canvas>
                  </div>
                  <div id="lpc-keyframe-seed-info" style="font-size:11px;color:#cbd5e1;">Seed: -</div>
                  <div class="lpc-keyframe-actions-row">
                    <button id="lpc-btn-reroll-keyframe" class="lpc-btn-secondary">Thử Khác</button>
                    <button id="lpc-btn-apply-transfer" class="lpc-btn-accent" style="background:linear-gradient(135deg, #059669, #10b981);">Duyệt & Chuyển Giao</button>
                  </div>
                </div>

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

    // 1.1 Toàn Màn Hình (Fullscreen)
    const btnFullscreen = modal.querySelector('#lpc-btn-fullscreen') as HTMLButtonElement;
    const dialog = modal.querySelector('#lpc-modal-dialog');
    btnFullscreen?.addEventListener('click', () => {
      this.isFullscreen = !this.isFullscreen;
      dialog?.classList.toggle('fullscreen', this.isFullscreen);
      btnFullscreen.textContent = this.isFullscreen ? 'Thu Nhỏ' : 'Toàn Màn Hình';
    });

    // 1.2 Nút Phối Ngẫu Nhiên (Randomize)
    const btnRandom = modal.querySelector('#lpc-btn-random');
    btnRandom?.addEventListener('click', () => {
      this.randomizeCharacter();
    });

    // 1.3 Nút Đặt Lại Mặc Định (Reset)
    const btnReset = modal.querySelector('#lpc-btn-reset');
    btnReset?.addEventListener('click', () => {
      this.resetCharacter();
    });

    // 1.4 Bộ lọc danh mục đa chọn dạng Popover (Multi-select Category Popover)
    const btnFilterToggle = modal.querySelector('#lpc-btn-filter-toggle') as HTMLButtonElement;
    const filterDropdown = modal.querySelector('#lpc-filter-dropdown') as HTMLElement;
    const filterBadgeText = modal.querySelector('#lpc-filter-badge-text');
    const filterCheckboxes = modal.querySelectorAll('#lpc-filter-options-grid input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    const btnSelectAll = modal.querySelector('#lpc-filter-btn-select-all');
    const btnClearAll = modal.querySelector('#lpc-filter-btn-clear-all');
    const btnFilterReset = modal.querySelector('#lpc-btn-filter-reset');

    // Hàm cập nhật nhãn hiển thị trạng thái bộ lọc
    const updateFilterBadge = () => {
      const selectedCount = this.selectedCategoryFilters.size;
      const totalCount = LPC_FILTER_CATEGORIES.length;
      if (filterBadgeText) {
        if (selectedCount === totalCount) {
          filterBadgeText.textContent = 'Tất Cả';
        } else if (selectedCount === 0) {
          filterBadgeText.textContent = 'Không có (0)';
        } else {
          filterBadgeText.textContent = `${selectedCount}/${totalCount}`;
        }
      }
      if (btnFilterToggle) {
        btnFilterToggle.classList.toggle('has-filter', selectedCount < totalCount);
      }
    };

    // Bật/tắt menu popover thả xuống
    btnFilterToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      filterDropdown?.classList.toggle('open');
    });

    // Ngăn chặn sự kiện click bên trong dropdown bị lan ra ngoài làm đóng menu
    filterDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Đóng dropdown khi nhấp chuột ra ngoài
    document.addEventListener('click', () => {
      if (filterDropdown && filterDropdown.classList.contains('open')) {
        filterDropdown.classList.remove('open');
      }
    });

    // Bắt sự kiện khi người dùng tích/bỏ tích các checkbox danh mục
    filterCheckboxes.forEach((cb) => {
      cb.addEventListener('change', () => {
        const catId = cb.value;
        if (cb.checked) {
          this.selectedCategoryFilters.add(catId);
        } else {
          this.selectedCategoryFilters.delete(catId);
        }
        updateFilterBadge();
        this.renderLayerList();
      });
    });

    // Nút Chọn tất cả danh mục
    btnSelectAll?.addEventListener('click', () => {
      filterCheckboxes.forEach((cb) => {
        cb.checked = true;
      });
      LPC_FILTER_CATEGORIES.forEach((c) => this.selectedCategoryFilters.add(c.id));
      updateFilterBadge();
      this.renderLayerList();
    });

    // Nút Bỏ chọn toàn bộ
    btnClearAll?.addEventListener('click', () => {
      filterCheckboxes.forEach((cb) => {
        cb.checked = false;
      });
      this.selectedCategoryFilters.clear();
      updateFilterBadge();
      this.renderLayerList();
    });

    // Nút Hiện Tất Cả đặt ngoài thanh công cụ
    btnFilterReset?.addEventListener('click', () => {
      filterCheckboxes.forEach((cb) => {
        cb.checked = true;
      });
      LPC_FILTER_CATEGORIES.forEach((c) => this.selectedCategoryFilters.add(c.id));
      updateFilterBadge();
      this.renderLayerList();
      filterDropdown?.classList.remove('open');
    });

    // 1.5 Tìm kiếm phụ kiện
    const searchInput = modal.querySelector('#lpc-layer-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim().toLowerCase();
      this.renderLayerList();
    });

    // 1.6 Thu phóng (Zoom: 1x, 2x, 3x)
    const zoomBtns = modal.querySelectorAll('[data-zoom]');
    const previewBox = modal.querySelector('#lpc-preview-box') as HTMLElement;
    zoomBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        zoomBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const zoom = parseInt(btn.getAttribute('data-zoom') || '2', 10);
        this.currentZoom = zoom;
        const size = zoom === 1 ? 128 : zoom === 3 ? 320 : 256;
        if (this.previewCanvas && previewBox) {
          this.previewCanvas.style.width = `${size}px`;
          this.previewCanvas.style.height = `${size}px`;
          previewBox.style.width = `${size}px`;
          previewBox.style.height = `${size}px`;
        }
      });
    });

    // 1.7 Đổi Nền Xem Trước (Background Changer)
    const bgDots = modal.querySelectorAll('.lpc-bg-dot');
    bgDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        bgDots.forEach((d) => d.classList.remove('active'));
        dot.classList.add('active');
        const bg = dot.getAttribute('data-bg') || 'checker';
        this.currentBg = bg;
        if (previewBox) {
          previewBox.className = `lpc-preview-box lpc-bg-${bg}`;
          if (bg === 'dark') previewBox.style.backgroundColor = '#060911';
          else if (bg === 'light') previewBox.style.backgroundColor = '#e2e8f0';
          else if (bg === 'grass') previewBox.style.backgroundColor = '#14532d';
          else if (bg === 'dungeon') previewBox.style.backgroundColor = '#2d3748';
          else previewBox.style.backgroundColor = '#1e293b';
        }
      });
    });

    // 1.8 Nút Tự Động Xoay 360 Độ (Auto Turntable)
    const btnTurntable = modal.querySelector('#lpc-btn-turntable') as HTMLButtonElement;
    btnTurntable?.addEventListener('click', () => {
      this.isTurntableActive = !this.isTurntableActive;
      btnTurntable.classList.toggle('active', this.isTurntableActive);

      if (this.isTurntableActive) {
        btnTurntable.textContent = '⏹ Dừng Xoay';
        this.turntableTimer = setInterval(() => {
          const nextDir = this.compositor.rotateDirection360();
          // Cập nhật D-Pad active
          const dpadBtns = modal.querySelectorAll('.lpc-dpad-btn');
          dpadBtns.forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-dir') === nextDir);
          });
          this.drawPreview();
        }, 1200);
      } else {
        btnTurntable.textContent = 'Xoay 360°';
        if (this.turntableTimer) {
          clearInterval(this.turntableTimer);
          this.turntableTimer = null;
        }
      }
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

    // 5. Khung trước / Khung tiếp (Step & Prev)
    const btnPrevFrame = modal.querySelector('#lpc-btn-prev-frame');
    btnPrevFrame?.addEventListener('click', () => {
      this.compositor.stopAnimation();
      if (btnPlayPause) btnPlayPause.textContent = 'Phát';
      this.compositor.stepPrevFrame();
      this.drawPreview();
      this.updateFrameCounter();
    });

    const btnStep = modal.querySelector('#lpc-btn-step');
    btnStep?.addEventListener('click', () => {
      this.compositor.stopAnimation();
      if (btnPlayPause) btnPlayPause.textContent = 'Phát';
      this.compositor.stepNextFrame();
      this.drawPreview();
      this.updateFrameCounter();
    });

    // 5.1 Thanh Kéo Khung Hình (Timeline Scrubber)
    const timelineSlider = modal.querySelector('#lpc-timeline-slider') as HTMLInputElement;
    timelineSlider?.addEventListener('input', () => {
      this.compositor.stopAnimation();
      if (btnPlayPause) btnPlayPause.textContent = 'Phát';
      const frameIdx = parseInt(timelineSlider.value, 10);
      this.compositor.setFrameIndex(frameIdx);
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
  // Cài đặt các sự kiện cho công cụ AI Modular Re-skin (Phương Án 1: Giữ nguyên 100% giải phẫu chuẩn LPC)
  private setupModularReskinListeners(modal: HTMLElement): void {
    const inputPrompt = modal.querySelector('#lpc-reskin-prompt') as HTMLInputElement;
    const btnApplyTheme = modal.querySelector('#lpc-btn-apply-theme') as HTMLButtonElement;
    const themeAppliedInfo = modal.querySelector('#lpc-theme-applied-info') as HTMLElement;
    const btnLoadTimeline = modal.querySelector('#lpc-btn-load-theme-timeline') as HTMLButtonElement;
    const btnExportStrip = modal.querySelector('#lpc-btn-export-theme-strip') as HTMLButtonElement;
    const themeCards = modal.querySelectorAll('#lpc-theme-grid .lpc-theme-card');

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

      // 3. Cập nhật trạng thái hiển thị trên Grid Card
      themeCards.forEach((c) => {
        if (c.getAttribute('data-theme-id') === theme.id) {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });

      if (themeAppliedInfo) {
        themeAppliedInfo.innerHTML = `Đang dùng: <b>${theme.name}</b> - 100% đồng nhất tất cả khung hình.`;
      }
      if (inputPrompt) {
        inputPrompt.value = theme.name;
      }
    };

    // 1. Sự kiện click vào các thẻ bộ trang phục dạng Grid Card
    themeCards.forEach((card) => {
      card.addEventListener('click', () => {
        const themeId = card.getAttribute('data-theme-id');
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

    // 5. Tùy biến màu tự do cho từng bộ phận trang phục (Color Picker)
    const partInputs: { id: string; category: string }[] = [
      { id: '#lpc-color-torso', category: 'torso' },
      { id: '#lpc-color-legs', category: 'legs' },
      { id: '#lpc-color-feet', category: 'feet' },
      { id: '#lpc-color-hair', category: 'hair' },
      { id: '#lpc-color-hat', category: 'hat' },
      { id: '#lpc-color-cape', category: 'cape' },
      { id: '#lpc-color-weapons', category: 'weapons' },
      { id: '#lpc-color-shield', category: 'shield' }
    ];

    partInputs.forEach(({ id, category }) => {
      const inputEl = modal.querySelector(id) as HTMLInputElement;
      if (!inputEl) return;

      inputEl.addEventListener('input', () => {
        const hex = inputEl.value;
        const targetLayer = this.compositor.getLayers().find((l) => l.category === category);
        if (targetLayer) {
          this.compositor.setLayerCustomColor(targetLayer.id, hex);
          this.drawPreview();
        }
      });

      inputEl.addEventListener('change', () => {
        this.renderLayerList();
      });
    });

    // 6. Thanh trượt Xoay Sắc Độ Toàn Thân (Hue Shift 360°)
    const hueSlider = modal.querySelector('#lpc-hue-slider') as HTMLInputElement;
    const hueVal = modal.querySelector('#lpc-hue-val') as HTMLElement;
    let lastHueValue = 0;

    hueSlider?.addEventListener('input', () => {
      const shiftDeg = parseInt(hueSlider.value, 10);
      if (hueVal) hueVal.textContent = `${shiftDeg}°`;

      const delta = shiftDeg - lastHueValue;
      lastHueValue = shiftDeg;

      // Xoay Hue của tất cả layer trang phục đang bật (ngoại trừ màu da body)
      const layers = this.compositor.getLayers().filter((l) => l.category !== 'body' && l.enabled);
      layers.forEach((layer) => {
        let baseColorHex = layer.customColor;
        if (!baseColorHex) {
          const availablePalettes = getPalettesByCategory(layer.category);
          const activePalette = availablePalettes.find((p) => p.id === layer.paletteId);
          if (activePalette && activePalette.colors.length > 0) {
            const midIdx = Math.floor(activePalette.colors.length / 2);
            baseColorHex = activePalette.colors[midIdx];
          }
        }
        if (baseColorHex) {
          const rgb = hexToRgb(baseColorHex);
          const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          const newH = (hsl.h + delta + 360) % 360;
          const newRgb = hslToRgb(newH, hsl.s, hsl.l);
          const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
          this.compositor.setLayerCustomColor(layer.id, newHex);
        }
      });

      this.drawPreview();
    });

    hueSlider?.addEventListener('change', () => {
      this.renderLayerList();
    });

    // 7. Các ô màu nhanh thịnh hành (Quick Swatches)
    const quickSwatches = modal.querySelectorAll('.lpc-quick-swatch');
    quickSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const hex = swatch.getAttribute('data-color');
        if (!hex) return;

        // Phối màu đồng nhất cho các bộ phận chính: áo giáp, mũ, áo choàng
        const mainCategories = ['torso', 'hat', 'cape'];
        const layers = this.compositor.getLayers();
        layers.forEach((layer) => {
          if (mainCategories.includes(layer.category)) {
            this.compositor.setLayerCustomColor(layer.id, hex);
          }
        });

        // Đồng bộ giá trị trên các ô Color Picker
        const torsoInput = modal.querySelector('#lpc-color-torso') as HTMLInputElement;
        const hatInput = modal.querySelector('#lpc-color-hat') as HTMLInputElement;
        const capeInput = modal.querySelector('#lpc-color-cape') as HTMLInputElement;
        if (torsoInput) torsoInput.value = hex;
        if (hatInput) hatInput.value = hex;
        if (capeInput) capeInput.value = hex;

        this.compositor.clearAllPaletteCaches();
        this.renderLayerList();
        this.drawPreview();
      });
    });

    // 8. Nút khôi phục toàn bộ màu về mặc định
    const btnResetAllColors = modal.querySelector('#lpc-btn-reset-all-colors');
    btnResetAllColors?.addEventListener('click', () => {
      const layers = this.compositor.getLayers();
      layers.forEach((layer) => {
        this.compositor.setLayerCustomColor(layer.id, undefined);
      });

      if (hueSlider) hueSlider.value = '0';
      if (hueVal) hueVal.textContent = '0°';
      lastHueValue = 0;

      this.compositor.clearAllPaletteCaches();
      this.renderLayerList();
      this.drawPreview();
    });

    // Áp dụng theme mặc định Paladin khi vừa mở modal
    const defaultTheme = CHARACTER_THEMES.find((t) => t.id === 'theme_paladin');
    if (defaultTheme) {
      applyTheme(defaultTheme);
    }
  }

  // Cập nhật nhãn đếm số lượng layer đang bật trên Header
  private updateActiveLayersBadge(): void {
    if (!this.container) return;
    const badge = this.container.querySelector('#lpc-active-layers-count');
    if (badge) {
      const all = this.compositor.getLayers();
      const active = all.filter((l) => l.enabled);
      badge.textContent = `${active.length}/${all.length} Layer Hoạt Động`;
    }
  }

  // Phối ngẫu nhiên toàn bộ trang phục, kiểu tóc và màu sắc
  private randomizeCharacter(): void {
    const layers = this.compositor.getLayers();
    for (const lyr of layers) {
      // Phụ kiện thú và mũ xuất hiện ngẫu nhiên với xác suất 40%
      if (['hat', 'tails', 'ears'].includes(lyr.category)) {
        this.compositor.setLayerEnabled(lyr.id, Math.random() < 0.4);
      } else {
        this.compositor.setLayerEnabled(lyr.id, true);
      }

      // Chọn kiểu dáng ngẫu nhiên từ kho preset
      const availableStyles = this.getAvailableStylesForCategory(lyr.category);
      if (availableStyles.length > 0) {
        const randomStyle = availableStyles[Math.floor(Math.random() * availableStyles.length)];
        this.compositor.changeLayerImage(lyr.id, randomStyle.imageUrl, randomStyle.name);
      }

      // Chọn bảng màu ngẫu nhiên
      const availablePalettes = getPalettesByCategory(lyr.category);
      if (availablePalettes.length > 0) {
        const randomPalette = availablePalettes[Math.floor(Math.random() * availablePalettes.length)];
        this.compositor.setLayerPalette(lyr.id, randomPalette.id);
      }
    }

    this.compositor.clearAllPaletteCaches();
    this.renderLayerList();
    this.drawPreview();
    this.updateActiveLayersBadge();
    this.updateAiPromptSuggestion();
  }

  // Khôi phục nhân vật về trang phục mặc định ban đầu
  private async resetCharacter(): Promise<void> {
    const layers = this.compositor.getLayers();
    for (const lyr of layers) {
      if (lyr.category === 'body') {
        this.compositor.setLayerEnabled(lyr.id, true);
        this.compositor.setLayerPalette(lyr.id, 'body_fair');
      } else if (lyr.category === 'legs') {
        this.compositor.setLayerEnabled(lyr.id, true);
        await this.compositor.changeLayerImage(lyr.id, '/lpc_assets/pants_leather.png', 'Quần Dài Chiến Binh (Pants)');
        this.compositor.setLayerPalette(lyr.id, 'legs_leather_brown');
      } else if (lyr.category === 'feet') {
        this.compositor.setLayerEnabled(lyr.id, true);
        await this.compositor.changeLayerImage(lyr.id, '/lpc_assets/boots_leather.png', 'Ủng Da Hiệp Sĩ (Boots)');
        this.compositor.setLayerPalette(lyr.id, 'feet_brown');
      } else if (lyr.category === 'torso') {
        this.compositor.setLayerEnabled(lyr.id, true);
        await this.compositor.changeLayerImage(lyr.id, '/lpc_assets/armor_plate.png', 'Giáp Sắt Hiệp Sĩ (Plate)');
        this.compositor.setLayerPalette(lyr.id, 'torso_steel_blue');
      } else if (lyr.category === 'hair') {
        this.compositor.setLayerEnabled(lyr.id, true);
        await this.compositor.changeLayerImage(lyr.id, '/lpc_assets/hair_messy.png', 'Tóc Xù Lãng Tử (Messy)');
        this.compositor.setLayerPalette(lyr.id, 'hair_brown');
      } else if (lyr.category === 'belt') {
        this.compositor.setLayerEnabled(lyr.id, true);
        await this.compositor.changeLayerImage(lyr.id, '/lpc_assets/belt_leather.png', 'Thắt Lưng Da Khóa Đồng (Belt)');
        this.compositor.setLayerPalette(lyr.id, 'belt_leather_brown');
      } else if (lyr.category === 'weapons') {
        this.compositor.setLayerEnabled(lyr.id, true);
        await this.compositor.changeLayerImage(lyr.id, '/lpc_assets/weapon_sword.png', 'Thanh Kiếm Hiệp Sĩ (Sword)');
        this.compositor.setLayerPalette(lyr.id, 'weapon_steel');
      } else if (lyr.category === 'cape') {
        this.compositor.setLayerEnabled(lyr.id, false);
      } else if (lyr.category === 'shield') {
        this.compositor.setLayerEnabled(lyr.id, false);
      } else {
        // Tắt các phụ kiện nón, tai, đuôi
        this.compositor.setLayerEnabled(lyr.id, false);
      }
    }

    this.compositor.clearAllPaletteCaches();
    this.renderLayerList();
    this.drawPreview();
    this.updateActiveLayersBadge();
    this.updateAiPromptSuggestion();
  }

  // Lấy danh sách kiểu dáng phụ kiện kết hợp cả preset tĩnh và tệp dynamic manifest
  private getAvailableStylesForCategory(category: string): LpcPresetStyle[] {
    const staticStyles = LPC_PRESET_STYLES[category] || [];
    const dynamicStyles = this.dynamicManifestStyles[category] || [];
    if (dynamicStyles.length === 0) return staticStyles;

    // Kết hợp và loại bỏ trùng lặp imageUrl
    const map = new Map<string, LpcPresetStyle>();
    staticStyles.forEach(s => map.set(s.imageUrl, s));
    dynamicStyles.forEach(s => {
      if (!map.has(s.imageUrl)) {
        map.set(s.imageUrl, s);
      }
    });

    return Array.from(map.values());
  }

  // Cập nhật danh sách layer hiển thị ở cột 1 kèm bộ chọn bảng màu (Palette Shading)
  private renderLayerList(): void {
    if (!this.container) return;
    const listContainer = this.container.querySelector('#lpc-layer-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const allLayers = this.compositor.getLayers();

    // 1. Áp dụng bộ lọc danh mục đa chọn (Multi-select Category filter)
    let filteredLayers = allLayers;
    if (this.selectedCategoryFilters.size < LPC_FILTER_CATEGORIES.length) {
      filteredLayers = filteredLayers.filter((l) => {
        let catKey: string = l.category;
        if (catKey === 'tails' || catKey === 'ears') catKey = 'beast';
        if (catKey === 'weapons' || catKey === 'shield' || catKey === 'quiver') catKey = 'weapon';
        return this.selectedCategoryFilters.has(catKey);
      });
    }

    // 2. Áp dụng tìm kiếm phụ kiện
    if (this.searchQuery) {
      filteredLayers = filteredLayers.filter(l => l.name.toLowerCase().includes(this.searchQuery));
    }

    if (filteredLayers.length === 0) {
      listContainer.innerHTML = '<div class="lpc-empty-hint" style="padding:16px;text-align:center;color:#64748b;font-size:12px;">Không tìm thấy phụ kiện nào phù hợp.</div>';
      this.updateActiveLayersBadge();
      return;
    }

    filteredLayers.forEach((layer) => {
      const itemRow = document.createElement('div');
      itemRow.className = `lpc-layer-item ${layer.enabled ? 'active' : ''}`;

      // Lấy danh sách mẫu kiểu dáng phong phú
      const availableStyles = this.getAvailableStylesForCategory(layer.category);
      const hasStyles = availableStyles.length > 1;

      // Lấy danh sách bảng màu phù hợp
      const availablePalettes = getPalettesByCategory(layer.category);
      const hasPalettes = availablePalettes.length > 0;

      const styleOptionsHtml = hasStyles
        ? availableStyles
          .slice(0, 50) // Giới hạn 50 mẫu tiêu biểu để dropdown mượt mà
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
          <div class="lpc-layer-title-group">
            <label class="lpc-switch">
              <input type="checkbox" ${layer.enabled ? 'checked' : ''} />
              <span class="lpc-switch-slider"></span>
            </label>
            <span class="lpc-layer-name" title="${layer.name}">${layer.name}</span>
          </div>
          <div class="lpc-layer-badges">
            <div class="lpc-z-controls">
              <button class="lpc-z-btn btn-z-up" title="Đẩy layer lên trên (Tăng Z-Index)">▲</button>
              <button class="lpc-z-btn btn-z-down" title="Đẩy layer xuống dưới (Giảm Z-Index)">▼</button>
            </div>
            <span class="lpc-z-badge">Z:${layer.zIndex}</span>
            ${layer.category !== 'body'
          ? `<button class="lpc-btn-remove-layer" title="Xóa layer">&times;</button>`
          : ''
        }
          </div>
        </div>
        ${hasStyles
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
        ${hasPalettes
          ? `
          <div class="lpc-layer-palette-row">
            <span class="lpc-palette-label">Màu:</span>
            <select class="lpc-palette-select" data-layer-id="${layer.id}">
              <option value="" ${!layer.paletteId && !layer.customColor ? 'selected' : ''}>Màu gốc (Original)</option>
              ${layer.customColor ? `<option value="__custom__" selected>Tự chọn (${layer.customColor})</option>` : ''}
              ${paletteOptionsHtml}
            </select>
            <div class="lpc-color-picker-wrap" title="Chọn màu tự do (Color Picker)">
              <span class="lpc-color-picker-swatch" style="background:${layer.customColor || '#38bdf8'};"></span>
              <input type="color" class="lpc-layer-color-picker" data-layer-id="${layer.id}" value="${layer.customColor || '#38bdf8'}" />
            </div>
            ${layer.customColor
            ? `<button class="lpc-btn-reset-color" data-layer-id="${layer.id}" title="Xóa màu tự do, trở về màu mặc định">&times;</button>`
            : ''
          }
          </div>
        `
          : ''
        }
      `;

      // Switch toggle bật/tắt layer
      const checkbox = itemRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox?.addEventListener('change', () => {
        this.compositor.setLayerEnabled(layer.id, checkbox.checked);
        itemRow.classList.toggle('active', checkbox.checked);
        this.drawPreview();
        this.updateActiveLayersBadge();
        this.updateAiPromptSuggestion();
      });

      // Nút điều chỉnh Z-Index Lên trên
      const btnZUp = itemRow.querySelector('.btn-z-up');
      btnZUp?.addEventListener('click', () => {
        this.compositor.moveLayerZIndex(layer.id, 5);
        this.renderLayerList();
        this.drawPreview();
      });

      // Nút điều chỉnh Z-Index Xuống dưới
      const btnZDown = itemRow.querySelector('.btn-z-down');
      btnZDown?.addEventListener('click', () => {
        this.compositor.moveLayerZIndex(layer.id, -5);
        this.renderLayerList();
        this.drawPreview();
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

      // Bắt sự kiện chọn màu tự do bằng Color Picker
      const colorPicker = itemRow.querySelector('.lpc-layer-color-picker') as HTMLInputElement;
      const colorSwatch = itemRow.querySelector('.lpc-color-picker-swatch') as HTMLElement;
      colorPicker?.addEventListener('input', () => {
        const newColor = colorPicker.value;
        if (colorSwatch) colorSwatch.style.backgroundColor = newColor;
        this.compositor.setLayerCustomColor(layer.id, newColor);
        this.drawPreview();
      });
      colorPicker?.addEventListener('change', () => {
        this.renderLayerList();
      });

      // Bắt sự kiện xóa màu tự do
      const btnResetColor = itemRow.querySelector('.lpc-btn-reset-color') as HTMLButtonElement;
      btnResetColor?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.compositor.setLayerCustomColor(layer.id, undefined);
        this.renderLayerList();
        this.drawPreview();
      });

      // Nút xóa layer (ngoại trừ layer gốc)
      const btnRemove = itemRow.querySelector('.lpc-btn-remove-layer');
      btnRemove?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.compositor.removeLayer(layer.id);
        this.renderLayerList();
        this.drawPreview();
        this.updateActiveLayersBadge();
        this.updateAiPromptSuggestion();
      });

      listContainer.appendChild(itemRow);
    });

    this.updateActiveLayersBadge();
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

  // Cap nhat bo dem khung hinh (Frame X / N) va Timeline Scrubber
  private updateFrameCounter(): void {
    if (!this.container) return;
    const current = this.compositor.getCurrentFrameIndex();
    const total = this.compositor.getCurrentTotalFrames();

    const indicator = this.container.querySelector('#lpc-frame-indicator');
    if (indicator) {
      indicator.textContent = `Khung: ${current + 1} / ${total}`;
    }

    const slider = this.container.querySelector('#lpc-timeline-slider') as HTMLInputElement;
    if (slider) {
      slider.max = `${Math.max(0, total - 1)}`;
      slider.value = `${current}`;
    }
  }
}
