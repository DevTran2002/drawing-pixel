// apps/studio/src/main.ts
// Diem vao chinh cua ung dung Pixel Art Studio

import {
  createDefaultProject,
  CanvasProject,
  PixelColor,
  Point2D,
  coordToKey,
  McpDrawPayload,
  LayerData,
  LayerGroup
} from '@pixel-draw/shared-types';
import { CanvasEngine } from './core/canvas-engine';
import { HistoryManager, PixelChange } from './core/history-manager';
import { AnimationController } from './animation/animation-controller';
import { OnionSkinRenderer } from './animation/onion-skin-renderer';
import { PreviewPlayer } from './animation/preview-player';
import { ToolType, ToolContext } from './tools/base-tool';
import { drawLineBresenham } from './tools/line-tool';
import { drawRectBorders, drawCircleMidpoint } from './tools/shape-tool';
import { floodFill } from './tools/bucket-tool';
import { applyDitherPattern } from './tools/dither-tool';
import { adjustBrightness } from './tools/shade-tool';
import { getSymmetricPoints } from './tools/symmetry-manager';
import { PRESET_PALETTES } from './palette/palettes-data';
import { SelectionManager } from './tools/selection-tool';
import { flipHorizontal, flipVertical, rotate90Clockwise } from './tools/transform-tool';

// 1. Khoi tao trang thai toan cuc cua Studio
const project: CanvasProject = createDefaultProject(24, 24, 'HeroSprite');
const history = new HistoryManager(50);
const animController = new AnimationController(project);
const selectionManager = new SelectionManager();

// Lay cac phan tu DOM
const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement;

const canvasEngine = new CanvasEngine({
  canvas: mainCanvas,
  project,
  showGrid: true,
  showPivot: true
});

const onionSkinRenderer = new OnionSkinRenderer(project.width, project.height);
const previewPlayer = new PreviewPlayer(previewCanvas, project, animController);

// Theo doi thay doi kich thuoc cua Viewport de co gian Canvas toan man hinh
const viewportContainer = document.getElementById('viewport');
if (viewportContainer) {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        canvasEngine.resizeToContainer(Math.floor(width), Math.floor(height));
        renderAll();
      }
    }
  });
  resizeObserver.observe(viewportContainer);
}

// Trang thai cong cu va co ve
let activeTool: ToolType = 'pencil';
let primaryColor: PixelColor = '#ec4899';
let secondaryColor: PixelColor = '#000000';
let brushSize = 1;
let symmetryX = false;
let symmetryY = false;
let onionSkinEnabled = false;

// Trang thai giu phim Space va lia chuot (Pan/Hand tool)
let isSpacePressed = false;
let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };

let isPointerDown = false;
let pointerStartPoint: Point2D | null = null;
let currentStrokeChanges: PixelChange[] = [];

// 2. Ham render dong bo toan bo giao dien
function renderAll(): void {
  const onionCanvas = onionSkinRenderer.render(project, onionSkinEnabled);
  canvasEngine.render(onionCanvas);
  previewPlayer.renderCurrent();
  renderTimeline();
  renderLayers();
}

// 3. Xu ly ve bang chuot va co ve
function applyBrushAt(
  px: number,
  py: number,
  color: PixelColor,
  isRightClick: boolean
): void {
  const buffer = canvasEngine.getActiveLayerBuffer();
  if (!buffer) return;

  const targetColor = isRightClick ? secondaryColor : color;
  const currentFrame = canvasEngine.getCurrentFrame();
  const currentLayer = currentFrame?.layers.find(l => l.id === project.activeLayerId);
  if (!currentLayer || currentLayer.locked || !currentLayer.visible) return;

  // Tinh cac diem doi xung
  const symPoints = getSymmetricPoints(px, py, project.width, project.height, symmetryX, symmetryY);

  for (const pt of symPoints) {
    // Ap dung kich co co ve (brush size)
    const half = Math.floor(brushSize / 2);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const bx = pt.x + dx;
        const by = pt.y + dy;
        if (buffer.isValidCoord(bx, by)) {
          let drawColor = targetColor;

          if (activeTool === 'eraser') {
            drawColor = null;
          } else if (activeTool === 'dither') {
            drawColor = applyDitherPattern(bx, by, primaryColor, secondaryColor);
          } else if (activeTool === 'lighten') {
            drawColor = adjustBrightness(buffer.getPixel(bx, by), 15);
          } else if (activeTool === 'darken') {
            drawColor = adjustBrightness(buffer.getPixel(bx, by), -15);
          }

          const oldColor = buffer.getPixel(bx, by);
          if (oldColor !== drawColor) {
            buffer.setPixel(bx, by, drawColor);
            currentLayer.pixels[coordToKey(bx, by)] = drawColor;
            currentStrokeChanges.push({
              x: bx,
              y: by,
              oldColor,
              newColor: drawColor,
              layerId: project.activeLayerId,
              frameIndex: project.activeFrameIndex
            });
          }
        }
      }
    }
  }
}

// Bien theo doi vi tri di chuyen diem anh (Move tool)
let lastMovePoint: Point2D | null = null;

// Su kien chuot tren Canvas
mainCanvas.addEventListener('pointerdown', (e) => {
  // 1. Xu ly Pan/Hand Tool khi giu Space hoac nhan chuot giua (Middle click)
  if (isSpacePressed || e.button === 1) {
    isPanning = true;
    lastPanPoint = { x: e.clientX, y: e.clientY };
    mainCanvas.style.cursor = 'grabbing';
    return;
  }

  const pt = canvasEngine.screenToPixel(e.clientX, e.clientY);
  if (!pt) return;

  isPointerDown = true;
  pointerStartPoint = pt;
  currentStrokeChanges = [];

  const isRightClick = e.button === 2;

  // Cong cu chon vung (Selection)
  if (activeTool === 'select') {
    // Neu truoc do dang co floating selection thi commit xuong layer truoc
    if (selectionManager.hasFloating()) {
      const buffer = canvasEngine.getActiveLayerBuffer();
      const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
      if (buffer && currentLayer) {
        const ch = selectionManager.commitFloating(buffer, project.activeLayerId, project.activeFrameIndex, currentLayer.pixels);
        if (ch.length > 0) history.pushStep(ch);
        canvasEngine.setFloatingSelection(null);
      }
    }
    selectionManager.setSelection({ x: pt.x, y: pt.y, width: 1, height: 1 });
    canvasEngine.setSelection(selectionManager.getSelection());
    renderAll();
    return;
  }

  // Cong cu di chuyen (Move)
  if (activeTool === 'move') {
    lastMovePoint = pt;
    pointerStartPoint = pt;

    // Neu dang co vung chon: nhac cac pixel thanh Floating Selection va lam trong vi tri ban dau
    const buffer = canvasEngine.getActiveLayerBuffer();
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
      if (selectionManager.getSelection() && !selectionManager.hasFloating()) {
        selectionManager.liftSelection(buffer, project.activeLayerId, project.activeFrameIndex, currentLayer.pixels);
        canvasEngine.setFloatingSelection(selectionManager.getFloating());
        renderAll();
      }
    }
    return;
  }

  if (activeTool === 'eyedropper') {
    const buffer = canvasEngine.getActiveLayerBuffer();
    if (buffer) {
      const picked = buffer.getPixel(pt.x, pt.y);
      if (picked) {
        primaryColor = picked;
        updateColorInputs();
      }
    }
    isPointerDown = false;
    return;
  }

  if (activeTool === 'bucket') {
    const buffer = canvasEngine.getActiveLayerBuffer();
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
      const fillChanges = floodFill(buffer, pt.x, pt.y, isRightClick ? secondaryColor : primaryColor);
      for (const ch of fillChanges) {
        currentLayer.pixels[coordToKey(ch.x, ch.y)] = ch.newColor;
      }
      if (fillChanges.length > 0) {
        history.pushStep(fillChanges);
        renderAll();
      }
    }
    isPointerDown = false;
    return;
  }

  if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') {
    // Cong cu hinh hoc se ve khi tha chuot (pointerup)
    return;
  }

  applyBrushAt(pt.x, pt.y, primaryColor, isRightClick);
  canvasEngine.render();
});

mainCanvas.addEventListener('pointermove', (e) => {
  // 1. Neu dang o che do Pan viewport bang phim Space
  if (isPanning) {
    const dx = e.clientX - lastPanPoint.x;
    const dy = e.clientY - lastPanPoint.y;
    lastPanPoint = { x: e.clientX, y: e.clientY };
    canvasEngine.panOffset.x += dx;
    canvasEngine.panOffset.y += dy;
    renderAll();
    return;
  }

  const pt = canvasEngine.screenToPixel(e.clientX, e.clientY);

  const coordLabel = document.getElementById('cursor-coord');
  if (coordLabel) {
    coordLabel.innerText = pt ? `X: ${pt.x}, Y: ${pt.y}` : 'X: --, Y: --';
  }

  if (!isPointerDown || !pt) return;

  // Xu ly keo vung chon
  if (activeTool === 'select' && pointerStartPoint) {
    const minX = Math.min(pointerStartPoint.x, pt.x);
    const minY = Math.min(pointerStartPoint.y, pt.y);
    const w = Math.abs(pt.x - pointerStartPoint.x) + 1;
    const h = Math.abs(pt.y - pointerStartPoint.y) + 1;
    selectionManager.setSelection({ x: minX, y: minY, width: w, height: h });
    canvasEngine.setSelection(selectionManager.getSelection());
    renderAll();
    return;
  }

  // Xu ly di chuyen diem anh (Move tool)
  if (activeTool === 'move' && pointerStartPoint) {
    if (selectionManager.hasFloating()) {
      // Di chuyen vung chon noi: chi cap nhat vi tri hien thi, khong sua buffer va khong xoa nen!
      const dx = pt.x - pointerStartPoint.x;
      const dy = pt.y - pointerStartPoint.y;
      selectionManager.updateFloatingOffset(dx, dy);
      canvasEngine.setFloatingSelection(selectionManager.getFloating());
      canvasEngine.setSelection(selectionManager.getSelection());
      canvasEngine.render();
      return;
    } else if (lastMovePoint) {
      // Neu khong co vung chon thi di chuyen toan bo layer
      const dx = pt.x - lastMovePoint.x;
      const dy = pt.y - lastMovePoint.y;
      if (dx !== 0 || dy !== 0) {
        const buffer = canvasEngine.getActiveLayerBuffer();
        const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
        if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
          const allPixels = buffer.getAllPixels();
          for (const p of allPixels) {
            buffer.setPixel(p.x, p.y, null);
            delete currentLayer.pixels[coordToKey(p.x, p.y)];
          }
          for (const p of allPixels) {
            const nx = p.x + dx;
            const ny = p.y + dy;
            if (buffer.isValidCoord(nx, ny) && p.color) {
              buffer.setPixel(nx, ny, p.color);
              currentLayer.pixels[coordToKey(nx, ny)] = p.color;
            }
          }
          lastMovePoint = pt;
          renderAll();
        }
      }
      return;
    }
  }

  if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') {
    // Khong ve pixel truc tiep luc di chuyen hinh hoc
    return;
  }

  const isRightClick = e.buttons === 2;
  applyBrushAt(pt.x, pt.y, primaryColor, isRightClick);
  canvasEngine.render();
});

window.addEventListener('pointerup', (e) => {
  if (isPanning) {
    isPanning = false;
    mainCanvas.style.cursor = isSpacePressed ? 'grab' : 'crosshair';
  }

  if (!isPointerDown) return;
  isPointerDown = false;

  if (activeTool === 'select') {
    canvasEngine.setSelection(selectionManager.getSelection());
    renderAll();
    pointerStartPoint = null;
    return;
  }

  if (activeTool === 'move') {
    // Khi nha chuot, commit vung chon noi xuong layer tai vi tri moi
    if (selectionManager.hasFloating()) {
      const buffer = canvasEngine.getActiveLayerBuffer();
      const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
      if (buffer && currentLayer) {
        const changes = selectionManager.commitFloating(
          buffer,
          project.activeLayerId,
          project.activeFrameIndex,
          currentLayer.pixels
        );
        if (changes.length > 0) {
          history.pushStep(changes);
        }
        canvasEngine.setFloatingSelection(null);
        canvasEngine.setSelection(selectionManager.getSelection());
        renderAll();
      }
    }
    lastMovePoint = null;
    pointerStartPoint = null;
    renderAll();
    return;
  }

  const isRightClick = e.button === 2;
  const endPt = canvasEngine.screenToPixel(e.clientX, e.clientY);

  if (pointerStartPoint && endPt) {
    const color = isRightClick ? secondaryColor : primaryColor;
    let shapePoints: Point2D[] = [];

    if (activeTool === 'line') {
      shapePoints = drawLineBresenham(pointerStartPoint.x, pointerStartPoint.y, endPt.x, endPt.y);
    } else if (activeTool === 'rectangle') {
      shapePoints = drawRectBorders(pointerStartPoint.x, pointerStartPoint.y, endPt.x, endPt.y);
    } else if (activeTool === 'circle') {
      const radius = Math.round(
        Math.hypot(endPt.x - pointerStartPoint.x, endPt.y - pointerStartPoint.y)
      );
      shapePoints = drawCircleMidpoint(pointerStartPoint.x, pointerStartPoint.y, radius);
    }

    if (shapePoints.length > 0) {
      for (const p of shapePoints) {
        applyBrushAt(p.x, p.y, color, isRightClick);
      }
    }
  }

  if (currentStrokeChanges.length > 0) {
    history.pushStep(currentStrokeChanges);
    currentStrokeChanges = [];
  }

  pointerStartPoint = null;
  renderAll();
});

// Ham nhan vung chon sang Layer moi (Tuong tu Ctrl+J trong Photoshop)
function duplicateSelectionToNewLayer(): void {
  const currentFrame = canvasEngine.getCurrentFrame();
  if (!currentFrame) return;

  const currentLayer = currentFrame.layers.find(l => l.id === project.activeLayerId);
  if (!currentLayer) return;

  const buffer = canvasEngine.getActiveLayerBuffer();
  if (!buffer) return;

  const sel = selectionManager.getSelection();
  const floating = selectionManager.getFloating();

  const newLayerId = `layer_${Date.now()}`;
  let newLayerName = `${currentLayer.name} (Copy)`;
  const newPixels: Record<string, PixelColor> = {};

  if (floating) {
    // Dang co vung chon noi: chuyen thang vao layer moi
    newLayerName = `${currentLayer.name} (Selection)`;
    for (const p of floating.pixels) {
      const destX = floating.currentRect.x + p.relX;
      const destY = floating.currentRect.y + p.relY;
      if (p.color) {
        newPixels[coordToKey(destX, destY)] = p.color;
      }
    }
    selectionManager.cancelFloating();
    canvasEngine.setFloatingSelection(null);
  } else if (sel) {
    // Dang co vung chon: nhan cac pixel trong vung chon sang layer moi
    newLayerName = `${currentLayer.name} (Selection)`;
    for (let r = 0; r < sel.height; r++) {
      for (let c = 0; c < sel.width; c++) {
        const px = sel.x + c;
        const py = sel.y + r;
        const color = buffer.getPixel(px, py);
        if (color) {
          newPixels[coordToKey(px, py)] = color;
        }
      }
    }
  } else {
    // Khong co vung chon: nhan ban toan bo layer hien tai
    newLayerName = `${currentLayer.name} (Copy)`;
    Object.assign(newPixels, currentLayer.pixels);
  }

  // Tao Layer moi
  const newLayer = {
    id: newLayerId,
    name: newLayerName,
    visible: true,
    locked: false,
    opacity: 1.0,
    pixels: newPixels
  };

  // Chen ngay phia tren layer hien tai
  const curIdx = currentFrame.layers.findIndex(l => l.id === currentLayer.id);
  currentFrame.layers.splice(curIdx + 1, 0, newLayer);
  project.activeLayerId = newLayerId;

  // Bo vung chon sau khi tao layer moi
  selectionManager.clearSelection();
  canvasEngine.setSelection(null);
  canvasEngine.rebuildBuffers();
  renderAll();
  syncProjectToServer();
}

// Dong bo du an voi WebSocket Server
function syncProjectToServer(): void {
  try {
    fetch('http://127.0.0.1:3055/api/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'PROJECT_SYNC', project })
    }).catch(() => {});
  } catch (_) {}
}

// Ham gop Layer hien tai xuong Layer ben duoi (Merge Down - Phim tat Ctrl+E)
function mergeActiveLayerDown(): void {
  const currentFrame = canvasEngine.getCurrentFrame();
  if (!currentFrame || currentFrame.layers.length <= 1) return;

  const curIdx = currentFrame.layers.findIndex(l => l.id === project.activeLayerId);
  if (curIdx <= 0) {
    // Dang o layer duoi cung, khong the gop xuong duoi duoc
    return;
  }

  const activeLayer = currentFrame.layers[curIdx];
  const lowerLayer = currentFrame.layers[curIdx - 1];

  // Gop toan bo pixel cua activeLayer de len lowerLayer
  for (const [key, color] of Object.entries(activeLayer.pixels)) {
    if (color) {
      lowerLayer.pixels[key] = color;
    }
  }

  // Xoa activeLayer va chuyen active sang lowerLayer
  currentFrame.layers.splice(curIdx, 1);
  project.activeLayerId = lowerLayer.id;

  canvasEngine.rebuildBuffers();
  renderAll();
  syncProjectToServer();
}

// Lang nghe phim tat toan cuc va giu phim Spacebar de bat Hand/Pan tool
window.addEventListener('keydown', (e) => {
  const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
  if (isInput) return;

  // 1. Giu Space: Hand/Pan tool
  if (e.code === 'Space') {
    if (!isSpacePressed) {
      isSpacePressed = true;
      mainCanvas.style.cursor = 'grab';
    }
    e.preventDefault();
    return;
  }

  // 2. Phim tat Shift + 0: Can giua buc tranh vao trung tam
  if (e.shiftKey && (e.code === 'Digit0' || e.key === '0')) {
    e.preventDefault();
    canvasEngine.centerViewport();
    renderAll();
    return;
  }

  // 3. Phim tat Ctrl + Z (Undo) / Ctrl + Y (Redo)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (e.shiftKey) {
      document.getElementById('btn-redo')?.click();
    } else {
      document.getElementById('btn-undo')?.click();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    document.getElementById('btn-redo')?.click();
    return;
  }

  // 4. Phim tat Ctrl + C (Sao chep vung chon)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
    const buffer = canvasEngine.getActiveLayerBuffer();
    if (buffer) {
      const ok = selectionManager.copySelection(buffer);
      if (ok) {
        // Hieu ung thong bao nhe bang chuot
        console.log('Da sao chep pixel trong vung chon');
      }
    }
    return;
  }

  // 5. Phim tat Ctrl + V (Dan vung chon)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    const buffer = canvasEngine.getActiveLayerBuffer();
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
      const sel = selectionManager.getSelection();
      const targetX = sel ? sel.x : 0;
      const targetY = sel ? sel.y : 0;
      const changes = selectionManager.pasteSelection(
        buffer,
        targetX,
        targetY,
        project.activeLayerId,
        project.activeFrameIndex,
        currentLayer.pixels
      );
      if (changes.length > 0) {
        history.pushStep(changes);
        canvasEngine.setSelection(selectionManager.getSelection());
        renderAll();
      }
    }
    return;
  }

  // 6. Phim Delete / Backspace: Xoa pixel trong vung chon
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const buffer = canvasEngine.getActiveLayerBuffer();
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
      const changes = selectionManager.deleteSelection(
        buffer,
        project.activeLayerId,
        project.activeFrameIndex,
        currentLayer.pixels
      );
      if (changes.length > 0) {
        history.pushStep(changes);
        renderAll();
      }
    }
    return;
  }

  // 7. Phim Escape: Huy vung chon
  if (e.key === 'Escape') {
    if (selectionManager.hasFloating()) {
      const buffer = canvasEngine.getActiveLayerBuffer();
      const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
      if (buffer && currentLayer) {
        selectionManager.commitFloating(buffer, project.activeLayerId, project.activeFrameIndex, currentLayer.pixels);
      }
      canvasEngine.setFloatingSelection(null);
    }
    selectionManager.clearSelection();
    canvasEngine.setSelection(null);
    renderAll();
    return;
  }

  // 8. Phim tat Ctrl + J: Nhan vung chon sang Layer moi (nhu Photoshop)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
    e.preventDefault();
    duplicateSelectionToNewLayer();
    return;
  }

  // 9. Phim tat Ctrl + E: Gop Layer hien tai xuong Layer ben duoi (Merge Down)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
    e.preventDefault();
    mergeActiveLayerDown();
    return;
  }

  // 8. Chon nhanh cong cu ve qua ban phim
  const keyToTool: Record<string, ToolType> = {
    s: 'select',
    m: 'move',
    p: 'pencil',
    e: 'eraser',
    g: 'bucket',
    i: 'eyedropper',
    l: 'line',
    u: 'rectangle',
    c: 'circle',
    j: 'dither',
    d: 'lighten',
    k: 'darken'
  };

  const toolKey = e.key.toLowerCase();
  if (keyToTool[toolKey]) {
    activeTool = keyToTool[toolKey];
    toolbar?.querySelectorAll('.tool-btn').forEach(btn => {
      const b = btn as HTMLElement;
      b.classList.toggle('active', b.dataset.tool === activeTool);
    });
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    isSpacePressed = false;
    if (!isPanning) {
      mainCanvas.style.cursor = 'crosshair';
    }
  }
});

// Chặn menu chuột phải mặc định trên canvas
mainCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Cuộn chuột để thu phóng (Zoom bám theo tâm con trỏ chuột)
mainCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = mainCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const deltaZoom = e.deltaY < 0 ? 2 : -2;

  canvasEngine.zoomAt(mouseX, mouseY, deltaZoom);

  const zoomBadge = document.getElementById('canvas-zoom-badge');
  if (zoomBadge) {
    zoomBadge.innerText = `${canvasEngine.zoom * 100}%`;
  }
  renderAll();
}, { passive: false });

// Click vao badge zoom de can giua nhanh
const zoomBadge = document.getElementById('canvas-zoom-badge');
if (zoomBadge) {
  zoomBadge.style.cursor = 'pointer';
  zoomBadge.title = 'Click để căn giữa tranh (Shift + 0)';
  zoomBadge.addEventListener('click', () => {
    canvasEngine.centerViewport();
    renderAll();
  });
}

// 4. UI: Thanh cong cu ben trai (Toolbar)
const toolbar = document.getElementById('toolbar');
if (toolbar) {
  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tool-btn') as HTMLElement;
    if (!btn) return;

    toolbar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    activeTool = btn.dataset.tool as ToolType;
  });
}

// 5. UI: Bang mau (Color Palette)
const paletteGrid = document.getElementById('palette-grid');
const primaryInput = document.getElementById('primary-color') as HTMLInputElement;
const secondaryInput = document.getElementById('secondary-color') as HTMLInputElement;
const hexLabel = document.getElementById('color-hex-label');

function updateColorInputs(): void {
  if (primaryColor && primaryInput) {
    primaryInput.value = primaryColor;
  }
  if (secondaryColor && secondaryInput) {
    secondaryInput.value = secondaryColor;
  }
  if (hexLabel) {
    hexLabel.innerText = primaryColor || '#000000';
  }
}

if (primaryInput) {
  primaryInput.addEventListener('input', () => {
    primaryColor = primaryInput.value;
    updateColorInputs();
  });
}

if (secondaryInput) {
  secondaryInput.addEventListener('input', () => {
    secondaryColor = secondaryInput.value;
    updateColorInputs();
  });
}

function loadPalette(paletteId: string): void {
  if (!paletteGrid) return;
  paletteGrid.innerHTML = '';

  const preset = PRESET_PALETTES.find(p => p.id === paletteId) || PRESET_PALETTES[0];
  for (const col of preset.colors) {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.style.backgroundColor = col;
    item.title = col;

    item.addEventListener('click', (e) => {
      if (e.shiftKey) {
        secondaryColor = col;
      } else {
        primaryColor = col;
      }
      updateColorInputs();
    });

    paletteGrid.appendChild(item);
  }
}

const paletteSelect = document.getElementById('palette-select') as HTMLSelectElement;
if (paletteSelect) {
  paletteSelect.addEventListener('change', () => {
    loadPalette(paletteSelect.value);
  });
}

// Kich thuoc co (Brush Sizes)
const sizeGroup = document.getElementById('brush-size-group');
if (sizeGroup) {
  sizeGroup.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.size-btn') as HTMLElement;
    if (!btn) return;
    sizeGroup.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    brushSize = parseInt(btn.dataset.size || '1', 10);
  });
}

// Helper ham doi ten truc tiep tren giao dien (Inline Rename)
function startInlineRename(
  targetEl: HTMLElement,
  currentName: string,
  onSave: (newName: string) => void
): void {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'layer-rename-input';
  input.value = currentName;

  let isSaved = false;
  const finish = (save: boolean) => {
    if (isSaved) return;
    isSaved = true;
    const trimmed = input.value.trim();
    if (save && trimmed && trimmed !== currentName) {
      onSave(trimmed);
    } else {
      renderAll();
    }
  };

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });

  input.addEventListener('blur', () => {
    finish(true);
  });

  targetEl.replaceWith(input);
  input.focus();
  input.select();
}

// Tao phan tu DOM cho 1 Layer item
function createLayerItemElement(layer: LayerData, isInGroup = false): HTMLElement {
  const item = document.createElement('div');
  item.className = `layer-item ${layer.id === project.activeLayerId ? 'active' : ''} ${isInGroup ? 'in-group' : ''}`;
  item.dataset.layerId = layer.id;

  const currentFrame = canvasEngine.getCurrentFrame();
  const layerIndex = currentFrame?.layers.findIndex(l => l.id === layer.id) ?? -1;
  const hasLowerLayer = layerIndex > 0;
  const hasGroups = (project.groups && project.groups.length > 0);

  item.innerHTML = `
    <div class="layer-title-box">
      <span class="layer-name-text" title="Double click hoặc bấm nút sửa để đổi tên">${layer.name}</span>
      <button class="layer-btn-icon" data-act="rename-layer" title="Đổi tên layer">Edit</button>
    </div>
    <div class="layer-actions">
      ${hasLowerLayer ? `<button class="layer-btn-icon" data-act="merge-down" title="Gộp xuống layer dưới (Ctrl+E)">Merge</button>` : ''}
      ${layer.groupId ? `<button class="layer-btn-icon" data-act="leave-group" title="Rời khỏi nhóm">Out</button>` : (hasGroups ? `<button class="layer-btn-icon" data-act="join-group" title="Đưa vào nhóm">+Grp</button>` : '')}
      <button class="btn btn-small" data-act="toggle-vis" title="Ẩn/Hiện layer">${layer.visible ? 'Vis' : 'Hide'}</button>
      ${(currentFrame && currentFrame.layers.length > 1) ? `<button class="layer-btn-icon" data-act="delete-layer" title="Xóa layer">Del</button>` : ''}
    </div>
  `;

  // Xu ly su kien click tren layer
  item.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const act = target.closest('[data-act]')?.getAttribute('data-act');

    if (act === 'toggle-vis') {
      e.stopPropagation();
      layer.visible = !layer.visible;
      renderAll();
      syncProjectToServer();
      return;
    }

    if (act === 'rename-layer') {
      e.stopPropagation();
      const nameSpan = item.querySelector('.layer-name-text') as HTMLElement;
      if (nameSpan) {
        startInlineRename(nameSpan, layer.name, (newName) => {
          layer.name = newName;
          renderAll();
          syncProjectToServer();
        });
      }
      return;
    }

    if (act === 'merge-down') {
      e.stopPropagation();
      project.activeLayerId = layer.id;
      mergeActiveLayerDown();
      return;
    }

    if (act === 'leave-group') {
      e.stopPropagation();
      layer.groupId = null;
      renderAll();
      syncProjectToServer();
      return;
    }

    if (act === 'join-group') {
      e.stopPropagation();
      if (!project.groups || project.groups.length === 0) return;
      if (project.groups.length === 1) {
        layer.groupId = project.groups[0].id;
      } else {
        const names = project.groups.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
        const choice = prompt(`Chọn nhóm để đưa "${layer.name}" vào:\n${names}\n\nNhập số thứ tự nhóm:`, '1');
        if (choice) {
          const idx = parseInt(choice, 10) - 1;
          if (idx >= 0 && idx < project.groups.length) {
            layer.groupId = project.groups[idx].id;
          }
        }
      }
      renderAll();
      syncProjectToServer();
      return;
    }

    if (act === 'delete-layer') {
      e.stopPropagation();
      if (!currentFrame || currentFrame.layers.length <= 1) return;
      if (!confirm(`Bạn có chắc muốn xóa "${layer.name}" không?`)) return;
      const idx = currentFrame.layers.findIndex(l => l.id === layer.id);
      if (idx !== -1) {
        currentFrame.layers.splice(idx, 1);
        if (project.activeLayerId === layer.id) {
          project.activeLayerId = currentFrame.layers[Math.max(0, idx - 1)].id;
        }
        canvasEngine.rebuildBuffers();
        renderAll();
        syncProjectToServer();
      }
      return;
    }

    // Chon lam active layer
    project.activeLayerId = layer.id;
    renderAll();
  });

  // Double click de doi ten
  item.querySelector('.layer-name-text')?.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const nameSpan = e.currentTarget as HTMLElement;
    startInlineRename(nameSpan, layer.name, (newName) => {
      layer.name = newName;
      renderAll();
      syncProjectToServer();
    });
  });

  return item;
}

// Tao phan tu DOM cho 1 Layer Group container
function createGroupContainerElement(group: LayerGroup, groupLayers: LayerData[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'layer-group-container';
  container.dataset.groupId = group.id;

  const isCollapsed = !!group.collapsed;
  const isVisible = group.visible !== false;

  const header = document.createElement('div');
  header.className = 'layer-group-header';
  header.innerHTML = `
    <div class="layer-group-title" title="Bấm để đóng/mở nhóm, double-click để đổi tên">
      <span class="layer-group-toggle">${isCollapsed ? '>' : 'v'}</span>
      <span class="layer-name-text">${group.name}</span>
      <button class="layer-btn-icon" data-act="rename-group" title="Đổi tên nhóm">Edit</button>
      <span style="font-size: 10px; color: #a78bfa; margin-left: 2px;">(${groupLayers.length})</span>
    </div>
    <div class="layer-group-actions">
      <button class="layer-btn-icon" data-act="add-to-group" title="Thêm Layer vào nhóm này">+L</button>
      <button class="btn btn-small" data-act="toggle-group-vis" title="Ẩn/Hiện cả nhóm">${isVisible ? 'Vis' : 'Hide'}</button>
      <button class="layer-btn-icon" data-act="ungroup" title="Rã nhóm (giải phóng các layer)">Out</button>
      <button class="layer-btn-icon" data-act="delete-group" title="Xóa nhóm">Del</button>
    </div>
  `;

  // Header click events
  header.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const act = target.closest('[data-act]')?.getAttribute('data-act');

    if (act === 'toggle-group-vis') {
      e.stopPropagation();
      group.visible = !isVisible;
      renderAll();
      syncProjectToServer();
      return;
    }

    if (act === 'rename-group') {
      e.stopPropagation();
      const nameSpan = header.querySelector('.layer-name-text') as HTMLElement;
      if (nameSpan) {
        startInlineRename(nameSpan, group.name, (newName) => {
          group.name = newName;
          renderAll();
          syncProjectToServer();
        });
      }
      return;
    }

    if (act === 'add-to-group') {
      e.stopPropagation();
      const currentFrame = canvasEngine.getCurrentFrame();
      if (!currentFrame) return;

      const newId = `layer_${Date.now()}`;
      const newLayer: LayerData = {
        id: newId,
        name: `Layer ${currentFrame.layers.length + 1}`,
        visible: true,
        locked: false,
        opacity: 1.0,
        pixels: {},
        groupId: group.id
      };
      currentFrame.layers.push(newLayer);
      project.activeLayerId = newId;
      group.collapsed = false;
      canvasEngine.rebuildBuffers();
      renderAll();
      syncProjectToServer();
      return;
    }

    if (act === 'ungroup') {
      e.stopPropagation();
      groupLayers.forEach(l => { l.groupId = null; });
      project.groups = (project.groups || []).filter(g => g.id !== group.id);
      renderAll();
      syncProjectToServer();
      return;
    }

    if (act === 'delete-group') {
      e.stopPropagation();
      const currentFrame = canvasEngine.getCurrentFrame();
      if (!confirm(`Bạn có chắc muốn xóa nhóm "${group.name}" và toàn bộ ${groupLayers.length} layer bên trong không?`)) return;
      if (currentFrame) {
        const remainingCount = currentFrame.layers.filter(l => l.groupId !== group.id).length;
        if (remainingCount === 0) {
          alert('Không thể xóa toàn bộ layer của bức tranh. Hãy tạo một layer khác trước.');
          return;
        }
        currentFrame.layers = currentFrame.layers.filter(l => l.groupId !== group.id);
        if (!currentFrame.layers.some(l => l.id === project.activeLayerId)) {
          project.activeLayerId = currentFrame.layers[0].id;
        }
      }
      project.groups = (project.groups || []).filter(g => g.id !== group.id);
      canvasEngine.rebuildBuffers();
      renderAll();
      syncProjectToServer();
      return;
    }

    // Toggle dong/mo nhom
    group.collapsed = !group.collapsed;
    renderAll();
  });

  // Double click doi ten group
  header.querySelector('.layer-name-text')?.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const nameSpan = e.currentTarget as HTMLElement;
    startInlineRename(nameSpan, group.name, (newName) => {
      group.name = newName;
      renderAll();
      syncProjectToServer();
    });
  });

  container.appendChild(header);

  // Danh sach cac layer con
  const childrenContainer = document.createElement('div');
  childrenContainer.className = `layer-group-children ${isCollapsed ? 'collapsed' : ''}`;

  if (groupLayers.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'font-size: 11px; color: var(--text-muted); padding: 4px 6px; font-style: italic;';
    emptyMsg.innerText = 'Nhóm trống (+L để thêm layer)';
    childrenContainer.appendChild(emptyMsg);
  } else {
    groupLayers.forEach(layer => {
      const layerEl = createLayerItemElement(layer, true);
      childrenContainer.appendChild(layerEl);
    });
  }

  container.appendChild(childrenContainer);
  return container;
}

// 6. UI: Quan ly Layer & Group
function renderLayers(): void {
  const container = document.getElementById('layers-list');
  if (!container) return;
  container.innerHTML = '';

  project.groups = project.groups || [];
  const currentFrame = canvasEngine.getCurrentFrame();
  if (!currentFrame) return;

  const renderedGroupIds = new Set<string>();

  // Duyet tu tren xuong duoi (index giam dan)
  for (let i = currentFrame.layers.length - 1; i >= 0; i--) {
    const layer = currentFrame.layers[i];

    if (layer.groupId) {
      const group = project.groups.find(g => g.id === layer.groupId);
      if (group) {
        if (!renderedGroupIds.has(group.id)) {
          renderedGroupIds.add(group.id);
          const groupLayers = currentFrame.layers
            .filter(l => l.groupId === group.id)
            .reverse();
          const groupEl = createGroupContainerElement(group, groupLayers);
          container.appendChild(groupEl);
        }
        continue;
      } else {
        layer.groupId = null;
      }
    }

    // Layer doc lap khong thuoc group
    const item = createLayerItemElement(layer, false);
    container.appendChild(item);
  }

  // Render cac nhom rong (chua co layer con)
  for (const group of project.groups) {
    if (!renderedGroupIds.has(group.id)) {
      const groupEl = createGroupContainerElement(group, []);
      container.appendChild(groupEl);
    }
  }
}

// Nut them Group moi
document.getElementById('btn-add-group')?.addEventListener('click', () => {
  project.groups = project.groups || [];
  const newGroupId = `group_${Date.now()}`;
  const newGroup: LayerGroup = {
    id: newGroupId,
    name: `Group ${project.groups.length + 1}`,
    collapsed: false,
    visible: true,
    locked: false
  };
  project.groups.push(newGroup);

  // Tu dong dua layer dang active vao group moi neu chua thuoc group nao
  const currentFrame = canvasEngine.getCurrentFrame();
  const activeLayer = currentFrame?.layers.find(l => l.id === project.activeLayerId);
  if (activeLayer && !activeLayer.groupId) {
    activeLayer.groupId = newGroupId;
  }

  renderAll();
  syncProjectToServer();
});

// Nut them Layer moi
document.getElementById('btn-add-layer')?.addEventListener('click', () => {
  const currentFrame = canvasEngine.getCurrentFrame();
  if (!currentFrame) return;

  const newId = `layer_${Date.now()}`;
  const newLayer: LayerData = {
    id: newId,
    name: `Layer ${currentFrame.layers.length + 1}`,
    visible: true,
    locked: false,
    opacity: 1.0,
    pixels: {},
    groupId: null
  };

  currentFrame.layers.push(newLayer);
  project.activeLayerId = newId;
  canvasEngine.rebuildBuffers();
  renderAll();
  syncProjectToServer();
});

// 7. UI: Dòng thời gian Timeline & Animation
function renderTimeline(): void {
  const container = document.getElementById('timeline-frames-container');
  if (!container) return;
  container.innerHTML = '';

  project.frames.forEach((frame, idx) => {
    const card = document.createElement('div');
    card.className = `frame-card ${idx === project.activeFrameIndex ? 'active' : ''}`;
    card.innerHTML = `
      <span class="frame-num">#${idx + 1}</span>
      <span class="frame-ms">${frame.durationMs}ms</span>
      ${project.frames.length > 1 ? '<button class="frame-del-btn" title="Xóa frame này">&times;</button>' : ''}
    `;

    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('frame-del-btn')) {
        e.stopPropagation();
        animController.deleteFrame(idx);
        canvasEngine.rebuildBuffers();
        renderAll();
        return;
      }
      project.activeFrameIndex = idx;
      canvasEngine.rebuildBuffers();
      renderAll();
    });

    container.appendChild(card);
  });
}

// Nut them frame moi vao clip dang hoat dong
document.getElementById('btn-add-frame')?.addEventListener('click', () => {
  animController.addFrameToActiveClip(true);
  canvasEngine.rebuildBuffers();
  renderAll();
});

// Nut nhan ban frame dang chon
document.getElementById('btn-duplicate-frame')?.addEventListener('click', () => {
  animController.duplicateActiveFrame();
  canvasEngine.rebuildBuffers();
  renderAll();
});

// Play / Pause Animation
const btnPlayPause = document.getElementById('btn-play-pause');
const btnTogglePlay = document.getElementById('btn-toggle-play');

function updatePlayUi(isPlaying: boolean): void {
  const label = isPlaying ? 'Pause' : 'Play';
  const iconSvg = isPlaying
    ? '<svg class="btn-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
    : '<svg class="btn-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

  if (btnPlayPause) {
    btnPlayPause.innerHTML = `${iconSvg} <span>${label}</span>`;
  }
  if (btnTogglePlay) {
    btnTogglePlay.innerHTML = `${iconSvg} <span>${label}</span>`;
  }
}

function togglePlayback(): void {
  const isPlaying = previewPlayer.toggle();
  updatePlayUi(isPlaying);
}

// Khi previewPlayer chuyen frame, dong bo ca Canvas chinh va danh dau timeline
previewPlayer.onFrameChange = (frameIndex: number) => {
  project.activeFrameIndex = frameIndex;
  // Highlight the card tren timeline
  const cards = document.querySelectorAll('.frame-card');
  cards.forEach((c, i) => {
    c.classList.toggle('active', i === frameIndex);
  });
  canvasEngine.rebuildBuffers();
  renderAll();
};

btnPlayPause?.addEventListener('click', togglePlayback);
btnTogglePlay?.addEventListener('click', togglePlayback);

// Onion Skin Toggle
const btnOnion = document.getElementById('btn-onion-skin');
btnOnion?.addEventListener('click', () => {
  onionSkinEnabled = !onionSkinEnabled;
  if (btnOnion) {
    btnOnion.innerText = onionSkinEnabled ? 'Onion: On' : 'Onion: Off';
  }
  renderAll();
});

// FPS Slider
const fpsSlider = document.getElementById('fps-slider') as HTMLInputElement;
const fpsLabel = document.getElementById('fps-label');
fpsSlider?.addEventListener('input', () => {
  const fps = parseInt(fpsSlider.value, 10);
  if (fpsLabel) fpsLabel.innerText = `${fps}`;
  const clip = animController.getActiveClip();
  if (clip) clip.fps = fps;
});

// Top bar controls: Undo / Redo / Grid / Pivot / Symmetry
document.getElementById('btn-undo')?.addEventListener('click', () => {
  history.undo((changes) => {
    const buffer = canvasEngine.getActiveLayerBuffer();
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (buffer && currentLayer) {
      for (const ch of changes) {
        buffer.setPixel(ch.x, ch.y, ch.oldColor);
        if (ch.oldColor) {
          currentLayer.pixels[coordToKey(ch.x, ch.y)] = ch.oldColor;
        } else {
          delete currentLayer.pixels[coordToKey(ch.x, ch.y)];
        }
      }
    }
  });
  renderAll();
});

document.getElementById('btn-redo')?.addEventListener('click', () => {
  history.redo((changes) => {
    const buffer = canvasEngine.getActiveLayerBuffer();
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (buffer && currentLayer) {
      for (const ch of changes) {
        buffer.setPixel(ch.x, ch.y, ch.newColor);
        if (ch.newColor) {
          currentLayer.pixels[coordToKey(ch.x, ch.y)] = ch.newColor;
        } else {
          delete currentLayer.pixels[coordToKey(ch.x, ch.y)];
        }
      }
    }
  });
  renderAll();
});

document.getElementById('btn-toggle-grid')?.addEventListener('click', () => {
  canvasEngine.showGrid = !canvasEngine.showGrid;
  renderAll();
});

document.getElementById('btn-toggle-pivot')?.addEventListener('click', () => {
  canvasEngine.showPivot = !canvasEngine.showPivot;
  renderAll();
});

const btnSym = document.getElementById('btn-toggle-symmetry');
btnSym?.addEventListener('click', () => {
  symmetryX = !symmetryX;
  if (btnSym) {
    btnSym.innerText = symmetryX ? 'Sym X: On' : 'Sym X: Off';
  }
});

// Transformations: Flip Horizontal, Flip Vertical, Rotate 90
document.getElementById('btn-flip-h')?.addEventListener('click', () => {
  const buffer = canvasEngine.getActiveLayerBuffer();
  const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
  if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
    const changes = flipHorizontal(
      buffer,
      project.width,
      project.height,
      project.activeLayerId,
      project.activeFrameIndex,
      currentLayer.pixels,
      selectionManager.getSelection()
    );
    if (changes.length > 0) {
      history.pushStep(changes);
      renderAll();
    }
  }
});

document.getElementById('btn-flip-v')?.addEventListener('click', () => {
  const buffer = canvasEngine.getActiveLayerBuffer();
  const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
  if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
    const changes = flipVertical(
      buffer,
      project.width,
      project.height,
      project.activeLayerId,
      project.activeFrameIndex,
      currentLayer.pixels,
      selectionManager.getSelection()
    );
    if (changes.length > 0) {
      history.pushStep(changes);
      renderAll();
    }
  }
});

document.getElementById('btn-rotate-90')?.addEventListener('click', () => {
  const buffer = canvasEngine.getActiveLayerBuffer();
  const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
  if (buffer && currentLayer && !currentLayer.locked && currentLayer.visible) {
    const changes = rotate90Clockwise(
      buffer,
      project.width,
      project.height,
      project.activeLayerId,
      project.activeFrameIndex,
      currentLayer.pixels,
      selectionManager.getSelection()
    );
    if (changes.length > 0) {
      history.pushStep(changes);
      renderAll();
    }
  }
});

// 8. WebSocket Client ket noi voi Local Server (MCP Bridge)
function initWebSocketBridge(): void {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  try {
    const socket = new WebSocket('ws://127.0.0.1:3055');

    socket.onopen = () => {
      if (statusDot) statusDot.classList.add('connected');
      if (statusText) statusText.innerText = 'Bridge: Online';

      // Gui trang thai hien tai len server
      socket.send(JSON.stringify({
        type: 'PROJECT_SYNC',
        project
      }));
    };

    socket.onmessage = (event) => {
      try {
        const payload: any = JSON.parse(event.data);

        // Xu ly cap nhat tien trinh sinh anh AI thoi gian thuc
        if (payload.type === 'AI_PROGRESS') {
          handleAiProgressEvent(payload);
          return;
        }

        // Xu ly dong bo toan bo Project tu Server (vi du khi nap anh moi hoac doi kich thuoc 64x64)
        if (payload.type === 'PROJECT_SYNC' && payload.project) {
          const newProj = payload.project;
          project.id = newProj.id;
          project.name = newProj.name;
          project.width = newProj.width;
          project.height = newProj.height;
          project.frames = newProj.frames;
          project.clips = newProj.clips;
          project.activeFrameIndex = newProj.activeFrameIndex || 0;
          project.activeLayerId = newProj.activeLayerId || newProj.frames[0]?.layers[0]?.id || 'layer_1';

          canvasEngine.rebuildBuffers();
          onionSkinRenderer.resize(project.width, project.height);

          const sizeBadge = document.getElementById('canvas-size-badge');
          if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
          const resLabel = document.getElementById('canvas-resolution');
          if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

          renderAll();
          return;
        }

        if (payload.type === 'DRAW_PIXELS' && payload.pixels) {
          const buffer = canvasEngine.getActiveLayerBuffer();
          const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
          if (buffer && currentLayer) {
            for (const p of payload.pixels) {
              buffer.setPixel(p.x, p.y, p.color);
              if (p.color) {
                currentLayer.pixels[coordToKey(p.x, p.y)] = p.color;
              } else {
                delete currentLayer.pixels[coordToKey(p.x, p.y)];
              }
            }
            renderAll();
          }
        } else if (payload.type === 'DRAW_MATRIX' && payload.matrix && payload.paletteMap) {
          const buffer = canvasEngine.getActiveLayerBuffer();
          const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
          if (buffer && currentLayer) {
            buffer.fromMatrix(payload.matrix, payload.paletteMap, payload.offsetX || 0, payload.offsetY || 0);
            // Dong bo lai sang layer data
            currentLayer.pixels = buffer.toRecord();
            renderAll();
          }
        } else if (payload.type === 'ADD_FRAME') {
          animController.addClip(payload.clipName || 'idle', 1);
          project.activeFrameIndex = project.frames.length - 1;
          canvasEngine.rebuildBuffers();
          renderAll();
        }
      } catch (err) {
        console.error('Loi xu ly WebSocket payload:', err);
      }
    };

    socket.onclose = () => {
      if (statusDot) statusDot.classList.remove('connected');
      if (statusText) statusText.innerText = 'Bridge: Offline';
      // Thu ket noi lai sau 3 giay
      setTimeout(initWebSocketBridge, 3000);
    };

    socket.onerror = () => {
      socket.close();
    };
  } catch (err) {
    setTimeout(initWebSocketBridge, 3000);
  }
}

// Helper format thoi gian giay -> MM:SS
function formatTimeSec(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Xu ly su kien cap nhat tien trinh AI thoi gian thuc tu WebSocket
function handleAiProgressEvent(payload: any): void {
  const statusMsg = document.getElementById('ai-status-msg');
  const statusText = document.getElementById('ai-status-text');
  const stepsBadge = document.getElementById('ai-steps-badge');
  const barFill = document.getElementById('ai-progress-bar-fill');
  const timeElapsed = document.getElementById('ai-time-elapsed');
  const percentText = document.getElementById('ai-percent-text');
  const timeEta = document.getElementById('ai-time-eta');

  if (statusMsg) statusMsg.style.display = 'block';

  if (payload.message && statusText) {
    statusText.innerText = payload.message;
  }

  // Cap nhat so buoc steps
  if (payload.totalSteps !== undefined && stepsBadge) {
    const cur = payload.step || 0;
    const tot = payload.totalSteps;
    stepsBadge.innerText = `${cur} / ${tot} steps`;
  }

  // Cap nhat thanh tien trinh & phan tram
  if (payload.percent !== undefined) {
    const pct = Math.max(0, Math.min(100, Math.round(payload.percent)));
    if (barFill) barFill.style.width = `${pct}%`;
    if (percentText) percentText.innerText = `${pct}%`;
  }

  // Cap nhat thoi gian da chay
  if (payload.elapsed !== undefined && timeElapsed) {
    timeElapsed.innerText = `Đã chạy: ${formatTimeSec(payload.elapsed)}`;
  }

  // Cap nhat uoc tinh thoi gian con lai (ETA)
  if (payload.eta !== undefined && timeEta) {
    if (payload.eta <= 0 || (payload.percent && payload.percent >= 100)) {
      timeEta.innerText = 'Sắp xong...';
    } else {
      timeEta.innerText = `Còn lại: ~${formatTimeSec(payload.eta)}`;
    }
  }
}

// 9. Khoi tao Modal va ket noi AI LoRA Stardew Valley & Pixel Presets
function initAiPortraitModal(): void {
  const modal = document.getElementById('ai-modal');
  const btnOpen = document.getElementById('btn-ai-portrait');
  const btnClose = document.getElementById('btn-close-ai-modal');
  const promptInput = document.getElementById('ai-prompt-input') as HTMLTextAreaElement;
  const statusMsg = document.getElementById('ai-status-msg');
  const statusText = document.getElementById('ai-status-text');
  const btnLoad = document.getElementById('btn-load-existing-ai');
  const btnGenerate = document.getElementById('btn-run-ai-generate');

  // Advanced inputs
  const btnToggleAdv = document.getElementById('btn-toggle-ai-advanced');
  const advPanel = document.getElementById('ai-advanced-panel');
  const advArrow = document.getElementById('ai-advanced-arrow');
  const checkpointSelect = document.getElementById('ai-checkpoint-select') as HTMLSelectElement | null;
  const loraSelect = document.getElementById('ai-lora-select') as HTMLSelectElement | null;
  const loraScaleInput = document.getElementById('ai-lora-scale') as HTMLInputElement | null;
  const loraScaleVal = document.getElementById('ai-lora-scale-val');
  const stepsInput = document.getElementById('ai-steps-slider') as HTMLInputElement | null;
  const stepsVal = document.getElementById('ai-steps-val');
  const sizeSelect = document.getElementById('ai-size-select') as HTMLSelectElement | null;
  const modeSelect = document.getElementById('ai-mode-select') as HTMLSelectElement | null;
  const removeBgCheckbox = document.getElementById('ai-remove-bg-checkbox') as HTMLInputElement | null;

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  btnClose?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Toggle Advanced Settings
  let isAdvOpen = false;
  btnToggleAdv?.addEventListener('click', () => {
    isAdvOpen = !isAdvOpen;
    if (advPanel) advPanel.style.display = isAdvOpen ? 'flex' : 'none';
    if (advArrow) advArrow.innerText = isAdvOpen ? '▲' : '▼';
  });

  // Cap nhat nhan hien thi cua thanh truot
  loraScaleInput?.addEventListener('input', () => {
    if (loraScaleVal) loraScaleVal.innerText = parseFloat(loraScaleInput.value).toFixed(2);
  });
  stepsInput?.addEventListener('input', () => {
    if (stepsVal) stepsVal.innerText = stepsInput.value;
  });

  // 1-Click Style Presets
  const presetCards = document.querySelectorAll('.preset-card');
  presetCards.forEach(card => {
    card.addEventListener('click', () => {
      presetCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const preset = card.getAttribute('data-preset');
      if (preset === 'stardew') {
        if (promptInput) promptInput.value = 'pixel art, stardew portrait, 1boy, brown hair, white shirt, smiling, looking at viewer, simple white background';
        if (loraSelect) loraSelect.value = 'models/lora/th_stardew_portrait_lora.safetensors';
        if (loraScaleInput) { loraScaleInput.value = '0.6'; if (loraScaleVal) loraScaleVal.innerText = '0.60'; }
        if (stepsInput) { stepsInput.value = '16'; if (stepsVal) stepsVal.innerText = '16'; }
        if (sizeSelect) sizeSelect.value = '64';
      } else if (preset === 'rpg') {
        if (promptInput) promptInput.value = 'pixel art, 16-bit rpg hero, warrior knight, golden armor, sword in hand, full body, simple background';
        if (loraSelect) loraSelect.value = 'models/lora/pixel_f2.safetensors';
        if (loraScaleInput) { loraScaleInput.value = '0.7'; if (loraScaleVal) loraScaleVal.innerText = '0.70'; }
        if (stepsInput) { stepsInput.value = '16'; if (stepsVal) stepsVal.innerText = '16'; }
        if (sizeSelect) sizeSelect.value = '64';
      } else if (preset === 'scenery') {
        if (promptInput) promptInput.value = 'pixel art, magical fantasy treehouse, floating island, lush green, retro game asset, vibrant colors';
        if (loraSelect) loraSelect.value = 'models/lora/pixel_f2.safetensors';
        if (loraScaleInput) { loraScaleInput.value = '0.65'; if (loraScaleVal) loraScaleVal.innerText = '0.65'; }
        if (stepsInput) { stepsInput.value = '18'; if (stepsVal) stepsVal.innerText = '18'; }
        if (sizeSelect) sizeSelect.value = '128';
      }
    });
  });

  // Gan su kien cho cac tag mau
  const tagButtons = document.querySelectorAll('.preset-tags .tag-btn');
  tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      if (tag && promptInput) {
        promptInput.value = tag;
      }
    });
  });

  // Nap anh hien co tu server
  btnLoad?.addEventListener('click', async () => {
    try {
      if (statusMsg && statusText) {
        statusMsg.style.display = 'block';
        statusText.innerText = 'Đang nạp ảnh gần nhất vào Canvas...';
      }
      const res = await fetch('http://127.0.0.1:3055/api/ai/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: 'th_stardew_test_pixel_64x64.png' })
      });
      const data = await res.json();
      if (data.success) {
        modal.style.display = 'none';
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể nạp ảnh'));
      }
    } catch (err: any) {
      alert('Không thể kết nối tới Server: ' + err.message);
    } finally {
      if (statusMsg) statusMsg.style.display = 'none';
    }
  });

  // Sinh anh moi bang mo hinh SD1.5 Checkpoint & LoRA
  btnGenerate?.addEventListener('click', async () => {
    const prompt = promptInput?.value.trim();
    if (!prompt) {
      alert('Vui lòng nhập mô tả nhân vật hoặc khung cảnh');
      return;
    }

    const checkpoint = checkpointSelect ? checkpointSelect.value : 'models/checkpoints/AOM3A1B_orangemixs.safetensors';
    const loraPath = loraSelect ? loraSelect.value : 'models/lora/th_stardew_portrait_lora.safetensors';
    const loraScale = loraScaleInput ? parseFloat(loraScaleInput.value) : 0.6;
    const steps = stepsInput ? parseInt(stepsInput.value, 10) : 16;
    const size = sizeSelect ? parseInt(sizeSelect.value, 10) : 64;
    const mode = modeSelect ? modeSelect.value : 'replace_canvas';
    const removeBg = removeBgCheckbox ? removeBgCheckbox.checked : false;

    // Khoi tao cac phan tu DOM cua hop tien do
    const barFill = document.getElementById('ai-progress-bar-fill');
    const stepsBadge = document.getElementById('ai-steps-badge');
    const timeElapsed = document.getElementById('ai-time-elapsed');
    const percentText = document.getElementById('ai-percent-text');
    const timeEta = document.getElementById('ai-time-eta');

    if (statusMsg) statusMsg.style.display = 'block';
    if (statusText) statusText.innerText = 'Đang khởi động tiến trình AI...';
    if (barFill) barFill.style.width = '0%';
    if (percentText) percentText.innerText = '0%';
    if (stepsBadge) stepsBadge.innerText = `0 / ${steps} steps`;
    if (timeElapsed) timeElapsed.innerText = 'Đã chạy: 00:00';
    if (timeEta) timeEta.innerText = 'Còn lại: Đang tính...';
    if (btnGenerate) (btnGenerate as HTMLButtonElement).disabled = true;

    const startTime = Date.now();
    const localTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      if (timeElapsed) timeElapsed.innerText = `Đã chạy: ${formatTimeSec(sec)}`;
    }, 1000);

    try {
      const res = await fetch('http://127.0.0.1:3055/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          checkpoint,
          loraPath,
          loraScale,
          steps,
          size,
          mode,
          removeBg
        })
      });

      const data = await res.json();
      if (data.success) {
        if (barFill) barFill.style.width = '100%';
        if (percentText) percentText.innerText = '100%';
        if (statusText) statusText.innerText = 'Hoàn tất! Đã nạp vào Canvas.';
        if (timeEta) timeEta.innerText = 'Hoàn tất';
        setTimeout(() => {
          modal.style.display = 'none';
        }, 600);
      } else {
        alert('Lỗi sinh ảnh: ' + (data.error || 'Thao tác thất bại'));
      }
    } catch (err: any) {
      alert('Lỗi kết nối máy chủ AI: ' + err.message);
    } finally {
      clearInterval(localTimer);
      if (btnGenerate) (btnGenerate as HTMLButtonElement).disabled = false;
    }
  });
}

// 10. Khoi tao Modal va ket noi Kho Luu Tru Anh (Gallery)
function initGalleryModal(): void {
  const modal = document.getElementById('gallery-modal');
  const btnOpen = document.getElementById('btn-open-gallery');
  const btnClose = document.getElementById('btn-close-gallery-modal');
  const btnCloseFooter = document.getElementById('btn-close-gallery-footer');
  const btnRefresh = document.getElementById('btn-refresh-gallery');
  const btnSave = document.getElementById('btn-save-gallery');
  const gridContainer = document.getElementById('gallery-grid-container');
  const badgeCount = document.getElementById('gallery-count-badge');

  if (!modal) return;

  // Tai va render danh sach anh trong kho
  const loadGallery = async () => {
    if (!gridContainer) return;
    gridContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 20px;">Đang tải danh sách tác phẩm...</div>';

    try {
      const res = await fetch('http://127.0.0.1:3055/api/gallery');
      const data = await res.json();
      if (!data.success || !Array.isArray(data.items)) {
        gridContainer.innerHTML = '<div style="color: #ef4444; font-size: 12px;">Không thể tải dữ liệu kho ảnh.</div>';
        return;
      }

      if (badgeCount) {
        badgeCount.innerText = `${data.items.length} ảnh`;
      }

      if (data.items.length === 0) {
        gridContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 20px;">Kho ảnh hiện đang trống. Hãy tạo ảnh bằng AI hoặc bấm nút Lưu Kho để lưu tác phẩm!</div>';
        return;
      }

      gridContainer.innerHTML = '';
      data.items.forEach((item: any) => {
        const card = document.createElement('div');
        card.className = 'gallery-card';

        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        }) : '';

        const badgeClass = item.sourceType === 'ai' ? 'badge-ai' : 'badge-custom';
        const badgeText = item.sourceType === 'ai' ? 'AI LoRA' : 'Vẽ tay';

        card.innerHTML = `
          <div class="gallery-thumb-container">
            <span class="gallery-card-badge ${badgeClass}">${badgeText}</span>
            <img class="gallery-thumb-img" src="${item.thumbnailBase64 || ''}" alt="${item.name}" />
          </div>
          <div class="gallery-card-info">
            <div class="gallery-card-title" title="${item.name}">${item.name}</div>
            <div class="gallery-card-meta">${item.width}x${item.height} px • ${dateStr}</div>
            <div class="gallery-card-actions">
              <button class="btn btn-primary btn-load-item" title="Nạp vào Canvas để chỉnh sửa">Mở</button>
              <button class="btn btn-download-item" title="Tải ảnh PNG">Tải</button>
              <button class="btn btn-danger btn-del-item" title="Xóa bức ảnh này">Xóa</button>
            </div>
          </div>
        `;

        // Nut Mo vao Canvas
        card.querySelector('.btn-load-item')?.addEventListener('click', async () => {
          try {
            const loadRes = await fetch('http://127.0.0.1:3055/api/gallery/load', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: item.filename })
            });
            const loadData = await loadRes.json();
            if (loadData.success) {
              modal.style.display = 'none';
            } else {
              alert('Lỗi nạp ảnh: ' + (loadData.error || 'Thất bại'));
            }
          } catch (err: any) {
            alert('Không thể kết nối máy chủ: ' + err.message);
          }
        });

        // Nut Tai PNG
        card.querySelector('.btn-download-item')?.addEventListener('click', () => {
          if (!item.thumbnailBase64) return;
          const a = document.createElement('a');
          a.href = item.thumbnailBase64;
          a.download = item.filename;
          a.click();
        });

        // Nut Xoa
        card.querySelector('.btn-del-item')?.addEventListener('click', async () => {
          if (!confirm(`Bạn có chắc muốn xóa "${item.name}" khỏi kho không?`)) return;
          try {
            const delRes = await fetch('http://127.0.0.1:3055/api/gallery/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: item.id })
            });
            const delData = await delRes.json();
            if (delData.success) {
              loadGallery();
            } else {
              alert('Không thể xóa: ' + (delData.error || 'Lỗi'));
            }
          } catch (err: any) {
            alert('Lỗi: ' + err.message);
          }
        });

        gridContainer.appendChild(card);
      });
    } catch (err: any) {
      gridContainer.innerHTML = `<div style="color: #ef4444; font-size: 12px; padding: 20px;">Lỗi tải kho ảnh: ${err.message}</div>`;
    }
  };

  btnOpen?.addEventListener('click', () => {
    modal.style.display = 'flex';
    loadGallery();
  });

  btnClose?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  btnCloseFooter?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  btnRefresh?.addEventListener('click', loadGallery);

  // Nut Luu Kho (Save to Gallery)
  btnSave?.addEventListener('click', async () => {
    const artName = prompt('Nhập tên cho tác phẩm cần lưu vào kho:', project.name || 'Tác phẩm mới');
    if (artName === null) return;

    try {
      const res = await fetch('http://127.0.0.1:3055/api/gallery/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: artName || 'Chưa đặt tên' })
      });
      const data = await res.json();
      if (data.success) {
        alert('Đã lưu tác phẩm thành công vào Kho Ảnh!');
      } else {
        alert('Lỗi lưu tác phẩm: ' + (data.error || 'Thất bại'));
      }
    } catch (err: any) {
      alert('Không thể kết nối máy chủ để lưu: ' + err.message);
    }
  });
}

// 11. Modal Thay Doi Kich Thuoc Canvas (Canvas Resize)
function initResizeModal(): void {
  const modal = document.getElementById('resize-modal');
  const btnOpen = document.getElementById('canvas-size-badge');
  const btnClose = document.getElementById('btn-close-resize-modal');
  const btnCancel = document.getElementById('btn-cancel-resize');
  const btnApply = document.getElementById('btn-apply-resize');
  const widthInput = document.getElementById('resize-width-input') as HTMLInputElement | null;
  const heightInput = document.getElementById('resize-height-input') as HTMLInputElement | null;
  const anchorSelect = document.getElementById('resize-anchor-select') as HTMLSelectElement | null;

  if (!modal) return;

  btnOpen?.addEventListener('click', () => {
    if (widthInput) widthInput.value = `${project.width}`;
    if (heightInput) heightInput.value = `${project.height}`;
    modal.style.display = 'flex';
  });

  const closeModal = () => { modal.style.display = 'none'; };
  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);

  // Preset buttons
  document.querySelectorAll('.resize-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.getAttribute('data-w');
      const h = btn.getAttribute('data-h');
      if (w && widthInput) widthInput.value = w;
      if (h && heightInput) heightInput.value = h;
    });
  });

  btnApply?.addEventListener('click', async () => {
    const w = parseInt(widthInput?.value || '0', 10);
    const h = parseInt(heightInput?.value || '0', 10);
    const anchor = anchorSelect ? anchorSelect.value : 'center';

    if (w <= 0 || h <= 0 || w > 512 || h > 512) {
      alert('Kích thước Canvas phải từ 8 đến 512 px');
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:3055/api/canvas/resize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: w, height: h, anchor })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Lỗi từ máy chủ');
      }
    } catch (err: any) {
      // Local fallback nếu server chưa bật
      project.width = w;
      project.height = h;
      canvasEngine.rebuildBuffers();
      onionSkinRenderer.resize(w, h);
    }

    const sizeBadge = document.getElementById('canvas-size-badge');
    if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
    const resLabel = document.getElementById('canvas-resolution');
    if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

    canvasEngine.centerViewport();
    renderAll();
    closeModal();
  });
}

// 12. Nhap anh tu may tinh thanh Layer moi (Image Import)
function initImageImport(): void {
  const btnImport = document.getElementById('btn-import-image');
  const fileInput = document.getElementById('image-import-input') as HTMLInputElement | null;

  if (!btnImport || !fileInput) return;

  btnImport.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        // Mo rong canvas neu can
        if (img.width > project.width || img.height > project.height) {
          project.width = Math.max(img.width, project.width);
          project.height = Math.max(img.height, project.height);
          const sizeBadge = document.getElementById('canvas-size-badge');
          if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
          const resLabel = document.getElementById('canvas-resolution');
          if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;
          onionSkinRenderer.resize(project.width, project.height);
        }

        const offsetX = Math.floor((project.width - img.width) / 2);
        const offsetY = Math.floor((project.height - img.height) / 2);

        const newLayerId = `layer_${Date.now()}`;
        const activeFrame = project.frames[project.activeFrameIndex] || project.frames[0];
        const newLayer = {
          id: newLayerId,
          name: `Import: ${file.name.slice(0, 12)}`,
          visible: true,
          locked: false,
          opacity: 1.0,
          pixels: {} as Record<string, PixelColor>
        };

        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (a > 20) {
              const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              newLayer.pixels[coordToKey(x + offsetX, y + offsetY)] = hex;
            }
          }
        }

        activeFrame.layers.push(newLayer);
        project.activeLayerId = newLayerId;
        canvasEngine.rebuildBuffers();
        canvasEngine.centerViewport();
        renderAll();

        // Dong bo voi server
        try {
          fetch('http://127.0.0.1:3055/api/draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'PROJECT_SYNC', project })
          }).catch(() => {});
        } catch (_) {}
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// 13. Modal Xuat File Tac Pham (Export)
function initExportModal(): void {
  const modal = document.getElementById('export-modal');
  const btnOpen = document.getElementById('btn-export');
  const btnClose = document.getElementById('btn-close-export-modal');
  const btnDownload = document.getElementById('btn-download-png');
  const btnServer = document.getElementById('btn-export-server');
  const typeSelect = document.getElementById('export-type-select') as HTMLSelectElement | null;

  let currentScale = 1;

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  btnClose?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Chon ti le phong to
  const scaleBtns = document.querySelectorAll('.export-scale-btn');
  scaleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      scaleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentScale = parseInt(btn.getAttribute('data-scale') || '1', 10);
    });
  });

  // Tai truc tiep file PNG sac net ve may tinh
  btnDownload?.addEventListener('click', () => {
    const exportType = typeSelect ? typeSelect.value : 'current_frame';

    if (exportType === 'current_frame') {
      const activeFrame = canvasEngine.getCurrentFrame();
      if (!activeFrame) return;

      const outW = project.width * currentScale;
      const outH = project.height * currentScale;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = outW;
      offCanvas.height = outH;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;

      // Ve lan luot cac visible layers
      for (const layer of activeFrame.layers) {
        if (!layer.visible) continue;
        if (layer.groupId) {
          const group = project.groups?.find(g => g.id === layer.groupId);
          if (group && group.visible === false) continue;
        }
        const buffer = canvasEngine.getLayerBuffer(layer.id);
        if (!buffer) continue;

        ctx.save();
        ctx.globalAlpha = layer.opacity;
        const pixels = buffer.getAllPixels();
        for (const p of pixels) {
          if (!p.color) continue;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x * currentScale, p.y * currentScale, currentScale, currentScale);
        }
        ctx.restore();
      }

      const link = document.createElement('a');
      link.download = `${project.name || 'pixel_art'}_frame${project.activeFrameIndex + 1}_${outW}x${outH}.png`;
      link.href = offCanvas.toDataURL('image/png');
      link.click();
      modal.style.display = 'none';
    } else {
      btnServer?.click();
    }
  });

  // Luu vao thu muc du an server
  btnServer?.addEventListener('click', async () => {
    try {
      const outputPath = `storage/outputs/${project.name || 'SpriteSheet'}_${Date.now()}.png`;
      const res = await fetch('http://127.0.0.1:3055/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputPath, scale: currentScale })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Đã xuất SpriteSheet thành công tại: ${outputPath}`);
        modal.style.display = 'none';
      } else {
        alert('Lỗi xuất file: ' + (data.error || 'Thao tác thất bại'));
      }
    } catch (err: any) {
      alert('Lỗi kết nối máy chủ xuất file: ' + err.message);
    }
  });
}

// 14. Khoi dong ung dung
loadPalette('endesga-32');
renderAll();
initWebSocketBridge();
initAiPortraitModal();
initGalleryModal();
initResizeModal();
initImageImport();
initExportModal();
