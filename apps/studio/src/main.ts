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
  LayerGroup,
  FrameData,
  AnimationClip,
  PixelPoint,
  SkeletonRig,
  JointId,
  JointPin
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
import { TAG_CATEGORIES } from './data/tags-dictionary';
import { downloadProjectFile, importFromPxDraw, exportToPxDraw } from './core/project-file';
import { applyColorAdjustment, ColorAdjustmentOptions, invertHexColor } from './tools/color-adjustments';

// 1. Khoi tao trang thai toan cuc cua Studio
const project: CanvasProject = createDefaultProject(24, 24, 'HeroSprite');
const history = new HistoryManager(50);
const animController = new AnimationController(project);
const selectionManager = new SelectionManager();
let globalOpenAiWizardWithBaseChar: ((pixels: PixelPoint[], w: number, h: number, name: string) => void) | null = null;

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

  // Cong cu Cay dua than (Magic Wand)
  if (activeTool === 'magicwand') {
    if (selectionManager.hasFloating()) {
      const buffer = canvasEngine.getActiveLayerBuffer();
      const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
      if (buffer && currentLayer) {
        const ch = selectionManager.commitFloating(buffer, project.activeLayerId, project.activeFrameIndex, currentLayer.pixels);
        if (ch.length > 0) history.pushStep(ch);
        canvasEngine.setFloatingSelection(null);
      }
    }

    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (currentLayer) {
      selectionManager.selectByWand(pt.x, pt.y, true, 15, currentLayer.pixels as Record<string, string>, project.width, project.height);
      canvasEngine.setSelection(selectionManager.getSelection());
      canvasEngine.setSelectionMask(selectionManager.getCustomMask());
      renderAll();
    }
    isPointerDown = false;
    return;
  }

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
    canvasEngine.setSelectionMask(null);
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
    w: 'magicwand',
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

// Click vao badge zoom de tu dong can vua toan man hinh (Fit to Screen)
const zoomBadge = document.getElementById('canvas-zoom-badge');
if (zoomBadge) {
  zoomBadge.style.cursor = 'pointer';
  zoomBadge.title = 'Click để căn vừa toàn màn hình (Fit to Screen)';
  zoomBadge.addEventListener('click', () => {
    canvasEngine.fitToScreen();
    zoomBadge.innerText = `${Math.round(canvasEngine.zoom * 100)}%`;
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
      const targetFrame = project.frames[idx];
      if (targetFrame && targetFrame.layers.length > 0) {
        const hasLayer = targetFrame.layers.some(l => l.id === project.activeLayerId);
        if (!hasLayer) {
          project.activeLayerId = targetFrame.layers[0].id;
        }
      }
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
  const targetFrame = project.frames[frameIndex];
  if (targetFrame && targetFrame.layers.length > 0) {
    const hasLayer = targetFrame.layers.some(l => l.id === project.activeLayerId);
    if (!hasLayer) {
      project.activeLayerId = targetFrame.layers[0].id;
    }
  }
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

        // Xu ly su kien hoan thanh AI tu server (ho tro client nhan ngay ket qua ke ca khi HTTP bi ngat)
        if (payload.type === 'AI_COMPLETED' && payload.result) {
          latestAiCompletedResult = payload.result;
          return;
        }

        // Xu ly dong bo toan bo Project tu Server (vi du khi nap anh moi hoac doi kich thuoc 64x64)
        if (payload.type === 'PROJECT_SYNC' && payload.project) {
          const newProj = payload.project;

          // Bao ve: Neu client dang co du lieu nhan vat (nhieu frame hoac co pixel)
          // ma server gui xuong project rong (khong co pixel) thi KHONG ghi de len client
          let clientPx = 0;
          for (const f of project.frames) {
            for (const l of f.layers) {
              clientPx += Object.keys(l.pixels || {}).length;
            }
          }

          let serverPx = 0;
          for (const f of (newProj.frames || [])) {
            for (const l of (f.layers || [])) {
              serverPx += Object.keys(l.pixels || {}).length;
            }
          }

          if (clientPx > 0 && serverPx === 0) {
            // Server gui du an rong, gui nguoc lai du an cua client de server cap nhat
            syncProjectToServer();
            return;
          }

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

// Bien toan cuc luu tru su kien AI_COMPLETED tu server
let latestAiCompletedResult: any = null;

// Helper kiem tra va khôi phuc ket qua AI tu server neu ket noi fetch bi ngat
async function fetchLastAiResultFallback(expectedType: 'character' | 'animation', maxRetries = 6, delayMs = 1200): Promise<any | null> {
  if (latestAiCompletedResult && latestAiCompletedResult.type === expectedType && latestAiCompletedResult.status === 'completed') {
    return latestAiCompletedResult;
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3055/api/ai/last-result');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.result) {
          const r = data.result;
          if (r.type === expectedType && r.status === 'completed') {
            latestAiCompletedResult = r;
            return r;
          }
          if (r.status === 'error') {
            throw new Error(r.error || 'Máy chủ báo lỗi khi sinh ảnh AI');
          }
        }
      }
    } catch (e: any) {
      if (e.message && e.message.includes('Máy chủ báo lỗi')) throw e;
    }
    if (i < maxRetries - 1) {
      await new Promise(res => setTimeout(res, delayMs));
    }
  }

  return (latestAiCompletedResult && latestAiCompletedResult.type === expectedType && latestAiCompletedResult.status === 'completed')
    ? latestAiCompletedResult
    : null;
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

// 9. Khoi tao Modal va ket noi AI Checkpoint & LoRA Pixel Art
function initAiPixelModal(): void {
  const modal = document.getElementById('ai-modal');
  const btnOpen = document.getElementById('btn-ai-portrait');
  const btnClose = document.getElementById('btn-close-ai-modal');
  const promptInput = document.getElementById('ai-prompt-input') as HTMLTextAreaElement;
  const statusMsg = document.getElementById('ai-status-msg');
  const statusText = document.getElementById('ai-status-text');
  const btnLoad = document.getElementById('btn-load-existing-ai');
  const btnGenerate = document.getElementById('btn-run-ai-generate');

  // Tag Picker & Search DOM
  const tagCategoriesContainer = document.getElementById('ai-tag-categories-container');
  const tagSearchInput = document.getElementById('tag-search-input') as HTMLInputElement | null;
  const btnClearAllTags = document.getElementById('btn-clear-all-tags');
  const promptTagCount = document.getElementById('prompt-tag-count');

  // Gemini Assistant DOM
  const geminiDescInput = document.getElementById('ai-gemini-desc-input') as HTMLInputElement | null;
  const btnGeminiExpand = document.getElementById('btn-gemini-expand') as HTMLButtonElement | null;
  const geminiStatus = document.getElementById('gemini-status-indicator');
  const geminiApiKeyInput = document.getElementById('gemini-api-key-input') as HTMLInputElement | null;

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

  // Key luu tru Gemini API Key trong localStorage
  const GEMINI_KEY_STORAGE = 'pixel_draw_gemini_api_key';

  // Dong bo trang thai active cua cac chip voi prompt hien tai
  const syncTagChips = () => {
    if (!promptInput) return;
    const currentText = promptInput.value.trim();
    const tags = currentText ? currentText.split(',').map(t => t.trim()).filter(Boolean) : [];
    const activeTagSet = new Set(tags.map(t => t.toLowerCase()));

    const allChips = document.querySelectorAll<HTMLElement>('.ai-tag-chip');
    allChips.forEach(chip => {
      const tag = chip.getAttribute('data-tag')?.toLowerCase();
      if (tag && activeTagSet.has(tag)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    if (promptTagCount) {
      promptTagCount.innerText = `${tags.length} tag${tags.length === 1 ? '' : 's'}`;
    }
  };

  // Bat tat tag khi nguoi dung nhan vao mot the chip (uu tien dua boi canh len dau cau)
  const toggleTag = (tag: string) => {
    if (!promptInput) return;
    const currentText = promptInput.value.trim();
    let tags = currentText ? currentText.split(',').map(t => t.trim()).filter(Boolean) : [];
    const lowerTag = tag.toLowerCase();

    const existingIndex = tags.findIndex(t => t.toLowerCase() === lowerTag);
    if (existingIndex >= 0) {
      // Go bo tag khoi prompt
      tags.splice(existingIndex, 1);
    } else {
      const isBackgroundTag = lowerTag.includes('background') || lowerTag.includes('forest') || lowerTag.includes('tavern') || lowerTag.includes('dungeon');
      if (isBackgroundTag) {
        // Chen tag boi canh len vi tri dau de dat do uu tien cao nhat
        let lastTriggerIdx = -1;
        for (let i = tags.length - 1; i >= 0; i--) {
          const lt = tags[i].toLowerCase();
          if (lt.includes('pixel') || lt.includes('portrait') || lt.includes('chibi') || lt.includes('16-bit')) {
            lastTriggerIdx = i;
            break;
          }
        }

        if (lastTriggerIdx >= 0) {
          tags.splice(lastTriggerIdx + 1, 0, tag);
        } else {
          tags.unshift(tag);
        }
      } else {
        // Them cac tag dac diem khac vao sau
        tags.push(tag);
      }
    }

    promptInput.value = tags.join(', ');
    syncTagChips();
  };

  // Render danh sach cac nhom tag tu thu vien chuan hoa
  const renderTagPicker = () => {
    if (!tagCategoriesContainer) return;
    tagCategoriesContainer.innerHTML = '';

    TAG_CATEGORIES.forEach(cat => {
      const catEl = document.createElement('div');
      catEl.className = 'ai-tag-category';
      catEl.setAttribute('data-category-id', cat.id);

      const headerEl = document.createElement('div');
      headerEl.className = 'ai-tag-category-title';
      headerEl.innerHTML = `<span>${cat.name}</span><span style="font-size: 9px; opacity: 0.6;">${cat.tags.length}</span>`;
      catEl.appendChild(headerEl);

      const wrapEl = document.createElement('div');
      wrapEl.className = 'ai-tag-chips-wrap';

      cat.tags.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ai-tag-chip';
        chip.setAttribute('data-tag', tag);
        chip.innerText = tag;

        chip.addEventListener('click', (e) => {
          e.preventDefault();
          toggleTag(tag);
        });

        wrapEl.appendChild(chip);
      });

      catEl.appendChild(wrapEl);
      tagCategoriesContainer.appendChild(catEl);
    });
  };

  // Khoi tao giao dien tag picker ban dau
  renderTagPicker();

  // Loc tag nhanh qua o tim kiem
  tagSearchInput?.addEventListener('input', () => {
    const query = tagSearchInput.value.trim().toLowerCase();
    const categories = document.querySelectorAll<HTMLElement>('.ai-tag-category');

    categories.forEach(cat => {
      const chips = cat.querySelectorAll<HTMLElement>('.ai-tag-chip');
      let visibleCount = 0;

      chips.forEach(chip => {
        const tag = chip.getAttribute('data-tag')?.toLowerCase() || '';
        if (!query || tag.includes(query)) {
          chip.classList.remove('hidden');
          visibleCount++;
        } else {
          chip.classList.add('hidden');
        }
      });

      // An ca danh muc neu khong co chip nao thoa man
      cat.style.display = visibleCount > 0 ? 'flex' : 'none';
    });
  });

  // Nut xoa toan bo tag trong prompt
  btnClearAllTags?.addEventListener('click', () => {
    if (promptInput) {
      promptInput.value = '';
      syncTagChips();
    }
  });

  // Dong bo chip khi nguoi dung go tay truc tiep vao textarea
  promptInput?.addEventListener('input', () => {
    syncTagChips();
  });

  // Xu ly tro ly Gemini Flash chuyen doi mo ta tu nhien sang prompt
  const handleGeminiExpand = async () => {
    const description = geminiDescInput?.value.trim();
    if (!description) {
      alert('Vui lòng nhập mô tả nhân vật bằng tiếng Việt (Ví dụ: Nữ hiệp sĩ tóc vàng mắt xanh cười tươi)');
      geminiDescInput?.focus();
      return;
    }

    const userApiKey = geminiApiKeyInput?.value.trim();
    if (userApiKey) {
      localStorage.setItem(GEMINI_KEY_STORAGE, userApiKey);
    }

    const currentLora = loraSelect?.value || 'models/lora/pixel_portrait_lora.safetensors';

    if (geminiStatus) {
      geminiStatus.innerText = 'Đang suy nghĩ...';
      geminiStatus.style.color = '#38bdf8';
    }
    if (btnGeminiExpand) btnGeminiExpand.disabled = true;

    try {
      const res = await fetch('http://127.0.0.1:3055/api/ai/gemini-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          loraPath: currentLora,
          apiKey: userApiKey || undefined
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Không nhận được kết quả từ Gemini');
      }

      if (promptInput) {
        promptInput.value = data.prompt;
        syncTagChips();
      }

      if (geminiStatus) {
        geminiStatus.innerText = `Đã tạo (${data.model || 'Gemini'})`;
        geminiStatus.style.color = '#4ade80';
        setTimeout(() => {
          if (geminiStatus) {
            geminiStatus.innerText = 'Sẵn sàng';
            geminiStatus.style.color = 'var(--text-muted)';
          }
        }, 4000);
      }
    } catch (err: any) {
      if (geminiStatus) {
        geminiStatus.innerText = 'Thất bại';
        geminiStatus.style.color = '#ef4444';
      }
      alert('Lỗi trợ lý Gemini: ' + err.message);
    } finally {
      if (btnGeminiExpand) btnGeminiExpand.disabled = false;
    }
  };

  btnGeminiExpand?.addEventListener('click', handleGeminiExpand);
  geminiDescInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGeminiExpand();
    }
  });

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
    // Doc API key da luu tu localStorage neu co
    const savedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (savedKey && geminiApiKeyInput && !geminiApiKeyInput.value) {
      geminiApiKeyInput.value = savedKey;
    }
    syncTagChips();
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
      if (preset === 'retro-char') {
        if (promptInput) promptInput.value = 'pixel art, retro character portrait, 1boy, brown hair, white shirt, smiling, looking at viewer, simple white background';
        if (loraSelect) loraSelect.value = 'models/lora/pixel_portrait_lora.safetensors';
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
      syncTagChips();
    });
  });

  // Gan su kien cho cac tag mau
  const tagButtons = document.querySelectorAll('.preset-tags .tag-btn');
  tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      if (tag && promptInput) {
        promptInput.value = tag;
        syncTagChips();
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
        body: JSON.stringify({ imagePath: 'sample_pixel_64x64.png' })
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
    const loraPath = loraSelect ? loraSelect.value : 'models/lora/pixel_portrait_lora.safetensors';
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
      if (statusText) statusText.innerText = 'Đang tự động khôi phục kết quả từ máy chủ...';
      try {
        const recovered = await fetchLastAiResultFallback('character', 6, 1500);
        if (recovered && recovered.pixels && recovered.pixels.length > 0) {
          if (barFill) barFill.style.width = '100%';
          if (percentText) percentText.innerText = '100%';
          if (statusText) statusText.innerText = 'Hoàn tất! Đã khôi phục và nạp vào Canvas.';
          setTimeout(() => {
            modal.style.display = 'none';
          }, 600);
          return;
        }
      } catch (recoverErr: any) {
        alert('Lỗi sinh ảnh: ' + (recoverErr.message || err.message));
        return;
      }
      alert('Lỗi kết nối máy chủ AI: ' + err.message);
    } finally {
      clearInterval(localTimer);
      if (btnGenerate) (btnGenerate as HTMLButtonElement).disabled = false;
    }
  });

  // ========================================================
  // BỘ ĐIỀU KHIỂN AI SPRITE STEPPER WIZARD & CHECKPOINT
  // ========================================================

  // Định dạng hiển thị giây thành chuỗi phút:giây
  const formatTimeSec = (totalSec: number): string => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Cấu trúc dữ liệu Checkpoint lưu trữ phiên làm việc
  interface AiWizardCheckpoint {
    step: 1 | 2 | 3 | 4;
    prompt: string;
    checkpointModel: string;
    loraModel: string;
    loraScale: number;
    steps: number;
    size: number;
    removeBg: boolean;
    baseCharacter: {
      seed: number | null;
      locked: boolean;
      pixels: PixelPoint[] | null;
      width: number;
      height: number;
      dataUrl: string | null;
    };
    animation: {
      action: string;
      frameCount: number;
      frameSize: number;
      frames: {
        frameIndex: number;
        width: number;
        height: number;
        pixels: PixelPoint[];
      }[] | null;
      engine?: 'hybrid' | 'template' | 'ai';
      refineStrength?: number;
    };
    skeletonRig?: SkeletonRig;
    updatedAt: number;
  }

  const WIZARD_STORAGE_KEY = 'pixel_draw_ai_wizard_checkpoint';

  // Trạng thái vận hành của Wizard
  let currentWizardStep: 1 | 2 | 3 | 4 = 1;

  const baseCharState = {
    prompt: '',
    seed: null as number | null,
    locked: false,
    pixels: null as PixelPoint[] | null,
    width: 64,
    height: 64,
    dataUrl: null as string | null
  };

  // Trang thai khung xuong va tuong tac gan khop
  let activeSkeletonRig: SkeletonRig | null = null;
  let draggedJointId: string | null = null;
  let hoveredJointId: string | null = null;
  let selectedJointId: string | null = null;
  let isAddingJoint = false;
  let showRigGrid = false;
  let rigZoomScale = 1;
  let isTestingCycle = false;
  let testCycleTimer: any = null;
  let testCycleFrame = 0;

  // Helper tu dong tinh toan 16 khop OpenPose Full chuan giai phau dua tren Bounding Box
  const autoEstimateSkeletonRig = (
    basePixels: PixelPoint[],
    width = 64,
    height = 64
  ): SkeletonRig => {
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    for (const p of basePixels) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    if (minX > maxX || minY > maxY) {
      minX = Math.floor(width * 0.25);
      maxX = Math.floor(width * 0.75);
      minY = Math.floor(height * 0.15);
      maxY = Math.floor(height * 0.85);
    }

    const charW = Math.max(1, maxX - minX + 1);
    const charH = Math.max(1, maxY - minY + 1);
    const centerX = Math.floor((minX + maxX) / 2);

    const headY = Math.max(0, minY + Math.floor(charH * 0.12));
    const neckY = Math.max(0, minY + Math.floor(charH * 0.25));
    const chestY = Math.max(0, minY + Math.floor(charH * 0.38));
    const hipsY = Math.max(0, minY + Math.floor(charH * 0.58));

    // Canh tay
    const armSpan = Math.max(3, Math.floor(charW * 0.28));
    const elbowSpan = Math.max(4, Math.floor(charW * 0.36));
    const wristSpan = Math.max(4, Math.floor(charW * 0.38));
    const elbowY = Math.max(0, minY + Math.floor(charH * 0.44));
    const wristY = Math.max(0, minY + Math.floor(charH * 0.58));

    // Chan
    const hipSpan = Math.max(2, Math.floor(charW * 0.16));
    const kneeSpan = Math.max(2, Math.floor(charW * 0.20));
    const kneeY = Math.max(0, minY + Math.floor(charH * 0.78));
    const footY = Math.min(height - 1, maxY);

    const joints: Record<string, JointPin> = {
      // Dau & Co (OpenPose #ec4899 / #f59e0b)
      head: { id: 'head', name: 'Đầu (Head)', x: centerX, y: headY, color: '#ec4899', parent: 'neck' },
      neck: { id: 'neck', name: 'Cổ (Neck)', x: centerX, y: neckY, color: '#f59e0b', parent: 'chest' },
      // Than
      chest: { id: 'chest', name: 'Ngực (Chest)', x: centerX, y: chestY, color: '#38bdf8' },
      hips: { id: 'hips', name: 'Hông (Hips)', x: centerX, y: hipsY, color: '#0284c7', parent: 'chest' },
      // Tay Trai (Vang Cam OpenPose)
      left_shoulder: { id: 'left_shoulder', name: 'Vai Trái (L Shoulder)', x: Math.max(0, centerX - armSpan), y: neckY + 1, color: '#f97316', parent: 'neck' },
      left_elbow: { id: 'left_elbow', name: 'Khuỷu Trái (L Elbow)', x: Math.max(0, centerX - elbowSpan), y: elbowY, color: '#eab308', parent: 'left_shoulder' },
      left_wrist: { id: 'left_wrist', name: 'Cổ Tay Trái (L Wrist)', x: Math.max(0, centerX - wristSpan), y: wristY, color: '#fde047', parent: 'left_elbow' },
      // Tay Phai (Xanh La OpenPose)
      right_shoulder: { id: 'right_shoulder', name: 'Vai Phải (R Shoulder)', x: Math.min(width - 1, centerX + armSpan), y: neckY + 1, color: '#84cc16', parent: 'neck' },
      right_elbow: { id: 'right_elbow', name: 'Khuỷu Phải (R Elbow)', x: Math.min(width - 1, centerX + elbowSpan), y: elbowY, color: '#22c55e', parent: 'right_shoulder' },
      right_wrist: { id: 'right_wrist', name: 'Cổ Tay Phải (R Wrist)', x: Math.min(width - 1, centerX + wristSpan), y: wristY, color: '#4ade80', parent: 'right_elbow' },
      // Chan Trai (Xanh Lam OpenPose)
      left_hip: { id: 'left_hip', name: 'Háng Trái (L Hip)', x: Math.max(0, centerX - hipSpan), y: hipsY + 1, color: '#06b6d4', parent: 'hips' },
      left_knee: { id: 'left_knee', name: 'Gối Trái (L Knee)', x: Math.max(0, centerX - kneeSpan), y: kneeY, color: '#38bdf8', parent: 'left_hip' },
      left_foot: { id: 'left_foot', name: 'Bàn Chân Trái (L Foot)', x: Math.max(0, centerX - kneeSpan), y: footY, color: '#60a5fa', parent: 'left_knee' },
      // Chan Phai (Tim OpenPose)
      right_hip: { id: 'right_hip', name: 'Háng Phải (R Hip)', x: Math.min(width - 1, centerX + hipSpan), y: hipsY + 1, color: '#8b5cf6', parent: 'hips' },
      right_knee: { id: 'right_knee', name: 'Gối Phải (R Knee)', x: Math.min(width - 1, centerX + kneeSpan), y: kneeY, color: '#a855f7', parent: 'right_hip' },
      right_foot: { id: 'right_foot', name: 'Bàn Chân Phải (R Foot)', x: Math.min(width - 1, centerX + kneeSpan), y: footY, color: '#c084fc', parent: 'right_knee' },
      // Vu Khi
      weapon: { id: 'weapon', name: 'Vũ Khí (Weapon)', x: Math.min(width - 1, maxX + 2), y: Math.floor(minY + charH * 0.50), color: '#f43f5e', parent: 'right_wrist' }
    };

    const bones: [string, string][] = [
      ['head', 'neck'],
      ['neck', 'chest'],
      ['chest', 'hips'],
      ['neck', 'left_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['neck', 'right_shoulder'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['hips', 'left_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_foot'],
      ['hips', 'right_hip'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_foot'],
      ['right_wrist', 'weapon']
    ];

    return {
      width,
      height,
      rootJoint: 'chest',
      joints,
      bones
    };
  };

  const animSetupState = {
    action: 'walk',
    frameCount: 4,
    frameSize: 64,
    removeBg: true,
    engine: 'template' as 'hybrid' | 'template' | 'ai',
    refineStrength: 0.62,
    slashVfxType: 'cyan' as 'none' | 'cyan' | 'fire' | 'silver' | 'purple',
    frames: [] as {
      frameIndex: number;
      width: number;
      height: number;
      pixels: PixelPoint[];
    }[]
  };

  // Biến quản lý vòng lặp xem trước chuyển động (Live Animation Player)
  let livePlayerTimer: any = null;
  let livePlayerIndex = 0;
  let livePlayerPlaying = true;
  let livePlayerFps = 8;

  // Helper chuyển mảng điểm ảnh PixelPoint thành DataURL
  const renderPixelsToDataUrl = (pixels: PixelPoint[], w: number, h: number): string => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return '';
    for (const p of pixels) {
      if (!p.color) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    return offCanvas.toDataURL('image/png');
  };

  // Lưu trạng thái Checkpoint vào bộ nhớ trình duyệt
  const saveWizardCheckpoint = () => {
    try {
      const checkpoint: AiWizardCheckpoint = {
        step: currentWizardStep,
        prompt: promptInput?.value.trim() || '',
        checkpointModel: checkpointSelect ? checkpointSelect.value : 'models/checkpoints/AOM3A1B_orangemixs.safetensors',
        loraModel: loraSelect ? loraSelect.value : 'models/lora/pixel_f2.safetensors',
        loraScale: loraScaleInput ? parseFloat(loraScaleInput.value) : 0.65,
        steps: stepsInput ? parseInt(stepsInput.value, 10) : 16,
        size: sizeSelect ? parseInt(sizeSelect.value, 10) : 64,
        removeBg: removeBgCheckbox ? removeBgCheckbox.checked : true,
        baseCharacter: {
          seed: baseCharState.seed,
          locked: baseCharState.locked,
          pixels: baseCharState.pixels,
          width: baseCharState.width,
          height: baseCharState.height,
          dataUrl: baseCharState.dataUrl
        },
        animation: {
          action: animSetupState.action,
          frameCount: animSetupState.frameCount,
          frameSize: animSetupState.frameSize,
          engine: animSetupState.engine,
          refineStrength: animSetupState.refineStrength,
          frames: animSetupState.frames.length > 0 ? animSetupState.frames : null
        },
        skeletonRig: activeSkeletonRig || undefined,
        updatedAt: Date.now()
      };
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(checkpoint));
    } catch (e) {
      console.warn('Không thể lưu checkpoint vào localStorage:', e);
    }
  };

  // Đọc trạng thái Checkpoint đã lưu
  const loadWizardCheckpoint = (): AiWizardCheckpoint | null => {
    try {
      const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (!raw) return null;
      const data: AiWizardCheckpoint = JSON.parse(raw);
      // Hạn dùng checkpoint trong 24 giờ
      if (Date.now() - data.updatedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(WIZARD_STORAGE_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  };

  // Xóa toàn bộ Checkpoint để người dùng làm mới từ đầu
  const clearWizardCheckpoint = () => {
    try {
      localStorage.removeItem(WIZARD_STORAGE_KEY);
    } catch (e) {}
    currentWizardStep = 1;
    baseCharState.prompt = '';
    baseCharState.seed = null;
    baseCharState.locked = false;
    baseCharState.pixels = null;
    baseCharState.dataUrl = null;
    activeSkeletonRig = null;
    if (testCycleTimer) {
      clearInterval(testCycleTimer);
      testCycleTimer = null;
      isTestingCycle = false;
    }
    animSetupState.frames = [];
    if (livePlayerTimer) {
      clearInterval(livePlayerTimer);
      livePlayerTimer = null;
    }
  };

  // Các phần tử DOM của Stepper và Panel
  const stepIndicators = [
    document.getElementById('wizard-step-indicator-1'),
    document.getElementById('wizard-step-indicator-2'),
    document.getElementById('wizard-step-indicator-3'),
    document.getElementById('wizard-step-indicator-4')
  ];

  const stepLines = [
    document.getElementById('stepper-line-1'),
    document.getElementById('stepper-line-2'),
    document.getElementById('stepper-line-3')
  ];

  const stepPanels = [
    document.getElementById('wizard-panel-1'),
    document.getElementById('wizard-panel-2'),
    document.getElementById('wizard-panel-3'),
    document.getElementById('wizard-panel-4')
  ];

  // Các nút điều hướng ở chân Modal
  const btnWizardBack = document.getElementById('btn-wizard-back');
  const btnWizardDrawStatic = document.getElementById('btn-wizard-draw-static');
  const btnWizardDrawBase = document.getElementById('btn-wizard-draw-base');
  const btnWizardStep2UseStatic = document.getElementById('btn-wizard-step2-use-static');
  const btnWizardNextStep = document.getElementById('btn-wizard-next-step');
  const btnWizardGenerateAnim = document.getElementById('btn-wizard-generate-anim');
  const btnWizardChangeAction = document.getElementById('btn-wizard-change-action');
  const btnWizardFinish = document.getElementById('btn-wizard-finish');
  const btnWizardReset = document.getElementById('btn-wizard-reset');

  // Các phần tử tại Bước 2 (Xem trước & Chốt mẫu)
  const animBaseImg = document.getElementById('anim-base-preview-img') as HTMLImageElement | null;
  const animBasePlaceholder = document.getElementById('anim-base-empty-placeholder');
  const animBaseBadge = document.getElementById('anim-base-status-badge');
  const animBaseSeedText = document.getElementById('anim-base-seed-text');
  const animPreviewBox = document.getElementById('anim-base-preview-container');
  const btnStep2BackStep1 = document.getElementById('btn-step2-back-step1');
  const btnStep2Reroll = document.getElementById('btn-step2-reroll');
  const btnStep2UseStatic = document.getElementById('btn-step2-use-static');
  const btnStep2Lock = document.getElementById('btn-step2-lock') as HTMLButtonElement | null;

  // Các phần tử tại Bước 3 (Cấu hình hoạt cảnh & Gán khung xương)
  const step3ThumbImg = document.getElementById('wizard-step3-thumb-img') as HTMLImageElement | null;
  const step3SeedLabel = document.getElementById('wizard-step3-seed-label');
  const btnStep3ChangeChar = document.getElementById('btn-step3-change-char');
  const animFrameSizeSelect = document.getElementById('anim-frame-size-select') as HTMLSelectElement | null;
  const animRemoveBgCheckbox = document.getElementById('anim-remove-bg-checkbox') as HTMLInputElement | null;
  const btnStep3TabActions = document.getElementById('btn-step3-tab-actions');
  const btnStep3TabRigging = document.getElementById('btn-step3-tab-rigging');
  const step3ActionsPanel = document.getElementById('step3-actions-panel');
  const step3RiggingPanel = document.getElementById('step3-rigging-panel');
  const jointCanvas = document.getElementById('joint-pinning-canvas') as HTMLCanvasElement | null;
  const jointOverlay = document.getElementById('joint-pinning-overlay') as HTMLCanvasElement | null;
  const jointPinningWrapper = document.getElementById('joint-pinning-wrapper');
  const jointTooltip = document.getElementById('joint-tooltip');
  const btnRigAutoAlign = document.getElementById('btn-rig-auto-align');
  const btnRigTestCycle = document.getElementById('btn-rig-test-cycle');
  const btnRigToggleGrid = document.getElementById('btn-rig-toggle-grid');
  const btnRigAddJoint = document.getElementById('btn-rig-add-joint');
  const btnRigDeleteJoint = document.getElementById('btn-rig-delete-joint');
  const rigZoomBtns = document.querySelectorAll('.rig-zoom-btn');
  const customJointsSection = document.getElementById('custom-joints-section');
  const customJointsList = document.getElementById('custom-joints-list');
  const jointLegendItems = document.querySelectorAll('.joint-legend-item');

  // Các phần tử tại Bước 4 (Live Animation Player)
  const wizardLiveCanvas = document.getElementById('wizard-live-canvas') as HTMLCanvasElement | null;
  const wizardLivePlaceholder = document.getElementById('wizard-live-placeholder');
  const wizardLiveFrameIndicator = document.getElementById('wizard-live-frame-indicator');
  const wizardLiveActionIndicator = document.getElementById('wizard-live-action-indicator');
  const wizardLiveFpsSlider = document.getElementById('wizard-live-fps-slider') as HTMLInputElement | null;
  const wizardLiveFpsLabel = document.getElementById('wizard-live-fps-label');
  const wizardLiveToggleBtn = document.getElementById('wizard-live-toggle-btn');

  // Dừng hoặc tiếp tục bộ phát hoạt ảnh trực tiếp ở Bước 4
  const startLivePlayer = () => {
    if (livePlayerTimer) clearInterval(livePlayerTimer);
    if (!animSetupState.frames || animSetupState.frames.length === 0) return;

    if (wizardLiveCanvas) wizardLiveCanvas.style.display = 'block';
    if (wizardLivePlaceholder) wizardLivePlaceholder.style.display = 'none';

    const ctx = wizardLiveCanvas?.getContext('2d');
    if (!ctx) return;

    livePlayerTimer = setInterval(() => {
      if (!livePlayerPlaying) return;
      const totalFrames = animSetupState.frames.length;
      if (totalFrames === 0) return;

      const currentFrame = animSetupState.frames[livePlayerIndex];
      if (currentFrame && wizardLiveCanvas) {
        ctx.clearRect(0, 0, wizardLiveCanvas.width, wizardLiveCanvas.height);
        const scale = wizardLiveCanvas.width / currentFrame.width;
        for (const p of currentFrame.pixels) {
          if (!p.color) continue;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x * scale, p.y * scale, scale, scale);
        }
      }

      if (wizardLiveFrameIndicator) {
        wizardLiveFrameIndicator.innerText = `Frame: ${livePlayerIndex + 1} / ${totalFrames}`;
      }
      if (wizardLiveActionIndicator) {
        wizardLiveActionIndicator.innerText = animSetupState.action.toUpperCase();
      }

      livePlayerIndex = (livePlayerIndex + 1) % totalFrames;
    }, Math.max(50, Math.floor(1000 / livePlayerFps)));
  };

  // Hàm chuyển bước chính trong Stepper Wizard
  const goToStep = (targetStep: number) => {
    const validStep = Math.max(1, Math.min(4, targetStep)) as 1 | 2 | 3 | 4;
    currentWizardStep = validStep;

    // 1. Cập nhật hiển thị panel
    stepPanels.forEach((panel, idx) => {
      if (!panel) return;
      const isCurrent = idx + 1 === validStep;
      panel.style.display = isCurrent ? 'block' : 'none';
      panel.classList.toggle('active', isCurrent);
    });

    // 2. Cập nhật Stepper Bar (Item & Line)
    stepIndicators.forEach((ind, idx) => {
      if (!ind) return;
      const stepNum = idx + 1;
      ind.classList.remove('active', 'completed', 'pending');
      if (stepNum < validStep) {
        ind.classList.add('completed');
      } else if (stepNum === validStep) {
        ind.classList.add('active');
      } else {
        ind.classList.add('pending');
      }
    });

    stepLines.forEach((line, idx) => {
      if (!line) return;
      line.classList.toggle('completed', idx + 1 < validStep);
    });

    // 3. Cập nhật các nút ở chân Modal (Footer)
    if (btnWizardBack) {
      btnWizardBack.style.display = validStep > 1 ? 'inline-flex' : 'none';
    }
    if (btnWizardDrawStatic) {
      btnWizardDrawStatic.style.display = validStep === 1 ? 'inline-flex' : 'none';
    }
    if (btnWizardDrawBase) {
      btnWizardDrawBase.style.display = validStep === 1 ? 'inline-flex' : 'none';
    }
    if (btnWizardStep2UseStatic) {
      btnWizardStep2UseStatic.style.display = validStep === 2 && !!baseCharState.dataUrl ? 'inline-flex' : 'none';
    }
    if (btnWizardNextStep) {
      // Ở Bước 1: cho phép tiếp tục nếu đã có ảnh mẫu; ở Bước 2: cho phép nếu đã chốt mẫu
      const canProceed = (validStep === 1 && !!baseCharState.dataUrl) || (validStep === 2 && baseCharState.locked);
      btnWizardNextStep.style.display = canProceed ? 'inline-flex' : 'none';
    }
    if (btnWizardGenerateAnim) {
      btnWizardGenerateAnim.style.display = validStep === 3 ? 'inline-flex' : 'none';
    }
    if (btnWizardChangeAction) {
      btnWizardChangeAction.style.display = validStep === 4 ? 'inline-flex' : 'none';
    }
    if (btnWizardFinish) {
      btnWizardFinish.style.display = validStep === 4 && animSetupState.frames.length > 0 ? 'inline-flex' : 'none';
    }

    // 4. Đồng bộ dữ liệu chuyên biệt theo từng bước
    if (validStep === 2) {
      if (baseCharState.dataUrl && animBaseImg) {
        animBaseImg.src = baseCharState.dataUrl;
        animBaseImg.style.display = 'block';
        if (animBasePlaceholder) animBasePlaceholder.style.display = 'none';
      }
      if (animBaseSeedText) {
        animBaseSeedText.innerText = baseCharState.seed ? `Seed: #${baseCharState.seed}` : 'Seed: Ngẫu nhiên';
      }
      if (animBaseBadge) {
        if (baseCharState.locked) {
          animBaseBadge.innerText = `Đã chốt mẫu #${baseCharState.seed}`;
          animBaseBadge.style.color = '#4ade80';
          animBaseBadge.style.borderColor = '#22c55e';
        } else {
          animBaseBadge.innerText = 'Chưa chốt mẫu (Xem trước)';
          animBaseBadge.style.color = '#f59e0b';
          animBaseBadge.style.borderColor = '#d97706';
        }
      }
      if (btnStep2Lock) {
        btnStep2Lock.disabled = !baseCharState.seed;
        btnStep2Lock.innerText = baseCharState.locked ? 'Đã Chốt Mẫu (Tiếp tục)' : 'Chốt Mẫu Này & Sang Bước 3';
      }

      // Tu dong kiem tra va goi y mo bo cat luoi neu prompt hoac anh co dang sprite sheet
      const isSpritePrompt = /sprite|sheet|grid|cycle|frame/i.test(baseCharState.prompt || promptInput?.value || '');
      if (isSpritePrompt && step2SlicerPanel && step2SlicerPanel.style.display !== 'flex') {
        step2SlicerPanel.style.display = 'flex';
        setTimeout(() => sliceBaseCharGrid(), 100);
      }
    } else if (validStep === 3) {
      if (step3ThumbImg && baseCharState.dataUrl) {
        step3ThumbImg.src = baseCharState.dataUrl;
      }
      if (step3SeedLabel) {
        step3SeedLabel.innerText = `Seed: #${baseCharState.seed || '0'}`;
      }
      ensureSkeletonRig();
      renderCustomJointsLegend();
      renderJointPinningView();
    } else if (validStep === 4) {
      stopTestCycle();
      if (animSetupState.frames.length > 0) {
        startLivePlayer();
      }
    } else {
      stopTestCycle();
    }

    // Tự động sao lưu trạng thái Checkpoint
    saveWizardCheckpoint();
  };

  // Cho phép người dùng bấm trực tiếp vào Stepper Header để quay lại bước đã làm
  stepIndicators.forEach((ind, idx) => {
    ind?.addEventListener('click', () => {
      const target = idx + 1;
      // Chỉ cho phép chuyển đến bước nhỏ hơn bước hiện tại hoặc bước đã có dữ liệu hợp lệ
      if (target < currentWizardStep) {
        goToStep(target);
      } else if (target === 2 && baseCharState.dataUrl) {
        goToStep(2);
      } else if (target === 3 && baseCharState.locked) {
        goToStep(3);
      } else if (target === 4 && animSetupState.frames.length > 0) {
        goToStep(4);
      }
    });
  });

  // Gắn sự kiện nút Quay Lại chân Modal
  btnWizardBack?.addEventListener('click', () => {
    if (currentWizardStep > 1) {
      goToStep(currentWizardStep - 1);
    }
  });

  // Gắn sự kiện nút Tiếp Tục chân Modal
  btnWizardNextStep?.addEventListener('click', () => {
    if (currentWizardStep === 1 && baseCharState.dataUrl) {
      goToStep(2);
    } else if (currentWizardStep === 2 && baseCharState.locked) {
      goToStep(3);
    }
  });

  // Gắn sự kiện nút Làm Mới (Reset) ở góc trên Modal
  btnWizardReset?.addEventListener('click', () => {
    if (confirm('Bạn có muốn làm mới toàn bộ dữ liệu thiết kế để bắt đầu lại từ đầu không?')) {
      clearWizardCheckpoint();
      if (animBaseImg) animBaseImg.style.display = 'none';
      if (animBasePlaceholder) animBasePlaceholder.style.display = 'block';
      if (animBaseSeedText) animBaseSeedText.innerText = 'Seed: Ngẫu nhiên';
      if (animBaseBadge) {
        animBaseBadge.innerText = 'Chưa có mẫu';
        animBaseBadge.style.color = '#94a3b8';
        animBaseBadge.style.borderColor = 'rgba(255,255,255,0.15)';
      }
      goToStep(1);
    }
  });

  // ==========================================
  // XỬ LÝ VẼ ẢNH TĨNH VÀ NẠP TRỰC TIẾP CANVAS
  // ==========================================

  // Sinh ảnh tĩnh và nạp thẳng vào Canvas Studio (Không qua bước 2-3-4)
  const handleDrawStaticImage = async () => {
    const prompt = promptInput?.value.trim();
    if (!prompt) {
      alert('Vui lòng nhập mô tả nhân vật, phong cảnh hoặc chọn tag');
      return;
    }

    const checkpoint = checkpointSelect ? checkpointSelect.value : 'models/checkpoints/AOM3A1B_orangemixs.safetensors';
    const loraPath = loraSelect ? loraSelect.value : 'models/lora/pixel_portrait_lora.safetensors';
    const loraScale = loraScaleInput ? parseFloat(loraScaleInput.value) : 0.65;
    const steps = stepsInput ? parseInt(stepsInput.value, 10) : 16;
    const size = sizeSelect ? parseInt(sizeSelect.value, 10) : 64;
    const mode = modeSelect ? modeSelect.value : 'replace_canvas';
    const removeBg = removeBgCheckbox ? removeBgCheckbox.checked : false;

    const barFill = document.getElementById('ai-progress-bar-fill');
    const stepsBadge = document.getElementById('ai-steps-badge');
    const timeElapsed = document.getElementById('ai-time-elapsed');
    const percentText = document.getElementById('ai-percent-text');
    const timeEta = document.getElementById('ai-time-eta');

    if (statusMsg) statusMsg.style.display = 'block';
    if (statusText) statusText.innerText = 'Đang vẽ ảnh tĩnh bằng AI...';
    if (barFill) barFill.style.width = '0%';
    if (percentText) percentText.innerText = '0%';
    if (stepsBadge) stepsBadge.innerText = `0 / ${steps} steps`;
    if (timeElapsed) timeElapsed.innerText = 'Đã chạy: 00:00';
    if (timeEta) timeEta.innerText = 'Còn lại: Đang tính...';
    if (btnWizardDrawStatic) (btnWizardDrawStatic as HTMLButtonElement).disabled = true;

    const startTime = Date.now();
    const staticTimer = setInterval(() => {
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
      if (!data.success) {
        throw new Error(data.error || 'Không thể tạo ảnh');
      }

      // Nạp kết quả vào Studio
      if (data.project) {
        const newProj = data.project;
        project.id = newProj.id;
        project.name = newProj.name;
        project.width = newProj.width;
        project.height = newProj.height;
        project.frames = newProj.frames;
        project.clips = newProj.clips;
        project.activeFrameIndex = newProj.activeFrameIndex || 0;
        project.activeLayerId = newProj.activeLayerId || newProj.frames[0]?.layers[0]?.id || 'layer_1';

        canvasEngine.rebuildBuffers();
        canvasEngine.centerViewport();
        onionSkinRenderer.resize(project.width, project.height);

        const sizeBadge = document.getElementById('canvas-size-badge');
        if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
        const resLabel = document.getElementById('canvas-resolution');
        if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

        renderAll();
      }

      if (barFill) barFill.style.width = '100%';
      if (percentText) percentText.innerText = '100%';
      if (statusText) statusText.innerText = 'Hoàn tất! Đã nạp vào Canvas Studio.';

      setTimeout(() => {
        modal.style.display = 'none';
      }, 500);

    } catch (err: any) {
      alert('Lỗi tạo ảnh tĩnh: ' + err.message);
    } finally {
      clearInterval(staticTimer);
      if (btnWizardDrawStatic) (btnWizardDrawStatic as HTMLButtonElement).disabled = false;
      if (statusMsg) statusMsg.style.display = 'none';
    }
  };

  btnWizardDrawStatic?.addEventListener('click', handleDrawStaticImage);

  // ==========================================
  // XỬ LÝ BƯỚC 1: VẼ MẪU NHÂN VẬT BAN ĐẦU
  // ==========================================
  const handleDrawBaseCharacter = async () => {
    let basePrompt = promptInput?.value.trim() || 'pixel art, 16-bit rpg hero, warrior knight, golden armor';
    // Đảm bảo tư thế chuẩn cho nhân vật mẫu
    if (!basePrompt.toLowerCase().includes('standing')) {
      basePrompt += ', standing';
    }
    if (!basePrompt.toLowerCase().includes('full body')) {
      basePrompt += ', full body';
    }

    const checkpoint = checkpointSelect ? checkpointSelect.value : 'models/checkpoints/AOM3A1B_orangemixs.safetensors';
    const loraPath = loraSelect ? loraSelect.value : 'models/lora/pixel_f2.safetensors';
    const loraScale = loraScaleInput ? parseFloat(loraScaleInput.value) : 0.65;
    const steps = stepsInput ? parseInt(stepsInput.value, 10) : 16;
    const size = 64;

    const barFill = document.getElementById('ai-progress-bar-fill');
    const stepsBadge = document.getElementById('ai-steps-badge');
    const timeElapsed = document.getElementById('ai-time-elapsed');
    const percentText = document.getElementById('ai-percent-text');
    const timeEta = document.getElementById('ai-time-eta');

    if (statusMsg) statusMsg.style.display = 'block';
    if (statusText) statusText.innerText = 'Đang vẽ tư thế mẫu nhân vật toàn thân...';
    if (barFill) barFill.style.width = '0%';
    if (percentText) percentText.innerText = '0%';
    if (stepsBadge) stepsBadge.innerText = `0 / ${steps} steps`;
    if (timeElapsed) timeElapsed.innerText = 'Đã chạy: 00:00';
    if (timeEta) timeEta.innerText = 'Còn lại: Đang tính...';
    if (btnWizardDrawBase) (btnWizardDrawBase as HTMLButtonElement).disabled = true;
    if (btnStep2Reroll) (btnStep2Reroll as HTMLButtonElement).disabled = true;

    const startTime = Date.now();
    const baseTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      if (timeElapsed) timeElapsed.innerText = `Đã chạy: ${formatTimeSec(sec)}`;
    }, 1000);

    try {
      const res = await fetch('http://127.0.0.1:3055/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: basePrompt,
          checkpoint,
          loraPath,
          loraScale,
          steps,
          size,
          mode: 'preview_only',
          removeBg: true
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Không thể tạo ảnh mẫu');
      }

      baseCharState.prompt = basePrompt;
      baseCharState.seed = data.seed || null;
      baseCharState.pixels = data.pixels || null;
      baseCharState.width = data.width || 64;
      baseCharState.height = data.height || 64;
      baseCharState.locked = false;

      if (data.pixels && data.pixels.length > 0) {
        baseCharState.dataUrl = renderPixelsToDataUrl(data.pixels, baseCharState.width, baseCharState.height);
      }

      // Tự động chuyển sang Bước 2 để người dùng xem trước và chốt mẫu
      goToStep(2);

    } catch (err: any) {
      // Co che tu dong phuc hoi neu ket noi fetch bi ngat socket sau khi chay CPU lau
      if (statusText) statusText.innerText = 'Đang tự động khôi phục kết quả từ máy chủ...';
      try {
        const recovered = await fetchLastAiResultFallback('character', 6, 1500);
        if (recovered && recovered.pixels && recovered.pixels.length > 0) {
          baseCharState.prompt = recovered.prompt || basePrompt;
          baseCharState.seed = recovered.seed || null;
          baseCharState.pixels = recovered.pixels;
          baseCharState.width = recovered.width || 64;
          baseCharState.height = recovered.height || 64;
          baseCharState.locked = false;
          baseCharState.dataUrl = renderPixelsToDataUrl(recovered.pixels, baseCharState.width, baseCharState.height);

          goToStep(2);
          return;
        }
      } catch (recoverErr: any) {
        alert('Lỗi tạo nhân vật mẫu: ' + (recoverErr.message || err.message));
        return;
      }

      alert('Lỗi tạo nhân vật mẫu: ' + err.message);
    } finally {
      clearInterval(baseTimer);
      if (btnWizardDrawBase) (btnWizardDrawBase as HTMLButtonElement).disabled = false;
      if (btnStep2Reroll) (btnStep2Reroll as HTMLButtonElement).disabled = false;
      if (statusMsg) statusMsg.style.display = 'none';
    }
  };

  btnWizardDrawBase?.addEventListener('click', handleDrawBaseCharacter);

  // ==========================================
  // XỬ LÝ BƯỚC 2: XEM TRƯỚC & CHỐT MẪU
  // ==========================================
  btnStep2BackStep1?.addEventListener('click', () => {
    goToStep(1);
  });

  btnStep2Reroll?.addEventListener('click', handleDrawBaseCharacter);

  // Nạp ảnh mẫu hiện tại ở Bước 2 trực tiếp vào Canvas Studio
  const handleApplyBaseCharToCanvas = () => {
    if (!baseCharState.pixels || baseCharState.pixels.length === 0) {
      alert('Chưa có ảnh mẫu để nạp vào Canvas!');
      return;
    }

    const w = baseCharState.width || 64;
    const h = baseCharState.height || 64;
    project.width = w;
    project.height = h;

    const pixelsRecord: Record<string, PixelColor> = {};
    for (const p of baseCharState.pixels) {
      if (p.color) {
        pixelsRecord[coordToKey(p.x, p.y)] = p.color;
      }
    }

    project.frames = [
      {
        id: `frame_1_${Date.now()}`,
        durationMs: 120,
        layers: [
          {
            id: `layer_1_${Date.now()}`,
            name: 'AI Pixel Art',
            visible: true,
            locked: false,
            opacity: 1.0,
            pixels: pixelsRecord
          }
        ]
      }
    ];
    project.activeFrameIndex = 0;
    project.activeLayerId = project.frames[0].layers[0].id;
    project.clips = [
      {
        id: `clip_default_${Date.now()}`,
        name: 'DEFAULT',
        startFrame: 0,
        endFrame: 0,
        fps: 1,
        loop: true
      }
    ];
    animController.setActiveClip(project.clips[0].id);

    const sizeBadge = document.getElementById('canvas-size-badge');
    if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
    const resLabel = document.getElementById('canvas-resolution');
    if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

    canvasEngine.rebuildBuffers();
    canvasEngine.centerViewport();
    onionSkinRenderer.resize(project.width, project.height);
    renderAll();

    syncProjectToServer();

    modal.style.display = 'none';
  };

  btnStep2UseStatic?.addEventListener('click', handleApplyBaseCharToCanvas);
  btnWizardStep2UseStatic?.addEventListener('click', handleApplyBaseCharToCanvas);

  btnStep2Lock?.addEventListener('click', () => {
    if (!baseCharState.seed) return;
    baseCharState.locked = true;

    if (animBaseBadge) {
      animBaseBadge.innerText = `Đã chốt mẫu #${baseCharState.seed}`;
      animBaseBadge.style.color = '#4ade80';
      animBaseBadge.style.borderColor = '#22c55e';
    }

    // Chuyển ngay sang Bước 3
    goToStep(3);
  });

  // Tải ảnh mẫu từ máy tính tại Bước 1 và Bước 2 của AI Wizard
  const btnWizardUploadBase = document.getElementById('btn-wizard-upload-base');
  const btnStep2UploadChar = document.getElementById('btn-step2-upload-char');
  const wizardBaseUploadInput = document.getElementById('wizard-base-upload-input') as HTMLInputElement | null;

  const handleUploadBaseChar = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const isStrip = img.width >= img.height * 1.5;
        const frameW = isStrip ? img.height : img.width;
        const frameH = img.height;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = frameW;
        offCanvas.height = frameH;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, frameW, frameH, 0, 0, frameW, frameH);
        const imgData = ctx.getImageData(0, 0, frameW, frameH);
        const data = imgData.data;

        const pixels: PixelPoint[] = [];
        for (let y = 0; y < frameH; y++) {
          for (let x = 0; x < frameW; x++) {
            const idx = (y * frameW + x) * 4;
            const a = data[idx + 3];
            if (a > 20) {
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              pixels.push({ x, y, color: hex });
            }
          }
        }

        baseCharState.prompt = `Import: ${file.name.slice(0, 16)}`;
        baseCharState.seed = Math.floor(Math.random() * 900000000) + 100000000;
        baseCharState.pixels = pixels;
        baseCharState.width = frameW;
        baseCharState.height = frameH;
        baseCharState.dataUrl = offCanvas.toDataURL('image/png');
        baseCharState.locked = false;

        goToStep(2);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  btnWizardUploadBase?.addEventListener('click', () => {
    if (wizardBaseUploadInput) {
      wizardBaseUploadInput.value = '';
      wizardBaseUploadInput.click();
    }
  });

  btnStep2UploadChar?.addEventListener('click', () => {
    if (wizardBaseUploadInput) {
      wizardBaseUploadInput.value = '';
      wizardBaseUploadInput.click();
    }
  });

  wizardBaseUploadInput?.addEventListener('change', () => {
    const file = wizardBaseUploadInput.files?.[0];
    if (file) handleUploadBaseChar(file);
  });

  globalOpenAiWizardWithBaseChar = (pixels, w, h, name) => {
    baseCharState.prompt = `Import: ${name.slice(0, 16)}`;
    baseCharState.seed = Math.floor(Math.random() * 900000000) + 100000000;
    baseCharState.pixels = pixels;
    baseCharState.width = w;
    baseCharState.height = h;
    baseCharState.dataUrl = renderPixelsToDataUrl(pixels, w, h);
    baseCharState.locked = false;
    modal.style.display = 'flex';
    goToStep(2);
  };

  // ========================================================
  // BỘ CẮT LƯỚI SPRITE SHEET & XEM TRƯỚC CHUYỂN ĐỘNG (BƯỚC 2)
  // ========================================================
  const btnStep2ToggleSlicer = document.getElementById('btn-step2-toggle-slicer');
  const step2SlicerPanel = document.getElementById('step2-slicer-panel');
  const slicerInteractiveCanvas = document.getElementById('slicer-interactive-canvas') as HTMLCanvasElement | null;
  const slicerPlayerCanvas = document.getElementById('slicer-player-canvas') as HTMLCanvasElement | null;
  const slicerFrameIndicator = document.getElementById('slicer-frame-indicator');
  const slicerColsInput = document.getElementById('slicer-cols-input') as HTMLInputElement | null;
  const slicerRowsInput = document.getElementById('slicer-rows-input') as HTMLInputElement | null;
  const slicerFpsSlider = document.getElementById('slicer-fps-slider') as HTMLInputElement | null;
  const slicerFpsLabel = document.getElementById('slicer-fps-label');
  const btnSlicerTogglePlay = document.getElementById('btn-slicer-toggle-play');
  const btnSlicerSelectRow1 = document.getElementById('btn-slicer-select-row1');
  const btnSlicerSelectRow2 = document.getElementById('btn-slicer-select-row2');
  const btnSlicerSelectRow3 = document.getElementById('btn-slicer-select-row3');
  const btnSlicerSelectAll = document.getElementById('btn-slicer-select-all');
  const btnSlicerPickSingle = document.getElementById('btn-slicer-pick-single-as-base');
  const btnSlicerApplyTimeline = document.getElementById('btn-slicer-apply-timeline');
  const slicerGridPresetBtns = document.querySelectorAll('.slicer-grid-preset-btn');

  let slicerCols = 3;
  let slicerRows = 3;
  let slicerSelectedIndices: number[] = [0, 1, 2]; // Mac dinh chon Hang 1 (3 frames)
  let slicerSingleSelectedIdx = 0; // O don dang chon
  let slicerFps = 6;
  let slicerPlaying = true;
  let slicerPlayTimer: any = null;
  let slicerPlayIndex = 0;
  let slicerExtractedCells: {
    index: number;
    col: number;
    row: number;
    x: number;
    y: number;
    w: number;
    h: number;
    pixels: PixelPoint[];
    dataUrl: string;
  }[] = [];

  // Ham cat luoi cac o tu anh mau baseCharState
  const sliceBaseCharGrid = () => {
    if (!baseCharState.pixels || baseCharState.pixels.length === 0) return;
    const totalW = baseCharState.width || 64;
    const totalH = baseCharState.height || 64;
    const cellW = Math.max(1, Math.floor(totalW / slicerCols));
    const cellH = Math.max(1, Math.floor(totalH / slicerRows));

    slicerExtractedCells = [];

    for (let r = 0; r < slicerRows; r++) {
      for (let c = 0; c < slicerCols; c++) {
        const cellIdx = r * slicerCols + c;
        const startX = c * cellW;
        const startY = r * cellH;
        const endX = (c === slicerCols - 1) ? totalW : (c + 1) * cellW;
        const endY = (r === slicerRows - 1) ? totalH : (r + 1) * cellH;
        const w = endX - startX;
        const h = endY - startY;

        const cellPixels: PixelPoint[] = [];
        for (const p of baseCharState.pixels) {
          if (p.x >= startX && p.x < endX && p.y >= startY && p.y < endY) {
            cellPixels.push({
              x: p.x - startX,
              y: p.y - startY,
              color: p.color
            });
          }
        }

        const dataUrl = renderPixelsToDataUrl(cellPixels, w, h);
        slicerExtractedCells.push({
          index: cellIdx,
          col: c,
          row: r,
          x: startX,
          y: startY,
          w,
          h,
          pixels: cellPixels,
          dataUrl
        });
      }
    }

    const maxIdx = slicerCols * slicerRows - 1;
    slicerSelectedIndices = slicerSelectedIndices.filter(i => i <= maxIdx);
    if (slicerSelectedIndices.length === 0) {
      slicerSelectedIndices = Array.from({ length: Math.min(slicerCols, 4) }, (_, i) => i);
    }
    if (slicerSingleSelectedIdx > maxIdx) {
      slicerSingleSelectedIdx = 0;
    }

    renderSlicerInteractiveGrid();
    startSlicerPlayer();
  };

  // Ve luoi tuong tac va cac o duoc chon
  const renderSlicerInteractiveGrid = () => {
    if (!slicerInteractiveCanvas || !baseCharState.pixels) return;
    const ctx = slicerInteractiveCanvas.getContext('2d');
    if (!ctx) return;

    const canvasW = slicerInteractiveCanvas.width;
    const canvasH = slicerInteractiveCanvas.height;
    ctx.clearRect(0, 0, canvasW, canvasH);

    const totalW = baseCharState.width || 64;
    const totalH = baseCharState.height || 64;
    const scale = canvasW / totalW;

    for (const p of baseCharState.pixels) {
      if (!p.color) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * scale, p.y * scale, scale, scale);
    }

    // Ve cac duong chia luoi
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);

    const cellW = (totalW / slicerCols) * scale;
    const cellH = (totalH / slicerRows) * scale;

    for (let c = 1; c < slicerCols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, canvasH);
      ctx.stroke();
    }
    for (let r = 1; r < slicerRows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(canvasW, r * cellH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Highlight cac o duoc chon
    for (let r = 0; r < slicerRows; r++) {
      for (let c = 0; c < slicerCols; c++) {
        const cellIdx = r * slicerCols + c;
        const isSelected = slicerSelectedIndices.includes(cellIdx);
        const isSingleSelected = cellIdx === slicerSingleSelectedIdx;

        const x = c * cellW;
        const y = r * cellH;

        if (isSelected) {
          ctx.fillStyle = 'rgba(74, 222, 128, 0.22)';
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);

          const seqOrder = slicerSelectedIndices.indexOf(cellIdx) + 1;
          ctx.fillStyle = '#4ade80';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${seqOrder}`, x + 4, y + 12);
        }

        if (isSingleSelected) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
        }
      }
    }
  };

  // Trinh phat hoat anh chuyen dong tu cac o da chon
  const startSlicerPlayer = () => {
    if (slicerPlayTimer) clearInterval(slicerPlayTimer);
    if (!slicerPlayerCanvas || slicerSelectedIndices.length === 0 || slicerExtractedCells.length === 0) return;

    const ctx = slicerPlayerCanvas.getContext('2d');
    if (!ctx) return;

    slicerPlayTimer = setInterval(() => {
      if (!slicerPlaying) return;
      if (slicerSelectedIndices.length === 0) return;

      const activeCellIdx = slicerSelectedIndices[slicerPlayIndex % slicerSelectedIndices.length];
      const cell = slicerExtractedCells.find(c => c.index === activeCellIdx);

      if (cell && slicerPlayerCanvas) {
        ctx.clearRect(0, 0, slicerPlayerCanvas.width, slicerPlayerCanvas.height);
        const scale = slicerPlayerCanvas.width / cell.w;
        for (const p of cell.pixels) {
          if (!p.color) continue;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x * scale, p.y * scale, scale, scale);
        }
      }

      if (slicerFrameIndicator) {
        const curr = (slicerPlayIndex % slicerSelectedIndices.length) + 1;
        slicerFrameIndicator.innerText = `Frame: ${curr}/${slicerSelectedIndices.length} (Ô #${activeCellIdx + 1})`;
      }

      slicerPlayIndex++;
    }, Math.max(30, Math.floor(1000 / slicerFps)));
  };

  // Click chuot len luoi de chon hoac bo chon o
  slicerInteractiveCanvas?.addEventListener('click', (e) => {
    if (!slicerInteractiveCanvas || !baseCharState.pixels) return;
    const rect = slicerInteractiveCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cellW = slicerInteractiveCanvas.width / slicerCols;
    const cellH = slicerInteractiveCanvas.height / slicerRows;

    const c = Math.max(0, Math.min(slicerCols - 1, Math.floor(clickX / cellW)));
    const r = Math.max(0, Math.min(slicerRows - 1, Math.floor(clickY / cellH)));
    const cellIdx = r * slicerCols + c;

    slicerSingleSelectedIdx = cellIdx;

    const pos = slicerSelectedIndices.indexOf(cellIdx);
    if (pos >= 0) {
      if (slicerSelectedIndices.length > 1) {
        slicerSelectedIndices.splice(pos, 1);
      }
    } else {
      slicerSelectedIndices.push(cellIdx);
      slicerSelectedIndices.sort((a, b) => a - b);
    }

    renderSlicerInteractiveGrid();
    slicerPlayIndex = 0;
    startSlicerPlayer();
  });

  // Bat tat bang dieu khien chia luoi
  btnStep2ToggleSlicer?.addEventListener('click', () => {
    if (!step2SlicerPanel) return;
    const isShowing = step2SlicerPanel.style.display === 'flex';
    step2SlicerPanel.style.display = isShowing ? 'none' : 'flex';
    if (!isShowing) {
      sliceBaseCharGrid();
    }
  });

  // Chon nhanh preset luoi
  slicerGridPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      slicerGridPresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cols = parseInt(btn.getAttribute('data-cols') || '3', 10);
      const rows = parseInt(btn.getAttribute('data-rows') || '3', 10);
      slicerCols = cols;
      slicerRows = rows;
      if (slicerColsInput) slicerColsInput.value = `${cols}`;
      if (slicerRowsInput) slicerRowsInput.value = `${rows}`;

      slicerSelectedIndices = Array.from({ length: cols }, (_, i) => i);
      slicerSingleSelectedIdx = 0;

      sliceBaseCharGrid();
    });
  });

  slicerColsInput?.addEventListener('change', () => {
    slicerCols = Math.max(1, Math.min(16, parseInt(slicerColsInput.value, 10) || 3));
    sliceBaseCharGrid();
  });

  slicerRowsInput?.addEventListener('change', () => {
    slicerRows = Math.max(1, Math.min(16, parseInt(slicerRowsInput.value, 10) || 3));
    sliceBaseCharGrid();
  });

  // Chon nhanh cac hang
  btnSlicerSelectRow1?.addEventListener('click', () => {
    slicerSelectedIndices = Array.from({ length: slicerCols }, (_, i) => i);
    renderSlicerInteractiveGrid();
    slicerPlayIndex = 0;
    startSlicerPlayer();
  });

  btnSlicerSelectRow2?.addEventListener('click', () => {
    if (slicerRows >= 2) {
      slicerSelectedIndices = Array.from({ length: slicerCols }, (_, i) => slicerCols + i);
    }
    renderSlicerInteractiveGrid();
    slicerPlayIndex = 0;
    startSlicerPlayer();
  });

  btnSlicerSelectRow3?.addEventListener('click', () => {
    if (slicerRows >= 3) {
      slicerSelectedIndices = Array.from({ length: slicerCols }, (_, i) => slicerCols * 2 + i);
    }
    renderSlicerInteractiveGrid();
    slicerPlayIndex = 0;
    startSlicerPlayer();
  });

  btnSlicerSelectAll?.addEventListener('click', () => {
    slicerSelectedIndices = Array.from({ length: slicerCols * slicerRows }, (_, i) => i);
    renderSlicerInteractiveGrid();
    slicerPlayIndex = 0;
    startSlicerPlayer();
  });

  // Toc do FPS
  slicerFpsSlider?.addEventListener('input', () => {
    slicerFps = parseInt(slicerFpsSlider.value, 10) || 6;
    if (slicerFpsLabel) slicerFpsLabel.innerText = `${slicerFps} FPS`;
    startSlicerPlayer();
  });

  btnSlicerTogglePlay?.addEventListener('click', () => {
    slicerPlaying = !slicerPlaying;
    if (btnSlicerTogglePlay) {
      btnSlicerTogglePlay.innerText = slicerPlaying ? 'Tạm dừng' : 'Phát tiếp';
    }
  });

  // Dat 1 o dang chon lam nhan vat mau chuan de sang Buoc 3 Rigging
  btnSlicerPickSingle?.addEventListener('click', () => {
    const cell = slicerExtractedCells.find(c => c.index === slicerSingleSelectedIdx);
    if (!cell) {
      alert('Vui lòng nhấp chọn 1 ô trên lưới để làm mẫu chuẩn!');
      return;
    }

    baseCharState.pixels = cell.pixels;
    baseCharState.width = cell.w;
    baseCharState.height = cell.h;
    baseCharState.dataUrl = cell.dataUrl;
    baseCharState.locked = true;

    if (animBaseImg) {
      animBaseImg.src = cell.dataUrl;
    }
    if (animBaseBadge) {
      animBaseBadge.innerText = `Đã chốt ô #${cell.index + 1} (${cell.w}x${cell.h}px)`;
      animBaseBadge.style.color = '#4ade80';
      animBaseBadge.style.borderColor = '#22c55e';
    }

    goToStep(3);
  });

  // Nap toan bo chuoi cac frame da cat vao Timeline Studio
  btnSlicerApplyTimeline?.addEventListener('click', () => {
    if (slicerSelectedIndices.length === 0 || slicerExtractedCells.length === 0) {
      alert('Chưa có frame nào được chọn để nạp vào Timeline!');
      return;
    }

    const selectedCells = slicerSelectedIndices
      .map(idx => slicerExtractedCells.find(c => c.index === idx))
      .filter((c): c is typeof slicerExtractedCells[0] => !!c);

    if (selectedCells.length === 0) return;

    const frameW = selectedCells[0].w;
    const frameH = selectedCells[0].h;

    project.width = frameW;
    project.height = frameH;

    const newFrames = selectedCells.map((cell, idx) => {
      const pixelsRecord: Record<string, PixelColor> = {};
      for (const p of cell.pixels) {
        if (p.color) {
          pixelsRecord[coordToKey(p.x, p.y)] = p.color;
        }
      }
      return {
        id: `frame_${idx + 1}_${Date.now()}`,
        durationMs: Math.round(1000 / slicerFps),
        layers: [
          {
            id: `layer_1_${Date.now()}_${idx}`,
            name: `Frame ${idx + 1} (Ô #${cell.index + 1})`,
            visible: true,
            locked: false,
            opacity: 1.0,
            pixels: pixelsRecord
          }
        ]
      };
    });

    project.frames = newFrames;
    project.activeFrameIndex = 0;
    project.activeLayerId = newFrames[0].layers[0].id;
    project.clips = [
      {
        id: `clip_spritesheet_${Date.now()}`,
        name: 'SPRITE_CYCLE',
        startFrame: 0,
        endFrame: newFrames.length - 1,
        fps: slicerFps,
        loop: true
      }
    ];
    animController.setActiveClip(project.clips[0].id);

    const sizeBadge = document.getElementById('canvas-size-badge');
    if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
    const resLabel = document.getElementById('canvas-resolution');
    if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

    canvasEngine.rebuildBuffers();
    canvasEngine.centerViewport();
    onionSkinRenderer.resize(project.width, project.height);
    renderAll();

    syncProjectToServer();

    modal.style.display = 'none';
  });

  // ==========================================
  // XỬ LÝ BƯỚC 3: CẤU HÌNH HOẠT CẢNH
  // ==========================================
  const animEngineCards = document.querySelectorAll('.anim-engine-card');
  const actionCards = document.querySelectorAll('.anim-action-card');
  const frameBtns = document.querySelectorAll('.anim-frame-btn');
  const aiStrengthPanel = document.getElementById('ai-strength-panel');
  const aiStrengthSlider = document.getElementById('ai-strength-slider') as HTMLInputElement | null;
  const aiStrengthVal = document.getElementById('ai-strength-val');
  const hybridStrengthPanel = document.getElementById('hybrid-strength-panel');
  const hybridStrengthSlider = document.getElementById('hybrid-strength-slider') as HTMLInputElement | null;
  const hybridStrengthVal = document.getElementById('hybrid-strength-val');

  animEngineCards.forEach(card => {
    card.addEventListener('click', () => {
      animEngineCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const eng = (card.getAttribute('data-engine') || 'ai') as 'hybrid' | 'template' | 'ai';
      animSetupState.engine = eng;
      if (aiStrengthPanel) {
        aiStrengthPanel.style.display = eng === 'ai' ? 'flex' : 'none';
      }
      if (hybridStrengthPanel) {
        hybridStrengthPanel.style.display = eng === 'hybrid' ? 'flex' : 'none';
      }
      if (eng === 'ai') {
        animSetupState.refineStrength = parseFloat(aiStrengthSlider?.value || '0.62');
      } else if (eng === 'hybrid') {
        animSetupState.refineStrength = parseFloat(hybridStrengthSlider?.value || '0.38');
      }
      saveWizardCheckpoint();
    });
  });

  aiStrengthSlider?.addEventListener('input', () => {
    const val = parseFloat(aiStrengthSlider.value) || 0.62;
    animSetupState.refineStrength = val;
    if (aiStrengthVal) {
      let desc = 'Chuẩn chuyển động game mượt';
      if (val < 0.55) desc = 'Ưu tiên giữ dáng tĩnh';
      else if (val > 0.68) desc = 'Tư thế vung đòn cực mạnh';
      aiStrengthVal.innerText = `${val.toFixed(2)} (${desc})`;
    }
    saveWizardCheckpoint();
  });

  hybridStrengthSlider?.addEventListener('input', () => {
    const val = parseFloat(hybridStrengthSlider.value) || 0.38;
    animSetupState.refineStrength = val;
    if (hybridStrengthVal) {
      let desc = 'Cân bằng chuẩn';
      if (val < 0.30) desc = 'Ưu tiên giữ nét gốc';
      else if (val > 0.45) desc = 'Ưu tiên vẽ bù sáng tạo';
      hybridStrengthVal.innerText = `${val.toFixed(2)} (${desc})`;
    }
    saveWizardCheckpoint();
  });

  const animSlashVfxContainer = document.getElementById('anim-slash-vfx-container');
  const slashVfxBtns = document.querySelectorAll('.slash-vfx-btn');

  actionCards.forEach(card => {
    card.addEventListener('click', () => {
      actionCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const act = card.getAttribute('data-action') || 'walk';
      animSetupState.action = act;

      // Hien thi tuy chon vet chem chi khi chon hanh dong Attack / Slash
      if (animSlashVfxContainer) {
        animSlashVfxContainer.style.display = (act === 'attack' || act === 'slash') ? 'block' : 'none';
      }

      const suggestedFrames = parseInt(card.getAttribute('data-frames') || '4', 10);
      animSetupState.frameCount = suggestedFrames;

      frameBtns.forEach(btn => {
        const f = parseInt(btn.getAttribute('data-frames') || '4', 10);
        btn.classList.toggle('active', f === suggestedFrames);
      });
      if (isTestingCycle) {
        startTestCycle();
      }
      saveWizardCheckpoint();
    });
  });

  slashVfxBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      slashVfxBtns.forEach(b => {
        b.classList.remove('active');
        (b as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
        (b as HTMLElement).style.color = '#cbd5e1';
      });
      btn.classList.add('active');
      const vfx = (btn.getAttribute('data-vfx') || 'cyan') as 'none' | 'cyan' | 'fire' | 'silver' | 'purple';
      animSetupState.slashVfxType = vfx;
      if (vfx === 'cyan') {
        (btn as HTMLElement).style.borderColor = '#38bdf8';
        (btn as HTMLElement).style.color = '#38bdf8';
      } else if (vfx === 'fire') {
        (btn as HTMLElement).style.borderColor = '#f97316';
        (btn as HTMLElement).style.color = '#f97316';
      } else if (vfx === 'purple') {
        (btn as HTMLElement).style.borderColor = '#c084fc';
        (btn as HTMLElement).style.color = '#c084fc';
      } else if (vfx === 'silver') {
        (btn as HTMLElement).style.borderColor = '#e2e8f0';
        (btn as HTMLElement).style.color = '#ffffff';
      } else if (vfx === 'none') {
        (btn as HTMLElement).style.borderColor = '#64748b';
        (btn as HTMLElement).style.color = '#94a3b8';
      }

      if (isTestingCycle) {
        startTestCycle();
      }
      saveWizardCheckpoint();
    });
  });

  frameBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      frameBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      animSetupState.frameCount = parseInt(btn.getAttribute('data-frames') || '4', 10);
      saveWizardCheckpoint();
    });
  });

  btnStep3ChangeChar?.addEventListener('click', () => {
    goToStep(2);
  });

  // Khoi tao hoac dam bao co SkeletonRig hop le
  const ensureSkeletonRig = () => {
    if (!activeSkeletonRig) {
      if (baseCharState.pixels && baseCharState.pixels.length > 0) {
        activeSkeletonRig = autoEstimateSkeletonRig(
          baseCharState.pixels,
          baseCharState.width || 64,
          baseCharState.height || 64
        );
      } else {
        activeSkeletonRig = autoEstimateSkeletonRig([], 64, 64);
      }
    }
  };

  // Cap nhat danh sach cac khop tu do (Custom Joints) tren Legend
  const renderCustomJointsLegend = () => {
    if (!customJointsList || !customJointsSection || !activeSkeletonRig) return;
    const customEntries = Object.entries(activeSkeletonRig.joints).filter(([_, pin]) => pin.custom);

    if (customEntries.length === 0) {
      customJointsSection.style.display = 'none';
      customJointsList.innerHTML = '';
      return;
    }

    customJointsSection.style.display = 'block';
    customJointsList.innerHTML = '';

    for (const [id, pin] of customEntries) {
      const item = document.createElement('div');
      item.className = `joint-legend-item ${selectedJointId === id ? 'selected' : ''}`;
      item.setAttribute('data-joint', id);
      item.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 3px 6px; background: #13131a; border-radius: 4px; border: 1px solid rgba(255,255,255,0.06); cursor: pointer;';

      const dot = document.createElement('span');
      dot.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: ${pin.color}; display: inline-block; flex-shrink: 0;`;

      const title = document.createElement('span');
      title.style.cssText = `color: ${pin.color}; font-weight: 500; font-size: 10px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
      title.innerText = pin.name;

      const removeBtn = document.createElement('span');
      removeBtn.className = 'btn-remove-custom-joint';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Xóa khớp này';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteJointById(id);
      });

      item.appendChild(dot);
      item.appendChild(title);
      item.appendChild(removeBtn);

      item.addEventListener('click', () => {
        selectedJointId = id;
        highlightLegendItem(id);
        renderJointPinningView();
      });

      item.addEventListener('mouseenter', () => {
        hoveredJointId = id;
        renderJointPinningView();
      });

      item.addEventListener('mouseleave', () => {
        if (hoveredJointId === id) {
          hoveredJointId = null;
          renderJointPinningView();
        }
      });

      customJointsList.appendChild(item);
    }
  };

  // Ve nhan vat mau va cac khop xuong len Canvas 384x384
  const renderJointPinningView = () => {
    if (!jointCanvas || !jointOverlay) return;
    const ctx = jointCanvas.getContext('2d');
    const oCtx = jointOverlay.getContext('2d');
    if (!ctx || !oCtx) return;

    const w = jointCanvas.width; // 384 px
    const h = jointCanvas.height; // 384 px
    const charW = baseCharState.width || 64;
    const charH = baseCharState.height || 64;
    const scale = w / charW; // 6x scale

    // 1. Ve nen va nhan vat mau phong to
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, w, h);

    // Ve o ban co (Checkerboard) de nhin ro vung trong suot
    ctx.fillStyle = '#11131c';
    const gridSize = 16;
    for (let y = 0; y < h; y += gridSize) {
      for (let x = 0; x < w; x += gridSize) {
        if ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 1) {
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }
    }

    // Ve tung pixel cua nhan vat mau
    if (baseCharState.pixels) {
      for (const p of baseCharState.pixels) {
        if (!p.color) continue;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x * scale, p.y * scale, scale, scale);
      }
    }

    // 2. Ve khung xuong va luoi tren lop phu Overlay
    oCtx.clearRect(0, 0, w, h);

    // a. Ve Luoi Pixel Grid neu duoc bat
    if (showRigGrid) {
      oCtx.save();
      oCtx.lineWidth = 0.6;
      oCtx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      for (let x = 0; x <= w; x += scale) {
        oCtx.beginPath();
        oCtx.moveTo(x, 0);
        oCtx.lineTo(x, h);
        oCtx.stroke();
      }
      for (let y = 0; y <= h; y += scale) {
        oCtx.beginPath();
        oCtx.moveTo(0, y);
        oCtx.lineTo(w, y);
        oCtx.stroke();
      }
      oCtx.restore();
    }

    if (!activeSkeletonRig) return;

    // b. Ve cac doan xuong (Bones)
    oCtx.lineCap = 'round';
    oCtx.lineJoin = 'round';

    for (const [fromId, toId] of activeSkeletonRig.bones) {
      const fromJoint = activeSkeletonRig.joints[fromId];
      const toJoint = activeSkeletonRig.joints[toId];
      if (!fromJoint || !toJoint) continue;

      const x1 = fromJoint.x * scale + scale / 2;
      const y1 = fromJoint.y * scale + scale / 2;
      const x2 = toJoint.x * scale + scale / 2;
      const y2 = toJoint.y * scale + scale / 2;

      // Xac dinh mau sac xuong theo cap doan OpenPose
      let boneColor = 'rgba(56, 189, 248, 0.6)';
      if (toId.startsWith('left_arm') || toId.includes('left_shoulder') || toId.includes('left_elbow') || toId.includes('left_wrist')) {
        boneColor = 'rgba(249, 115, 22, 0.65)'; // Vang cam
      } else if (toId.includes('right_shoulder') || toId.includes('right_elbow') || toId.includes('right_wrist')) {
        boneColor = 'rgba(34, 197, 94, 0.65)'; // Xanh la
      } else if (toId.includes('left_hip') || toId.includes('left_knee') || toId.includes('left_foot')) {
        boneColor = 'rgba(6, 182, 212, 0.65)'; // Xanh ngoc
      } else if (toId.includes('right_hip') || toId.includes('right_knee') || toId.includes('right_foot')) {
        boneColor = 'rgba(168, 85, 247, 0.65)'; // Tim
      } else if (toId === 'weapon') {
        boneColor = 'rgba(244, 63, 94, 0.65)'; // Do hong
      } else if (toJoint.custom) {
        boneColor = 'rgba(16, 185, 129, 0.65)'; // Xanh luc tu do
      }

      // Duong vien bong mo
      oCtx.save();
      oCtx.strokeStyle = boneColor;
      oCtx.lineWidth = 4;
      oCtx.beginPath();
      oCtx.moveTo(x1, y1);
      oCtx.lineTo(x2, y2);
      oCtx.stroke();
      oCtx.restore();
    }

    // c. Ve cac diem chot khop (Joint Pins)
    for (const key of Object.keys(activeSkeletonRig.joints)) {
      const pin = activeSkeletonRig.joints[key];
      if (!pin) continue;

      const px = pin.x * scale + scale / 2;
      const py = pin.y * scale + scale / 2;
      const isSelected = selectedJointId === key;
      const isHovered = hoveredJointId === key || draggedJointId === key;
      const radius = isSelected ? 8.5 : (isHovered ? 7.5 : 6);

      oCtx.save();
      // Bong phat sang
      oCtx.shadowColor = pin.color;
      oCtx.shadowBlur = isSelected ? 16 : (isHovered ? 10 : 5);

      // Than chot tron
      oCtx.fillStyle = pin.color;
      oCtx.beginPath();
      oCtx.arc(px, py, radius, 0, Math.PI * 2);
      oCtx.fill();

      // Vien vien den
      oCtx.lineWidth = 2;
      oCtx.strokeStyle = '#05070a';
      oCtx.stroke();

      // Vong vien ngoai khi hover hoac select
      if (isSelected) {
        oCtx.lineWidth = 2;
        oCtx.strokeStyle = '#ffffff';
        oCtx.beginPath();
        oCtx.arc(px, py, radius + 4, 0, Math.PI * 2);
        oCtx.stroke();

        // Tieu de khop noi bat
        oCtx.font = 'bold 10px monospace';
        oCtx.fillStyle = '#ffffff';
        oCtx.shadowColor = '#000000';
        oCtx.shadowBlur = 4;
        oCtx.fillText(pin.name.split(' ')[0], px + 12, py + 3);
      } else if (isHovered) {
        oCtx.lineWidth = 1.5;
        oCtx.strokeStyle = pin.color;
        oCtx.beginPath();
        oCtx.arc(px, py, radius + 3, 0, Math.PI * 2);
        oCtx.stroke();
      }

      oCtx.restore();
    }
  };

  // Tinh toan toa do tu su kien chuot tren Canvas Overlay
  const getCanvasCoords = (e: MouseEvent): { x: number; y: number } => {
    if (!jointOverlay) return { x: 0, y: 0 };
    const rect = jointOverlay.getBoundingClientRect();
    const scaleX = jointOverlay.width / rect.width;
    const scaleY = jointOverlay.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Tim khop gan nhat voi vi tri chuot
  const findJointAt = (canvasX: number, canvasY: number): string | null => {
    if (!activeSkeletonRig) return null;
    const charW = baseCharState.width || 64;
    const scale = 384 / charW;
    const hitRadius = 16;

    let closest: string | null = null;
    let minDist = hitRadius;

    for (const key of Object.keys(activeSkeletonRig.joints)) {
      const pin = activeSkeletonRig.joints[key];
      if (!pin) continue;
      const px = pin.x * scale + scale / 2;
      const py = pin.y * scale + scale / 2;
      const dist = Math.hypot(canvasX - px, canvasY - py);
      if (dist < minDist) {
        minDist = dist;
        closest = key;
      }
    }
    return closest;
  };

  const highlightLegendItem = (jointId: string | null) => {
    jointLegendItems.forEach(item => {
      const j = item.getAttribute('data-joint');
      item.classList.toggle('selected', j === jointId);
      item.classList.toggle('active', j === jointId);
    });

    if (customJointsList) {
      customJointsList.querySelectorAll('.joint-legend-item').forEach(item => {
        const j = item.getAttribute('data-joint');
        item.classList.toggle('selected', j === jointId);
        item.classList.toggle('active', j === jointId);
      });
    }
  };

  // Xoa mot khop khoi Skeleton Rig
  const deleteJointById = (targetId: string) => {
    if (!activeSkeletonRig) return;
    if (targetId === 'chest') {
      alert('Không thể xóa khớp Ngực (Chest) vì đây là khớp gốc của toàn bộ cơ thể!');
      return;
    }

    delete activeSkeletonRig.joints[targetId];
    activeSkeletonRig.bones = activeSkeletonRig.bones.filter(
      ([from, to]) => from !== targetId && to !== targetId
    );

    if (selectedJointId === targetId) {
      selectedJointId = null;
    }
    if (hoveredJointId === targetId) {
      hoveredJointId = null;
    }

    highlightLegendItem(null);
    renderCustomJointsLegend();
    renderJointPinningView();
    saveWizardCheckpoint();
  };

  // Bat su kien click / drag tren Canvas Overlay
  jointOverlay?.addEventListener('mousedown', (e) => {
    if (isTestingCycle) stopTestCycle();
    const { x, y } = getCanvasCoords(e);
    const hit = findJointAt(x, y);

    // Neu dang o che do Them Khop
    if (isAddingJoint) {
      const charW = baseCharState.width || 64;
      const charH = baseCharState.height || 64;
      const scale = 384 / charW;
      const px = Math.max(0, Math.min(charW - 1, Math.round((x - scale / 2) / scale)));
      const py = Math.max(0, Math.min(charH - 1, Math.round((y - scale / 2) / scale)));

      const customId = `custom_${Date.now()}`;
      const parentId = selectedJointId && activeSkeletonRig?.joints[selectedJointId]
        ? selectedJointId
        : (activeSkeletonRig?.joints.chest ? 'chest' : 'hips');

      const customColors = ['#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#14b8a6'];
      const pickColor = customColors[Math.floor(Math.random() * customColors.length)];
      const customCount = Object.keys(activeSkeletonRig?.joints || {}).filter(k => activeSkeletonRig?.joints[k].custom).length + 1;

      if (activeSkeletonRig) {
        activeSkeletonRig.joints[customId] = {
          id: customId,
          name: `Khớp Tự Do ${customCount}`,
          x: px,
          y: py,
          color: pickColor,
          parent: parentId,
          custom: true
        };
        activeSkeletonRig.bones.push([parentId, customId]);
      }

      selectedJointId = customId;
      isAddingJoint = false;
      btnRigAddJoint?.classList.remove('active');
      jointOverlay.style.cursor = 'crosshair';

      renderCustomJointsLegend();
      highlightLegendItem(customId);
      renderJointPinningView();
      saveWizardCheckpoint();
      return;
    }

    // Neu nhap trung khop
    if (hit) {
      draggedJointId = hit;
      selectedJointId = hit;
      jointOverlay.style.cursor = 'grabbing';
      highlightLegendItem(hit);
      renderJointPinningView();
    } else {
      selectedJointId = null;
      highlightLegendItem(null);
      renderJointPinningView();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!jointOverlay || !activeSkeletonRig) return;
    const { x, y } = getCanvasCoords(e);

    if (draggedJointId) {
      const charW = baseCharState.width || 64;
      const charH = baseCharState.height || 64;
      const scale = 384 / charW;

      const px = Math.max(0, Math.min(charW - 1, Math.round((x - scale / 2) / scale)));
      const py = Math.max(0, Math.min(charH - 1, Math.round((y - scale / 2) / scale)));

      activeSkeletonRig.joints[draggedJointId].x = px;
      activeSkeletonRig.joints[draggedJointId].y = py;

      renderJointPinningView();

      if (jointTooltip) {
        const pin = activeSkeletonRig.joints[draggedJointId];
        jointTooltip.style.display = 'block';
        jointTooltip.style.left = `${Math.min(320, Math.max(10, x + 14))}px`;
        jointTooltip.style.top = `${Math.min(340, Math.max(10, y - 24))}px`;
        jointTooltip.innerText = `${pin.name}: (${px}, ${py})`;
      }
    } else if (!isAddingJoint) {
      const hit = findJointAt(x, y);
      if (hit !== hoveredJointId) {
        hoveredJointId = hit;
        jointOverlay.style.cursor = hit ? 'grab' : 'crosshair';
        renderJointPinningView();

        if (hit && jointTooltip) {
          const pin = activeSkeletonRig.joints[hit];
          jointTooltip.style.display = 'block';
          jointTooltip.style.left = `${Math.min(320, Math.max(10, x + 14))}px`;
          jointTooltip.style.top = `${Math.min(340, Math.max(10, y - 24))}px`;
          jointTooltip.innerText = `${pin.name}: (${pin.x}, ${pin.y})`;
        } else if (jointTooltip) {
          jointTooltip.style.display = 'none';
        }
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (draggedJointId) {
      draggedJointId = null;
      if (jointOverlay) jointOverlay.style.cursor = hoveredJointId ? 'grab' : (isAddingJoint ? 'copy' : 'crosshair');
      if (jointTooltip) jointTooltip.style.display = 'none';
      saveWizardCheckpoint();
    }
  });

  // Ban phim ho tro: Bam Delete hoac Backspace de xoa khop dang chon
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedJointId) {
      // Chi thuc thi khi Step 3 Rigging dang hien thi
      if (step3RiggingPanel && step3RiggingPanel.style.display !== 'none') {
        e.preventDefault();
        deleteJointById(selectedJointId);
      }
    }
  });

  // Gan su kien click cho cac khop tren Legend co dinh
  jointLegendItems.forEach(item => {
    const j = item.getAttribute('data-joint');
    item.addEventListener('click', () => {
      selectedJointId = j;
      highlightLegendItem(j);
      renderJointPinningView();
    });
    item.addEventListener('mouseenter', () => {
      if (j) {
        hoveredJointId = j;
        renderJointPinningView();
      }
    });
    item.addEventListener('mouseleave', () => {
      if (hoveredJointId === j) {
        hoveredJointId = null;
        renderJointPinningView();
      }
    });
  });

  // Nut Bat/Tat Them Khop
  btnRigAddJoint?.addEventListener('click', () => {
    isAddingJoint = !isAddingJoint;
    btnRigAddJoint.classList.toggle('active', isAddingJoint);
    if (jointOverlay) {
      jointOverlay.style.cursor = isAddingJoint ? 'copy' : 'crosshair';
    }
  });

  // Nut Xoa Khop Dang Chon
  btnRigDeleteJoint?.addEventListener('click', () => {
    if (!selectedJointId) {
      alert('Vui lòng chọn một khớp trên ảnh hoặc trong danh sách trước khi xóa!');
      return;
    }
    deleteJointById(selectedJointId);
  });

  // Nut Bat/Tat Luoi Pixel
  btnRigToggleGrid?.addEventListener('click', () => {
    showRigGrid = !showRigGrid;
    btnRigToggleGrid.classList.toggle('active', showRigGrid);
    renderJointPinningView();
  });

  // Cac nut Zoom (1x, 1.5x, 2x)
  rigZoomBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rigZoomBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const zoom = parseFloat(btn.getAttribute('data-zoom') || '1');
      rigZoomScale = zoom;

      const baseSize = 384;
      const targetSize = `${baseSize * zoom}px`;

      if (jointPinningWrapper) {
        jointPinningWrapper.style.width = targetSize;
        jointPinningWrapper.style.height = targetSize;
      }
      if (jointCanvas) {
        jointCanvas.style.width = targetSize;
        jointCanvas.style.height = targetSize;
      }
      if (jointOverlay) {
        jointOverlay.style.width = targetSize;
        jointOverlay.style.height = targetSize;
      }
    });
  });

  // Nut Tu Dong Can Khop OpenPose Chuẩn
  btnRigAutoAlign?.addEventListener('click', () => {
    stopTestCycle();
    if (baseCharState.pixels) {
      activeSkeletonRig = autoEstimateSkeletonRig(
        baseCharState.pixels,
        baseCharState.width || 64,
        baseCharState.height || 64
      );
      selectedJointId = null;
      renderCustomJointsLegend();
      highlightLegendItem(null);
      renderJointPinningView();
      saveWizardCheckpoint();
    }
  });

  // Xem Thu Chuyen Dong (Test Cycle) ho tro day du moi hanh dong theo khung xuong OpenPose
  const stopTestCycle = () => {
    if (testCycleTimer) {
      clearInterval(testCycleTimer);
      testCycleTimer = null;
    }
    isTestingCycle = false;
    if (btnRigTestCycle) {
      btnRigTestCycle.innerText = 'Xem Thử Chuyển Động';
      btnRigTestCycle.style.background = 'rgba(56, 189, 248, 0.15)';
    }
    renderJointPinningView();
  };

  const startTestCycle = () => {
    if (!baseCharState.pixels || baseCharState.pixels.length === 0) return;
    ensureSkeletonRig();
    isTestingCycle = true;
    if (btnRigTestCycle) {
      btnRigTestCycle.innerText = 'Dừng Xem Thử';
      btnRigTestCycle.style.background = 'rgba(239, 68, 68, 0.2)';
    }

    const charW = baseCharState.width || 64;
    const charH = baseCharState.height || 64;
    const scale = 384 / charW;
    testCycleFrame = 0;

    const rig = activeSkeletonRig!;
    const neckY = rig.joints.neck?.y ?? Math.floor(charH * 0.25);
    const chestY = rig.joints.chest?.y ?? Math.floor(charH * 0.38);
    const hipsY = rig.joints.hips?.y ?? Math.floor(charH * 0.58);
    const hipsX = rig.joints.hips?.x ?? Math.floor(charW / 2);
    const centerX = Math.floor(charW / 2);

    const leftShoulder = rig.joints.left_shoulder || { x: centerX - 8, y: neckY };
    const rightShoulder = rig.joints.right_shoulder || { x: centerX + 8, y: neckY };
    const leftElbow = rig.joints.left_elbow || { x: leftShoulder.x - 3, y: chestY };
    const rightElbow = rig.joints.right_elbow || { x: rightShoulder.x + 3, y: chestY };
    const leftWrist = rig.joints.left_wrist || { x: leftElbow.x - 2, y: hipsY };
    const rightWrist = rig.joints.right_wrist || { x: rightElbow.x + 2, y: hipsY };
    const weaponJoint = rig.joints.weapon || { x: rightWrist.x + 4, y: rightWrist.y };
    const leftKnee = rig.joints.left_knee || { x: hipsX - 6, y: Math.floor(charH * 0.78) };
    const rightKnee = rig.joints.right_knee || { x: hipsX + 6, y: Math.floor(charH * 0.78) };
    const wristY = Math.max(leftWrist.y, rightWrist.y);

    const distToSeg = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(px - x1, py - y1);
      let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    };

    const classifyPt = (p: PixelPoint) => {
      if (weaponJoint && Math.hypot(p.x - weaponJoint.x, p.y - weaponJoint.y) <= 4.5) return 'WEAPON';
      if (p.y <= neckY + 1 && Math.abs(p.x - centerX) <= charW * 0.4) return 'HEAD';
      if (p.y <= hipsY) {
        const dL = Math.min(distToSeg(p.x, p.y, leftShoulder.x, leftShoulder.y, leftElbow.x, leftElbow.y), distToSeg(p.x, p.y, leftElbow.x, leftElbow.y, leftWrist.x, leftWrist.y));
        const dR = Math.min(distToSeg(p.x, p.y, rightShoulder.x, rightShoulder.y, rightElbow.x, rightElbow.y), distToSeg(p.x, p.y, rightElbow.x, rightElbow.y, rightWrist.x, rightWrist.y));
        if (p.x < leftShoulder.x + 1 && (dL <= 5.5 || p.x < centerX - charW * 0.22)) return 'LEFT_ARM';
        if (p.x > rightShoulder.x - 1 && (dR <= 5.5 || p.x > centerX + charW * 0.22)) return 'RIGHT_ARM';
        if (p.y <= chestY) return 'CHEST';
        return 'WAIST';
      }
      if (p.x <= hipsX) {
        return p.y <= leftKnee.y ? 'LEFT_LEG_UPPER' : 'LEFT_LEG_LOWER';
      } else {
        return p.y <= rightKnee.y ? 'RIGHT_LEG_UPPER' : 'RIGHT_LEG_LOWER';
      }
    };

    const action = animSetupState.action.toLowerCase();
    const totalFrames = animSetupState.frameCount || 4;

    testCycleTimer = setInterval(() => {
      if (!jointCanvas || !activeSkeletonRig) return;
      const ctx = jointCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, 384, 384);
      ctx.fillStyle = '#08090d';
      ctx.fillRect(0, 0, 384, 384);

      // Ve checkerboard nhe
      ctx.fillStyle = '#11131c';
      const gridSize = 16;
      for (let y = 0; y < 384; y += gridSize) {
        for (let x = 0; x < 384; x += gridSize) {
          if ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 1) {
            ctx.fillRect(x, y, gridSize, gridSize);
          }
        }
      }

      const fIdx = testCycleFrame % totalFrames;

      if (action === 'jump') {
        let dChestY = 0;
        let dWaistY = 0;
        let dLegUpperY = 0;
        let dLegLowerY = 0;
        let dArmY = 0;
        let dArmDx = 0;

        if (fIdx === 0) {
          dChestY = 2; dWaistY = 3; dLegUpperY = 3; dLegLowerY = 0; dArmY = 1; dArmDx = 2;
        } else if (fIdx === 1) {
          dChestY = -7; dWaistY = -6; dLegUpperY = -7; dLegLowerY = -9; dArmY = -10; dArmDx = -1;
        } else if (fIdx === 2) {
          dChestY = -4; dWaistY = -3; dLegUpperY = -4; dLegLowerY = -4; dArmY = -5; dArmDx = 0;
        } else {
          dChestY = 2; dWaistY = 3; dLegUpperY = 3; dLegLowerY = 0; dArmY = 0; dArmDx = -2;
        }

        for (const p of baseCharState.pixels!) {
          if (!p.color) continue;
          const part = classifyPt(p);
          let tx = p.x;
          let ty = p.y;
          switch (part) {
            case 'HEAD':
            case 'CHEST': ty += dChestY; break;
            case 'WAIST': ty += dWaistY; break;
            case 'LEFT_ARM': tx -= dArmDx; ty += dArmY; break;
            case 'RIGHT_ARM':
            case 'WEAPON': tx += dArmDx; ty += dArmY; break;
            case 'LEFT_LEG_UPPER': tx -= (fIdx === 0 || fIdx === 3 ? 1 : 0); ty += dLegUpperY; break;
            case 'RIGHT_LEG_UPPER': tx += (fIdx === 0 || fIdx === 3 ? 1 : 0); ty += dLegUpperY; break;
            case 'LEFT_LEG_LOWER':
            case 'RIGHT_LEG_LOWER': ty += dLegLowerY; break;
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }

      } else if (action === 'attack' || action === 'slash') {
        let bodyDx = 0, bodyDy = 0, swordDx = 0, swordDy = 0, offDx = 0, offDy = 0;
        if (fIdx === 0) {
          bodyDx = -1; swordDx = -4; swordDy = -4; offDx = 2; offDy = 1;
        } else if (fIdx === 1) {
          bodyDx = 3; bodyDy = 1; swordDx = 6; swordDy = 3; offDx = -3; offDy = 2;
        } else if (fIdx === 2) {
          bodyDx = 2; bodyDy = 1; swordDx = 4; swordDy = 4; offDx = -1;
        }

        for (const p of baseCharState.pixels!) {
          if (!p.color) continue;
          const part = classifyPt(p);
          let tx = p.x;
          let ty = p.y;
          switch (part) {
            case 'HEAD':
            case 'CHEST':
            case 'WAIST': tx += bodyDx; ty += bodyDy; break;
            case 'RIGHT_ARM':
            case 'WEAPON': tx += swordDx; ty += swordDy; break;
            case 'LEFT_ARM': tx += offDx; ty += offDy; break;
            case 'LEFT_LEG_UPPER':
            case 'LEFT_LEG_LOWER': tx += (fIdx === 1 ? -1 : 0); break;
            case 'RIGHT_LEG_UPPER':
            case 'RIGHT_LEG_LOWER': tx += (fIdx === 1 ? 2 : (fIdx === 0 ? -1 : 0)); break;
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }

        // Vet chem quang (Slash VFX) tai Frame 1
        if (fIdx === 1 && animSetupState.slashVfxType !== 'none') {
          const arcX = (weaponJoint.x + swordDx - 2) * scale;
          const arcY = (weaponJoint.y + swordDy - 2) * scale;
          const r = Math.max(10, Math.floor(charW * 0.65)) * scale;
          ctx.save();
          let glowColor = '#38bdf8';
          let strokeColor = '#ffffff';
          if (animSetupState.slashVfxType === 'silver') {
            glowColor = '#94a3b8';
            strokeColor = '#ffffff';
          } else if (animSetupState.slashVfxType === 'fire') {
            glowColor = '#f97316';
            strokeColor = '#fef08a';
          } else if (animSetupState.slashVfxType === 'purple') {
            glowColor = '#c084fc';
            strokeColor = '#f5d0fe';
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 4;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(arcX, arcY, r, -1.4, 1.1);
          ctx.stroke();
          ctx.restore();
        }

      } else if (action === 'sit') {
        const isShift = fIdx === 1;
        for (const p of baseCharState.pixels!) {
          if (!p.color) continue;
          const part = classifyPt(p);
          let tx = p.x;
          let ty = p.y;
          switch (part) {
            case 'HEAD':
            case 'CHEST': ty += 6 + (isShift ? 1 : 0); break;
            case 'WAIST': ty += 8 + (isShift ? 1 : 0); break;
            case 'LEFT_ARM':
            case 'RIGHT_ARM':
            case 'WEAPON': ty += 8 + (isShift ? 1 : 0); break;
            case 'LEFT_LEG_UPPER': tx -= 2; ty += 8; break;
            case 'RIGHT_LEG_UPPER': tx += 2; ty += 8; break;
            case 'LEFT_LEG_LOWER':
            case 'RIGHT_LEG_LOWER': ty += 4; break;
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }

      } else if (action === 'defeated') {
        const isFlat = fIdx >= 1;
        for (const p of baseCharState.pixels!) {
          if (!p.color) continue;
          let tx = p.x;
          let ty = p.y;
          if (!isFlat) {
            tx = p.x - Math.round(p.y * 0.1);
            ty = p.y + 4;
          } else {
            const groundY = charH - 4;
            ty = groundY - Math.round((charH - p.y) * 0.25);
            tx = centerX + Math.round((p.y - chestY) * 0.8) + Math.round((p.x - centerX) * 0.5);
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }

      } else if (action === 'run') {
        const t = (fIdx / totalFrames) * 2 * Math.PI;
        const swingMag = 3.6;
        const bodyOffsetY = fIdx % 2 === 1 ? -1 : 0;
        for (const p of baseCharState.pixels!) {
          if (!p.color) continue;
          const part = classifyPt(p);
          let tx = p.x + 1;
          let ty = p.y;
          switch (part) {
            case 'HEAD':
            case 'CHEST': ty += bodyOffsetY; break;
            case 'WAIST': ty += Math.round(bodyOffsetY * 0.5); break;
            case 'LEFT_ARM': {
              const armSwing = -Math.sin(t) * 3.8;
              tx += Math.round(armSwing);
              ty += bodyOffsetY;
              break;
            }
            case 'RIGHT_ARM':
            case 'WEAPON': {
              const armSwing = Math.sin(t) * 3.8;
              tx += Math.round(armSwing);
              ty += bodyOffsetY;
              break;
            }
            case 'LEFT_LEG_UPPER':
            case 'LEFT_LEG_LOWER': {
              tx += Math.round(Math.sin(t) * swingMag);
              break;
            }
            case 'RIGHT_LEG_UPPER':
            case 'RIGHT_LEG_LOWER': {
              tx += Math.round(-Math.sin(t) * swingMag);
              break;
            }
          }
          ctx.fillStyle = p.color;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }

      } else if (action === 'idle') {
        const bodyOffsetY = fIdx % 2 === 1 ? 1 : 0;
        for (const p of baseCharState.pixels!) {
          if (!p.color) continue;
          const part = classifyPt(p);
          let tx = p.x;
          let ty = p.y;
          if (part === 'HEAD' || part === 'CHEST') ty += bodyOffsetY;
          else if (part === 'WAIST' || part === 'LEFT_ARM' || part === 'RIGHT_ARM' || part === 'WEAPON') ty += Math.round(bodyOffsetY * 0.5);
          ctx.fillStyle = p.color;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }

      } else {
        // Walk (Di bo mac dinh)
        const t = (fIdx / totalFrames) * 2 * Math.PI;
        const swingMag = 2.4;
        const bodyOffsetY = fIdx % 2 === 1 ? -1 : 0;

        for (const p of baseCharState.pixels!) {
          if (!p.color) continue;
          const part = classifyPt(p);
          let tx = p.x;
          let ty = p.y;

          if (part === 'HEAD' || part === 'CHEST') {
            ty += bodyOffsetY;
          } else if (part === 'WAIST') {
            const blend = (p.y - chestY) / Math.max(1, hipsY - chestY);
            ty += Math.round(bodyOffsetY * (1 - blend));
          } else if (part === 'LEFT_ARM') {
            tx += Math.round(-Math.sin(t) * 2.2);
            ty += bodyOffsetY;
          } else if (part === 'RIGHT_ARM' || part === 'WEAPON') {
            tx += Math.round(Math.sin(t) * 2.2);
            ty += bodyOffsetY;
          } else if (part === 'LEFT_LEG_UPPER' || part === 'LEFT_LEG_LOWER') {
            tx += Math.round(Math.sin(t) * swingMag);
          } else {
            tx += Math.round(-Math.sin(t) * swingMag);
          }

          ctx.fillStyle = p.color;
          ctx.fillRect(tx * scale, ty * scale, scale, scale);
        }
      }

      testCycleFrame = (testCycleFrame + 1) % totalFrames;
    }, 130);
  };

  btnRigTestCycle?.addEventListener('click', () => {
    if (isTestingCycle) {
      stopTestCycle();
    } else {
      startTestCycle();
    }
  });

  // Chuyen doi qua lai giua Subtabs
  btnStep3TabActions?.addEventListener('click', () => {
    btnStep3TabActions.classList.add('active');
    btnStep3TabRigging?.classList.remove('active');
    if (step3ActionsPanel) step3ActionsPanel.style.display = 'flex';
    if (step3RiggingPanel) step3RiggingPanel.style.display = 'none';
    stopTestCycle();
  });

  btnStep3TabRigging?.addEventListener('click', () => {
    btnStep3TabRigging.classList.add('active');
    btnStep3TabActions?.classList.remove('active');
    if (step3RiggingPanel) step3RiggingPanel.style.display = 'flex';
    if (step3ActionsPanel) step3ActionsPanel.style.display = 'none';
    ensureSkeletonRig();
    renderJointPinningView();
  });

  // Bắt đầu tạo hoạt ảnh Sprite
  const handleGenerateAnimation = async () => {
    if (!baseCharState.seed) {
      alert('Vui lòng tạo mẫu nhân vật trước khi sinh hoạt ảnh!');
      goToStep(1);
      return;
    }

    // Tự động chốt mẫu nếu chưa chốt
    baseCharState.locked = true;

    animSetupState.frameSize = parseInt(animFrameSizeSelect?.value || '64', 10);
    animSetupState.removeBg = animRemoveBgCheckbox?.checked ?? true;

    // Chuyển sang Bước 4 hiển thị tiến trình
    goToStep(4);

    const isHybrid = animSetupState.engine === 'hybrid';
    const isTemplate = animSetupState.engine === 'template';
    let engineLabel = '2D Pixel Toolkit (AI Sprite Sheet)';
    if (isHybrid) engineLabel = 'Khung Xương + AI Vá Nứt';
    else if (isTemplate) engineLabel = 'Khung Xương Thuần';

    const barFill = document.getElementById('ai-progress-bar-fill');
    const stepsBadge = document.getElementById('ai-steps-badge');
    const timeElapsed = document.getElementById('ai-time-elapsed');
    const percentText = document.getElementById('ai-percent-text');
    const timeEta = document.getElementById('ai-time-eta');

    if (statusMsg) statusMsg.style.display = 'block';
    if (statusText) statusText.innerText = `Đang tạo chuỗi ${animSetupState.frameCount} frames cho hành động "${animSetupState.action}" bằng ${engineLabel}...`;
    if (barFill) barFill.style.width = isTemplate ? '80%' : (isHybrid ? '15%' : '0%');
    if (percentText) percentText.innerText = isTemplate ? '80%' : (isHybrid ? '15%' : '0%');
    if (stepsBadge) stepsBadge.innerText = isTemplate ? 'Template Engine' : (isHybrid ? 'Hybrid Refiner' : `2D Pixel Toolkit (LoRA)`);
    if (timeElapsed) timeElapsed.innerText = 'Đã chạy: 00:00';
    if (timeEta) timeEta.innerText = isTemplate ? 'Xử lý: Tức thì (<1s)' : (isHybrid ? 'Ước tính: ~25s' : 'Ước tính: ~18s');
    if (btnWizardGenerateAnim) (btnWizardGenerateAnim as HTMLButtonElement).disabled = true;

    const startTime = Date.now();
    const animTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      if (timeElapsed) timeElapsed.innerText = `Đã chạy: ${formatTimeSec(sec)}`;
    }, 1000);

    try {
      ensureSkeletonRig();
      const res = await fetch('http://127.0.0.1:3055/api/ai/generate-animation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: animSetupState.engine,
          basePrompt: baseCharState.prompt || promptInput?.value.trim() || 'pixel art hero',
          action: animSetupState.action,
          frameCount: animSetupState.frameCount,
          seed: baseCharState.seed,
          size: animSetupState.frameSize,
          removeBg: animSetupState.removeBg,
          basePixels: baseCharState.pixels,
          skeletonRig: activeSkeletonRig,
          strength: animSetupState.refineStrength,
          slashVfxType: animSetupState.slashVfxType
        })
      });

      const data = await res.json();
      if (!data.success || !Array.isArray(data.frames)) {
        throw new Error(data.error || 'Không thể tạo chuỗi hoạt ảnh');
      }

      if (isTemplate || isHybrid) {
        if (barFill) barFill.style.width = '100%';
        if (percentText) percentText.innerText = '100%';
        if (stepsBadge) stepsBadge.innerText = 'Hoàn tất';
        if (timeEta) timeEta.innerText = 'Đã xong';
        if (statusText) statusText.innerText = `Hoàn tất tạo ${data.frames.length} frames bằng ${engineLabel}!`;
      }

      animSetupState.frames = data.frames;
      livePlayerIndex = 0;
      startLivePlayer();

      // Kích hoạt các nút hoàn tất ở Bước 4
      if (btnWizardFinish) btnWizardFinish.style.display = 'inline-flex';
      if (btnWizardChangeAction) btnWizardChangeAction.style.display = 'inline-flex';

      saveWizardCheckpoint();

    } catch (err: any) {
      if (statusText) statusText.innerText = 'Đang tự động khôi phục kết quả hoạt ảnh từ máy chủ...';
      try {
        const recovered = await fetchLastAiResultFallback('animation', 6, 1500);
        if (recovered && Array.isArray(recovered.frames) && recovered.frames.length > 0) {
          animSetupState.frames = recovered.frames;
          livePlayerIndex = 0;
          startLivePlayer();

          if (btnWizardFinish) btnWizardFinish.style.display = 'inline-flex';
          if (btnWizardChangeAction) btnWizardChangeAction.style.display = 'inline-flex';

          saveWizardCheckpoint();
          return;
        }
      } catch (recoverErr: any) {
        alert('Lỗi tạo hoạt ảnh: ' + (recoverErr.message || err.message));
        return;
      }

      alert('Lỗi tạo hoạt ảnh: ' + err.message);
      // Giữ nguyên bước 4 để người dùng thấy lỗi và có thể quay lại bước 3 mà không mất dữ liệu
    } finally {
      clearInterval(animTimer);
      if (btnWizardGenerateAnim) (btnWizardGenerateAnim as HTMLButtonElement).disabled = false;
      if (statusMsg && !isTemplate) statusMsg.style.display = 'none';
    }
  };

  btnWizardGenerateAnim?.addEventListener('click', handleGenerateAnimation);

  // ==========================================
  // XỬ LÝ BƯỚC 4: LIVE PREVIEW & NẠP TIMELINE
  // ==========================================
  wizardLiveFpsSlider?.addEventListener('input', () => {
    livePlayerFps = parseInt(wizardLiveFpsSlider.value, 10);
    if (wizardLiveFpsLabel) wizardLiveFpsLabel.innerText = `${livePlayerFps} FPS`;
    startLivePlayer();
  });

  wizardLiveToggleBtn?.addEventListener('click', () => {
    livePlayerPlaying = !livePlayerPlaying;
    if (wizardLiveToggleBtn) {
      wizardLiveToggleBtn.innerText = livePlayerPlaying ? 'Tạm dừng' : 'Phát tiếp';
    }
  });

  btnWizardChangeAction?.addEventListener('click', () => {
    goToStep(3);
  });

  btnWizardFinish?.addEventListener('click', () => {
    if (!animSetupState.frames || animSetupState.frames.length === 0) {
      alert('Chưa có dữ liệu hoạt ảnh để nạp vào Timeline!');
      return;
    }

    // Nạp toàn bộ các frame vào project.frames của Studio
    project.width = animSetupState.frameSize;
    project.height = animSetupState.frameSize;
    project.frames = [];

    animSetupState.frames.forEach((frameObj: any, idx: number) => {
      const layerId = `layer_f${idx + 1}_${Date.now()}`;
      const pixelsRecord: Record<string, PixelColor> = {};

      if (Array.isArray(frameObj.pixels)) {
        for (const p of frameObj.pixels) {
          if (p.color) {
            pixelsRecord[coordToKey(p.x, p.y)] = p.color;
          }
        }
      }

      const frameData: FrameData = {
        id: `frame_${idx + 1}_${Date.now()}`,
        durationMs: Math.max(60, Math.floor(1000 / livePlayerFps)),
        layers: [
          {
            id: layerId,
            name: `Layer 1`,
            visible: true,
            locked: false,
            opacity: 1.0,
            pixels: pixelsRecord
          }
        ]
      };
      project.frames.push(frameData);
    });

    project.activeFrameIndex = 0;
    project.activeLayerId = project.frames[0]?.layers[0]?.id || 'layer_1';

    // Tạo Clip hoạt ảnh cho Timeline
    const clipId = `clip_${animSetupState.action}_${Date.now()}`;
    const newClip: AnimationClip = {
      id: clipId,
      name: `${animSetupState.action.toUpperCase()}`,
      startFrame: 0,
      endFrame: animSetupState.frames.length - 1,
      fps: livePlayerFps,
      loop: true
    };
    project.clips = [newClip];
    animController.setActiveClip(clipId);

    // Đồng bộ kích thước lên thanh trạng thái Studio
    const sizeBadge = document.getElementById('canvas-size-badge');
    if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
    const resLabel = document.getElementById('canvas-resolution');
    if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

    // Cập nhật bộ đệm và vẽ lại màn hình Studio
    canvasEngine.rebuildBuffers();
    canvasEngine.centerViewport();
    onionSkinRenderer.resize(project.width, project.height);
    renderAll();

    // Đồng bộ lên máy chủ Bridge
    syncProjectToServer();

    // Tự động phát chuyển động trên thanh Preview chính của Studio
    previewPlayer.play();
    updatePlayUi(true);

    // Đóng Modal sau khi hoàn tất
    setTimeout(() => {
      modal.style.display = 'none';
    }, 400);
  });

  // Tự động khôi phục phiên làm việc từ Checkpoint khi người dùng mở Modal
  const restoreCheckpointSession = () => {
    const cp = loadWizardCheckpoint();
    if (!cp) {
      goToStep(1);
      return;
    }

    if (cp.prompt && promptInput) {
      promptInput.value = cp.prompt;
      syncTagChips();
    }

    if (cp.baseCharacter) {
      baseCharState.seed = cp.baseCharacter.seed;
      baseCharState.locked = cp.baseCharacter.locked;
      baseCharState.pixels = cp.baseCharacter.pixels;
      baseCharState.width = cp.baseCharacter.width || 64;
      baseCharState.height = cp.baseCharacter.height || 64;
      baseCharState.dataUrl = cp.baseCharacter.dataUrl;
    }

    if (cp.animation) {
      animSetupState.action = cp.animation.action || 'walk';
      animSetupState.frameCount = cp.animation.frameCount || 4;
      animSetupState.frameSize = cp.animation.frameSize || 64;
      animSetupState.engine = (cp.animation.engine || 'template') as 'hybrid' | 'template' | 'ai';
      if (cp.animation.refineStrength !== undefined) {
        animSetupState.refineStrength = cp.animation.refineStrength;
      }
      if (Array.isArray(cp.animation.frames)) {
        animSetupState.frames = cp.animation.frames;
      }

      const animEngineCards = document.querySelectorAll('.anim-engine-card');
      animEngineCards.forEach(c => {
        const eng = c.getAttribute('data-engine');
        c.classList.toggle('active', eng === animSetupState.engine);
      });

      const aiStrengthPanel = document.getElementById('ai-strength-panel');
      const aiStrengthSlider = document.getElementById('ai-strength-slider') as HTMLInputElement | null;
      const aiStrengthVal = document.getElementById('ai-strength-val');
      const hybridStrengthPanel = document.getElementById('hybrid-strength-panel');
      const hybridStrengthSlider = document.getElementById('hybrid-strength-slider') as HTMLInputElement | null;
      const hybridStrengthVal = document.getElementById('hybrid-strength-val');

      if (aiStrengthPanel) {
        aiStrengthPanel.style.display = animSetupState.engine === 'ai' ? 'flex' : 'none';
      }
      if (hybridStrengthPanel) {
        hybridStrengthPanel.style.display = animSetupState.engine === 'hybrid' ? 'flex' : 'none';
      }
      if (animSetupState.engine === 'ai' && aiStrengthSlider) {
        aiStrengthSlider.value = `${animSetupState.refineStrength}`;
        if (aiStrengthVal) {
          let desc = 'Chuẩn chuyển động game mượt';
          if (animSetupState.refineStrength < 0.55) desc = 'Ưu tiên giữ dáng tĩnh';
          else if (animSetupState.refineStrength > 0.68) desc = 'Tư thế vung đòn cực mạnh';
          aiStrengthVal.innerText = `${animSetupState.refineStrength.toFixed(2)} (${desc})`;
        }
      } else if (hybridStrengthSlider) {
        hybridStrengthSlider.value = `${animSetupState.refineStrength}`;
        if (hybridStrengthVal) {
          let desc = 'Cân bằng chuẩn';
          if (animSetupState.refineStrength < 0.30) desc = 'Ưu tiên giữ nét gốc';
          else if (animSetupState.refineStrength > 0.45) desc = 'Ưu tiên vẽ bù sáng tạo';
          hybridStrengthVal.innerText = `${animSetupState.refineStrength.toFixed(2)} (${desc})`;
        }
      }
    }

    if (cp.skeletonRig) {
      activeSkeletonRig = cp.skeletonRig;
    } else {
      activeSkeletonRig = null;
    }

    // Đưa người dùng về đúng bước đã lưu
    goToStep(cp.step || 1);
  };

  // Khôi phục phiên làm việc khi mở Modal
  btnOpen.addEventListener('click', () => {
    restoreCheckpointSession();
  });
}

// 10. Khoi tao Modal va ket noi Kho Luu Tru Anh (Gallery 2.0)
function initGalleryModal(): void {
  const modal = document.getElementById('gallery-modal');
  const btnOpen = document.getElementById('btn-open-gallery');
  const btnClose = document.getElementById('btn-close-gallery-modal');
  const btnCloseFooter = document.getElementById('btn-close-gallery-footer');
  const btnRefresh = document.getElementById('btn-refresh-gallery');
  const btnSave = document.getElementById('btn-save-gallery');
  const gridContainer = document.getElementById('gallery-grid-container');
  const badgeCount = document.getElementById('gallery-count-badge');
  const searchInput = document.getElementById('gallery-search-input') as HTMLInputElement | null;
  const sortSelect = document.getElementById('gallery-sort-select') as HTMLSelectElement | null;
  const filterTabsContainer = document.getElementById('gallery-filter-tabs');

  if (!modal) return;

  let allGalleryItems: any[] = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let currentSort = 'newest';

  // Ham render danh sach item da duoc loc va sap xep
  const renderFilteredGallery = () => {
    if (!gridContainer) return;

    let items = [...allGalleryItems];

    // 1. Loc theo category tab
    if (currentFilter === 'project') {
      items = items.filter(it => it.hasProjectData || it.projectFile);
    } else if (currentFilter === 'animation') {
      items = items.filter(it => (it.frameCount && it.frameCount > 1));
    } else if (currentFilter === 'ai') {
      items = items.filter(it => it.sourceType === 'ai');
    }

    // 2. Loc theo tu khoa tim kiem
    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase().trim();
      items = items.filter(it => 
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.prompt && it.prompt.toLowerCase().includes(q))
      );
    }

    // 3. Sap xep
    items.sort((a, b) => {
      if (currentSort === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      } else if (currentSort === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else if (currentSort === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (currentSort === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      return 0;
    });

    if (badgeCount) {
      badgeCount.innerText = `${items.length} / ${allGalleryItems.length} mục`;
    }

    if (items.length === 0) {
      gridContainer.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; padding: 30px; text-align: center;">Không tìm thấy tác phẩm nào phù hợp với bộ lọc hiện tại.</div>';
      return;
    }

    gridContainer.innerHTML = '';
    items.forEach((item: any) => {
      const card = document.createElement('div');
      const isProject = !!(item.hasProjectData || item.projectFile);
      const isAnimation = (item.frameCount || 1) > 1;
      const isAi = item.sourceType === 'ai';

      card.className = `gallery-card ${isProject ? 'is-project' : ''}`;

      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      }) : '';

      let badgeClass = 'badge-custom';
      let badgeText = 'Ảnh Vẽ';
      if (isAi) {
        badgeClass = 'badge-ai';
        badgeText = 'AI LoRA';
      } else if (isAnimation) {
        badgeClass = 'badge-animation';
        badgeText = `Sprite (${item.frameCount}F)`;
      } else if (isProject) {
        badgeClass = 'badge-project';
        badgeText = `Dự Án (${item.layerCount || 1}L)`;
      }

      const frameInfo = (item.frameCount && item.frameCount > 1) ? `${item.frameCount} frames • ` : '';
      const layerInfo = (item.layerCount && item.layerCount > 1) ? `${item.layerCount} layers • ` : '';

      let actionButtonsHtml = '';
      if (isProject) {
        actionButtonsHtml = `
          <button class="btn btn-primary btn-load-item" title="Khôi phục toàn bộ Frame và Layer lên Canvas">Mở Dự Án</button>
          <button class="btn btn-download-project-item" title="Tải file dự án .pxdraw chuẩn về máy">Tải .pxdraw</button>
          <button class="btn btn-export-item" title="Mở bảng Xuất Ảnh chất lượng cao">Xuất Ảnh</button>
          <button class="btn btn-danger btn-del-item" title="Xóa tác phẩm này khỏi kho">Xóa</button>
        `;
      } else {
        actionButtonsHtml = `
          <button class="btn btn-primary btn-load-item" title="Nạp pixel lên Canvas Studio">Mở Canvas</button>
          <button class="btn btn-download-item" title="Tải ảnh PNG">Tải PNG</button>
          <button class="btn btn-danger btn-del-item" title="Xóa tác phẩm này khỏi kho">Xóa</button>
        `;
      }

      card.innerHTML = `
        <div class="gallery-thumb-container">
          <span class="gallery-card-badge ${badgeClass}">${badgeText}</span>
          <img class="gallery-thumb-img" src="${item.thumbnailBase64 || ''}" alt="${item.name}" />
        </div>
        <div class="gallery-card-info">
          <div class="gallery-card-title" title="${item.name}">${item.name}</div>
          <div class="gallery-card-meta">${item.width}x${item.height} px • ${frameInfo}${layerInfo}${dateStr}</div>
          <div class="gallery-card-actions">
            ${actionButtonsHtml}
          </div>
        </div>
      `;

      // 1. Nut Mo vao Canvas Studio (Khoi phuc day du frame va layer neu la project)
      card.querySelector('.btn-load-item')?.addEventListener('click', async () => {
        try {
          const loadRes = await fetch('http://127.0.0.1:3055/api/gallery/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: item.filename, id: item.id })
          });
          const loadData = await loadRes.json();
          if (loadData.success) {
            modal.style.display = 'none';

            if (loadData.project) {
              const newProj = loadData.project;
              project.id = newProj.id;
              project.name = newProj.name;
              project.width = newProj.width;
              project.height = newProj.height;
              project.frames = newProj.frames;
              project.clips = newProj.clips || [];
              project.activeFrameIndex = newProj.activeFrameIndex || 0;
              project.activeLayerId = newProj.activeLayerId || newProj.frames[0]?.layers[0]?.id || 'layer_1';

              canvasEngine.rebuildBuffers();
              onionSkinRenderer.resize(project.width, project.height);

              const sizeBadge = document.getElementById('canvas-size-badge');
              if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
              const resLabel = document.getElementById('canvas-resolution');
              if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

              renderAll();
            }
          } else {
            alert('Lỗi nạp tác phẩm: ' + (loadData.error || 'Thất bại'));
          }
        } catch (err: any) {
          alert('Không thể kết nối máy chủ: ' + err.message);
        }
      });

      // 2. Nut Tai .pxdraw truc tiep cho the Du An
      card.querySelector('.btn-download-project-item')?.addEventListener('click', async () => {
        try {
          const loadRes = await fetch('http://127.0.0.1:3055/api/gallery/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: item.filename, id: item.id })
          });
          const loadData = await loadRes.json();
          if (loadData.success && loadData.project) {
            downloadProjectFile(loadData.project, item.name);
          } else {
            alert('Không thể lấy dữ liệu dự án để tải file .pxdraw');
          }
        } catch (err: any) {
          alert('Lỗi kết nối khi tải file .pxdraw: ' + err.message);
        }
      });

      // 3. Nut Xuat Anh (Nap vao canvas va mo Smart Export Modal)
      card.querySelector('.btn-export-item')?.addEventListener('click', async () => {
        try {
          const loadRes = await fetch('http://127.0.0.1:3055/api/gallery/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: item.filename, id: item.id })
          });
          const loadData = await loadRes.json();
          if (loadData.success && loadData.project) {
            const newProj = loadData.project;
            project.id = newProj.id;
            project.name = newProj.name;
            project.width = newProj.width;
            project.height = newProj.height;
            project.frames = newProj.frames;
            project.clips = newProj.clips || [];
            project.activeFrameIndex = newProj.activeFrameIndex || 0;
            project.activeLayerId = newProj.activeLayerId || newProj.frames[0]?.layers[0]?.id || 'layer_1';

            canvasEngine.rebuildBuffers();
            onionSkinRenderer.resize(project.width, project.height);
            renderAll();

            modal.style.display = 'none';
            const exportModal = document.getElementById('export-modal');
            if (exportModal) exportModal.style.display = 'flex';
          }
        } catch (err: any) {
          alert('Lỗi khi mở xuất ảnh: ' + err.message);
        }
      });

      // 4. Nut Tai PNG
      card.querySelector('.btn-download-item')?.addEventListener('click', () => {
        if (!item.thumbnailBase64) return;
        const a = document.createElement('a');
        a.href = item.thumbnailBase64;
        a.download = item.filename;
        a.click();
      });

      // 5. Nut Xoa khoi kho
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
            allGalleryItems = allGalleryItems.filter(it => it.id !== item.id);
            renderFilteredGallery();
          } else {
            alert('Không thể xóa: ' + (delData.error || 'Lỗi'));
          }
        } catch (err: any) {
          alert('Lỗi: ' + err.message);
        }
      });

      gridContainer.appendChild(card);
    });
  };

  // Tai toan bo danh sach anh tu may chu
  const loadGallery = async () => {
    if (!gridContainer) return;
    gridContainer.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; padding: 30px; text-align: center;">Đang tải danh sách tác phẩm từ kho...</div>';

    try {
      const res = await fetch('http://127.0.0.1:3055/api/gallery');
      const data = await res.json();
      if (!data.success || !Array.isArray(data.items)) {
        gridContainer.innerHTML = '<div style="grid-column: 1 / -1; color: #ef4444; font-size: 12px; padding: 20px; text-align: center;">Không thể tải dữ liệu kho ảnh từ máy chủ.</div>';
        return;
      }

      allGalleryItems = data.items;
      renderFilteredGallery();
    } catch (err: any) {
      gridContainer.innerHTML = `<div style="grid-column: 1 / -1; color: #ef4444; font-size: 12px; padding: 20px; text-align: center;">Lỗi tải kho ảnh: ${err.message}</div>`;
    }
  };

  // Su kien click chuyen tab danh muc
  filterTabsContainer?.querySelectorAll('.gallery-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      filterTabsContainer.querySelectorAll('.gallery-tab').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      currentFilter = (tabBtn as HTMLElement).dataset.filter || 'all';
      renderFilteredGallery();
    });
  });

  // Su kien go tim kiem tuc thi
  searchInput?.addEventListener('input', () => {
    currentSearch = searchInput.value;
    renderFilteredGallery();
  });

  // Su kien thay doi kieu sap xep
  sortSelect?.addEventListener('change', () => {
    currentSort = sortSelect.value;
    renderFilteredGallery();
  });

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
    const defaultName = project.name || 'Sprite Project';
    const artName = prompt('Nhập tên cho tác phẩm cần lưu vào kho (lưu trọn vẹn tất cả Frame và Layer):', defaultName);
    if (artName === null) return;

    try {
      const res = await fetch('http://127.0.0.1:3055/api/gallery/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: artName || 'Chưa đặt tên', project })
      });
      const data = await res.json();
      if (data.success) {
        const totalFrames = project.frames?.length || 1;
        const totalLayers = project.frames?.[0]?.layers?.length || 1;
        alert(`Đã lưu tác phẩm thành công vào Kho! Đã bảo toàn trọn vẹn ${totalFrames} frame hoạt cảnh và ${totalLayers} layer để chỉnh sửa tiếp.`);
        loadGallery();
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

// 12. Nhập ảnh & Cắt SpriteSheet thông minh (Smart Image & SpriteSheet Import)
function initImageImport(): void {
  const btnImport = document.getElementById('btn-import-image');
  const fileInput = document.getElementById('image-import-input') as HTMLInputElement | null;
  const modal = document.getElementById('import-smart-modal');
  const btnClose = document.getElementById('btn-close-import-smart-modal');
  const btnCancel = document.getElementById('btn-cancel-import-smart');
  const btnApply = document.getElementById('btn-apply-import-smart');
  const previewImg = document.getElementById('import-smart-preview-img') as HTMLImageElement | null;
  const dimenLabel = document.getElementById('import-smart-dimen-label');
  const typeBadge = document.getElementById('import-smart-type-badge');
  const hintBox = document.getElementById('import-smart-hint-box');
  const modeCards = document.querySelectorAll('#import-smart-modal .anim-engine-card');
  const spritesheetConfig = document.getElementById('import-spritesheet-config');
  const framesCountInput = document.getElementById('import-smart-frames-count') as HTMLInputElement | null;
  const frameSizeLabel = document.getElementById('import-smart-frame-size-label');
  const clipNameInput = document.getElementById('import-smart-clip-name') as HTMLInputElement | null;
  const fpsInput = document.getElementById('import-smart-fps') as HTMLInputElement | null;
  const targetSizeSelect = document.getElementById('import-smart-target-size') as HTMLSelectElement | null;
  const splitModeSelect = document.getElementById('import-smart-split-mode') as HTMLSelectElement | null;
  const removeBgCheck = document.getElementById('import-smart-remove-bg') as HTMLInputElement | null;
  const bgTypeSelect = document.getElementById('import-smart-bg-type') as HTMLSelectElement | null;
  const bgToleranceInput = document.getElementById('import-smart-bg-tolerance') as HTMLInputElement | null;

  let loadedImg: HTMLImageElement | null = null;
  let loadedFileName = '';
  let activeMode: 'spritesheet' | 'base_char' | 'new_canvas' | 'layer' = 'spritesheet';

  if (!btnImport || !fileInput || !modal) return;

  // 12.1. Thuat toan Edge Flood-Fill xoa phong nen ngoai (Bao toan tap de & mat trang)
  const removeEdgeBackground = (
    c: CanvasRenderingContext2D,
    w: number,
    h: number,
    mode: string,
    tolerance: number
  ) => {
    const imgData = c.getImageData(0, 0, w, h);
    const data = imgData.data;
    const total = w * h;

    let tr = 255, tg = 255, tb = 255;
    if (mode === 'green') {
      tr = 0; tg = 255; tb = 0;
    } else if (mode === 'black') {
      tr = 0; tg = 0; tb = 0;
    } else if (mode === 'auto' || mode === 'white') {
      const sampleIndices = [0, (w - 1) * 4, (h - 1) * w * 4, (total - 1) * 4];
      let sr = 0, sg = 0, sb = 0, sc = 0;
      for (const idx of sampleIndices) {
        if (data[idx + 3] > 10) {
          sr += data[idx]; sg += data[idx + 1]; sb += data[idx + 2]; sc++;
        }
      }
      if (sc > 0) {
        tr = Math.round(sr / sc); tg = Math.round(sg / sc); tb = Math.round(sb / sc);
      }
    }

    const isMatch = (r: number, g: number, b: number) => {
      return (
        Math.abs(r - tr) <= tolerance &&
        Math.abs(g - tg) <= tolerance &&
        Math.abs(b - tb) <= tolerance
      );
    };

    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0, tail = 0;

    // Quet 4 bien ngoai (Top, Bottom, Left, Right)
    for (let x = 0; x < w; x++) {
      const topIdx = x * 4;
      if (isMatch(data[topIdx], data[topIdx + 1], data[topIdx + 2])) {
        visited[x] = 1;
        queue[tail++] = x;
      }
      const bPos = (h - 1) * w + x;
      const bIdx = bPos * 4;
      if (!visited[bPos] && isMatch(data[bIdx], data[bIdx + 1], data[bIdx + 2])) {
        visited[bPos] = 1;
        queue[tail++] = bPos;
      }
    }

    for (let y = 0; y < h; y++) {
      const lPos = y * w;
      const lIdx = lPos * 4;
      if (!visited[lPos] && isMatch(data[lIdx], data[lIdx + 1], data[lIdx + 2])) {
        visited[lPos] = 1;
        queue[tail++] = lPos;
      }
      const rPos = y * w + (w - 1);
      const rIdx = rPos * 4;
      if (!visited[rPos] && isMatch(data[rIdx], data[rIdx + 1], data[rIdx + 2])) {
        visited[rPos] = 1;
        queue[tail++] = rPos;
      }
    }

    // Loang BFS tu ngoai vao trong
    while (head < tail) {
      const pos = queue[head++];
      const x = pos % w;
      const y = Math.floor(pos / w);
      data[pos * 4 + 3] = 0; // Xoa thanh trong suot

      const neighbors = [
        y > 0 ? pos - w : -1,
        y < h - 1 ? pos + w : -1,
        x > 0 ? pos - 1 : -1,
        x < w - 1 ? pos + 1 : -1
      ];

      for (const nPos of neighbors) {
        if (nPos >= 0 && !visited[nPos]) {
          const nIdx = nPos * 4;
          if (isMatch(data[nIdx], data[nIdx + 1], data[nIdx + 2])) {
            visited[nPos] = 1;
            queue[tail++] = nPos;
          }
        }
      }
    }

    c.putImageData(imgData, 0, 0);
  };

  // 12.2. Thuat toan Smart Valley tim diem cat toi uu giua cac nhan vat
  const findSmartCuts = (c: CanvasRenderingContext2D, w: number, h: number, count: number): number[] => {
    if (count <= 1) return [0, w];
    const imgData = c.getImageData(0, 0, w, h);
    const data = imgData.data;

    const xDensity = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      let pixels = 0;
      for (let y = 0; y < h; y++) {
        if (data[(y * w + x) * 4 + 3] > 25) pixels++;
      }
      xDensity[x] = pixels;
    }

    const cuts = [0];
    const step = w / count;
    const searchRadius = Math.max(12, Math.floor(step * 0.45));

    for (let k = 1; k < count; k++) {
      const centerTheory = Math.round(k * step);
      const minSearch = Math.max(cuts[k - 1] + 16, centerTheory - searchRadius);
      const maxSearch = Math.min(w - 16, centerTheory + searchRadius);

      let bestX = centerTheory;
      let minScore = Infinity;

      for (let x = minSearch; x <= maxSearch; x++) {
        const density = xDensity[x];
        const dist = Math.abs(x - centerTheory);
        const score = density * 1000 + dist;
        if (score < minScore) {
          minScore = score;
          bestX = x;
        }
      }
      cuts.push(bestX);
    }
    cuts.push(w);
    return cuts;
  };

  const updateFrameCalculations = () => {
    if (!loadedImg || !framesCountInput || !frameSizeLabel) return;
    const count = Math.max(1, parseInt(framesCountInput.value, 10) || 1);
    const rawFw = Math.floor(loadedImg.width / count);
    const rawFh = loadedImg.height;
    const targetSizeVal = targetSizeSelect?.value || '64';
    if (targetSizeVal !== 'original' && rawFh > parseInt(targetSizeVal, 10)) {
      const targetH = parseInt(targetSizeVal, 10) || 64;
      const scale = targetH / rawFh;
      const fw = Math.max(16, Math.round(rawFw * scale));
      frameSizeLabel.innerText = `${fw} x ${targetH} px (Đã tối ưu)`;
    } else {
      frameSizeLabel.innerText = `${rawFw} x ${rawFh} px`;
    }
  };

  framesCountInput?.addEventListener('input', updateFrameCalculations);
  targetSizeSelect?.addEventListener('change', updateFrameCalculations);

  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      activeMode = (card.getAttribute('data-mode') || 'spritesheet') as any;
      if (spritesheetConfig) {
        spritesheetConfig.style.display = activeMode === 'spritesheet' ? 'flex' : 'none';
      }
    });
  });

  const openSmartImport = (file: File) => {
    loadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        loadedImg = img;
        if (previewImg) previewImg.src = img.src;
        if (dimenLabel) dimenLabel.innerText = `${img.width} x ${img.height} px`;

        // Tự động nhận diện tỷ lệ: nếu W >= H * 1.4 -> Sprite Sheet
        const isStrip = img.width >= img.height * 1.4;
        let guessedFrames = 1;
        if (isStrip) {
          const ratio = img.width / img.height;
          guessedFrames = Math.max(2, Math.round(ratio));
        }

        if (typeBadge) {
          typeBadge.innerText = isStrip ? `Sprite Sheet (${guessedFrames} Frames)` : 'Ảnh Tĩnh (Single)';
          typeBadge.style.color = isStrip ? '#4ade80' : '#38bdf8';
          typeBadge.style.borderColor = isStrip ? '#22c55e' : '#0284c7';
        }

        if (hintBox) {
          if (isStrip) {
            hintBox.innerHTML = `Phát hiện đây là <strong>Dải Sprite Sheet (${img.width}x${img.height}px)</strong>. Tự động xóa phông nền và phân tách từng frame thông minh!`;
            hintBox.style.background = 'rgba(74, 222, 128, 0.1)';
            hintBox.style.borderColor = 'rgba(74, 222, 128, 0.3)';
          } else {
            hintBox.innerHTML = `Ảnh có kích thước <strong>${img.width}x${img.height}px</strong>. Bạn có thể nạp làm Mẫu Nhân Vật trong AI Puppet Rigging hoặc tạo Canvas mới.`;
            hintBox.style.background = 'rgba(56, 189, 248, 0.1)';
            hintBox.style.borderColor = 'rgba(56, 189, 248, 0.3)';
          }
        }

        if (framesCountInput) {
          framesCountInput.value = `${guessedFrames}`;
        }
        if (clipNameInput) {
          const baseName = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
          clipNameInput.value = isStrip ? `CLIP_${baseName}` : 'CLIP_DEFAULT';
        }

        updateFrameCalculations();

        // Mặc định chọn chế độ phù hợp
        modeCards.forEach(c => {
          const m = c.getAttribute('data-mode');
          const isTarget = isStrip ? m === 'spritesheet' : m === 'new_canvas';
          c.classList.toggle('active', isTarget);
        });
        activeMode = isStrip ? 'spritesheet' : 'new_canvas';
        if (spritesheetConfig) {
          spritesheetConfig.style.display = isStrip ? 'flex' : 'none';
        }

        modal.style.display = 'flex';
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  btnImport.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) openSmartImport(file);
  });

  // Hỗ trợ Kéo & Thả (Drag & Drop) toàn cục trên cửa sổ Studio
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      openSmartImport(file);
    }
  });

  const closeSmartModal = () => {
    modal.style.display = 'none';
    loadedImg = null;
  };

  btnClose?.addEventListener('click', closeSmartModal);
  btnCancel?.addEventListener('click', closeSmartModal);

  // Thực hiện nhập ảnh theo chế độ đã chọn
  btnApply?.addEventListener('click', () => {
    if (!loadedImg) return;
    const img = loadedImg;

    if (activeMode === 'spritesheet') {
      const count = Math.max(1, parseInt(framesCountInput?.value || '4', 10));
      const fps = Math.max(1, parseInt(fpsInput?.value || '8', 10));
      const clipName = clipNameInput?.value.trim() || `CLIP_${Date.now()}`;
      const targetSizeVal = targetSizeSelect?.value || '64';
      const splitMode = splitModeSelect?.value || 'smart';
      const shouldRemoveBg = removeBgCheck?.checked ?? true;
      const bgType = bgTypeSelect?.value || 'auto';
      const bgTolerance = parseInt(bgToleranceInput?.value || '35', 10);

      // 1. Khoi tao canvas chua anh goc de tien hanh xu ly xoa phong
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const sCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sCtx) return;
      sCtx.drawImage(img, 0, 0);

      // 2. Xoa phong nen tu dong bang Edge Flood Fill
      if (shouldRemoveBg) {
        removeEdgeBackground(sCtx, img.width, img.height, bgType, bgTolerance);
      }

      // 3. Xac dinh cac ranh gioi cat frame
      let cuts: number[] = [];
      if (splitMode === 'smart') {
        cuts = findSmartCuts(sCtx, img.width, img.height, count);
      } else {
        const step = img.width / count;
        cuts = [0];
        for (let k = 1; k < count; k++) cuts.push(Math.round(k * step));
        cuts.push(img.width);
      }

      // 4. Tim Bounding Box cua tung nhan vat trong tung frame
      const sData = sCtx.getImageData(0, 0, img.width, img.height).data;
      const frameBoxes: { minX: number; maxX: number; minY: number; maxY: number; hasPixels: boolean }[] = [];
      let maxCharW = 0;
      let maxCharH = 0;

      for (let f = 0; f < count; f++) {
        const sx = cuts[f];
        const ex = cuts[f + 1];
        let minX = ex, maxX = sx, minY = img.height, maxY = 0, hasPixels = false;

        for (let y = 0; y < img.height; y++) {
          for (let x = sx; x < ex; x++) {
            const a = sData[(y * img.width + x) * 4 + 3];
            if (a > 25) {
              hasPixels = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        frameBoxes.push({ minX, maxX, minY, maxY, hasPixels });
        if (hasPixels) {
          const cw = maxX - minX + 1;
          const ch = maxY - minY + 1;
          if (cw > maxCharW) maxCharW = cw;
          if (ch > maxCharH) maxCharH = ch;
        }
      }

      // 5. Tinh toan kich thuoc canvas frame sau toi uu
      let finalFh = img.height;
      let finalFw = Math.max(16, Math.round(img.width / count));
      let globalScale = 1.0;

      if (targetSizeVal !== 'original') {
        const targetH = parseInt(targetSizeVal, 10) || 64;
        if (img.height > targetH) {
          globalScale = targetH / img.height;
          finalFh = targetH;
          const scaledMaxCharW = Math.round(maxCharW * globalScale);
          finalFw = Math.max(scaledMaxCharW + 8, Math.round((img.width / count) * globalScale));
        }
      }

      project.width = finalFw;
      project.height = finalFh;
      project.frames = [];

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = finalFw;
      frameCanvas.height = finalFh;
      const fCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
      if (!fCtx) return;

      fCtx.imageSmoothingEnabled = true;
      fCtx.imageSmoothingQuality = 'high';

      // 6. Cat va can giua tung nhan vat vao Frame
      for (let f = 0; f < count; f++) {
        fCtx.clearRect(0, 0, finalFw, finalFh);
        const sx = cuts[f];
        const ex = cuts[f + 1];
        const segW = ex - sx;
        const box = frameBoxes[f];

        if (splitMode === 'smart' && box.hasPixels) {
          // Can giua nhan vat theo truc X va can chan tiep dat theo truc Y
          const charW = box.maxX - box.minX + 1;
          const charH = box.maxY - box.minY + 1;
          const destCharW = Math.round(charW * globalScale);
          const destCharH = Math.round(charH * globalScale);

          const destX = Math.round((finalFw - destCharW) / 2);
          const bottomPadding = 2;
          const destY = Math.max(0, finalFh - destCharH - bottomPadding);

          fCtx.drawImage(
            sourceCanvas,
            box.minX, box.minY, charW, charH,
            destX, destY, destCharW, destCharH
          );
        } else {
          // Che do cat luoi deu
          const scaledSegW = Math.round(segW * globalScale);
          const destX = Math.round((finalFw - scaledSegW) / 2);
          fCtx.drawImage(
            sourceCanvas,
            sx, 0, segW, img.height,
            destX, 0, scaledSegW, finalFh
          );
        }

        const frameData = fCtx.getImageData(0, 0, finalFw, finalFh);
        const data = frameData.data;
        const pixelsRecord: Record<string, PixelColor> = {};

        for (let y = 0; y < finalFh; y++) {
          for (let x = 0; x < finalFw; x++) {
            const idx = (y * finalFw + x) * 4;
            const a = data[idx + 3];
            if (a > 20) {
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
              pixelsRecord[coordToKey(x, y)] = hex;
            }
          }
        }

        project.frames.push({
          id: `frame_${f + 1}_${Date.now()}`,
          durationMs: Math.round(1000 / fps),
          layers: [
            {
              id: `layer_import_${f + 1}`,
              name: `Frame ${f + 1}`,
              visible: true,
              locked: false,
              opacity: 1.0,
              pixels: pixelsRecord
            }
          ]
        });
      }

      // 7. Tao Animation Clip va cap nhat giao dien
      const clipId = `clip_${Date.now()}`;
      project.clips = [
        {
          id: clipId,
          name: clipName,
          startFrame: 0,
          endFrame: count - 1,
          fps,
          loop: true
        }
      ];

      project.activeFrameIndex = 0;
      project.activeLayerId = project.frames[0].layers[0].id;
      animController.setActiveClip(clipId);

      const sizeBadge = document.getElementById('canvas-size-badge');
      if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
      const resLabel = document.getElementById('canvas-resolution');
      if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

      canvasEngine.rebuildBuffers();
      canvasEngine.fitToScreen();
      const zoomBadge = document.getElementById('canvas-zoom-badge');
      if (zoomBadge) zoomBadge.innerText = `${Math.round(canvasEngine.zoom * 100)}%`;
      onionSkinRenderer.resize(project.width, project.height);
      renderAll();
      syncProjectToServer();
      closeSmartModal();

    } else if (activeMode === 'base_char') {
      const isStrip = img.width >= img.height * 1.4;
      const count = isStrip ? Math.max(2, Math.round(img.width / img.height)) : 1;
      const rawFw = isStrip ? Math.floor(img.width / count) : img.width;
      const rawFh = img.height;

      // Xoa phong nen neu duoc chon
      const shouldRemoveBg = removeBgCheck?.checked ?? true;
      const bgType = bgTypeSelect?.value || 'auto';
      const bgTolerance = parseInt(bgToleranceInput?.value || '35', 10);

      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const sCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sCtx) return;
      sCtx.drawImage(img, 0, 0);

      if (shouldRemoveBg) {
        removeEdgeBackground(sCtx, img.width, img.height, bgType, bgTolerance);
      }

      let targetFw = rawFw;
      let targetFh = rawFh;
      if (rawFh > 96) {
        targetFh = 64;
        const scale = 64 / rawFh;
        targetFw = Math.max(16, Math.round(rawFw * scale));
      }

      const offCanvas = document.createElement('canvas');
      offCanvas.width = targetFw;
      offCanvas.height = targetFh;
      const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceCanvas, 0, 0, rawFw, rawFh, 0, 0, targetFw, targetFh);
      const imgData = ctx.getImageData(0, 0, targetFw, targetFh);
      const data = imgData.data;

      const pixels: PixelPoint[] = [];
      for (let y = 0; y < targetFh; y++) {
        for (let x = 0; x < targetFw; x++) {
          const idx = (y * targetFw + x) * 4;
          const a = data[idx + 3];
          if (a > 20) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            pixels.push({ x, y, color: hex });
          }
        }
      }

      closeSmartModal();
      globalOpenAiWizardWithBaseChar?.(pixels, targetFw, targetFh, loadedFileName);

    } else if (activeMode === 'new_canvas') {
      project.width = img.width;
      project.height = img.height;
      project.frames = [
        {
          id: `frame_1_${Date.now()}`,
          durationMs: 125,
          layers: []
        }
      ];

      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imgData.data;
      const pixelsRecord: Record<string, PixelColor> = {};

      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4;
          const a = data[idx + 3];
          if (a > 20) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            pixelsRecord[coordToKey(x, y)] = hex;
          }
        }
      }

      const layerId = `layer_${Date.now()}`;
      project.frames[0].layers = [
        {
          id: layerId,
          name: `Ảnh: ${loadedFileName.slice(0, 12)}`,
          visible: true,
          locked: false,
          opacity: 1.0,
          pixels: pixelsRecord
        }
      ];
      project.activeFrameIndex = 0;
      project.activeLayerId = layerId;

      const sizeBadge = document.getElementById('canvas-size-badge');
      if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
      const resLabel = document.getElementById('canvas-resolution');
      if (resLabel) resLabel.innerText = `${project.width} x ${project.height}`;

      canvasEngine.rebuildBuffers();
      canvasEngine.fitToScreen();
      const zoomBadge = document.getElementById('canvas-zoom-badge');
      if (zoomBadge) zoomBadge.innerText = `${Math.round(canvasEngine.zoom * 100)}%`;
      onionSkinRenderer.resize(project.width, project.height);
      renderAll();
      syncProjectToServer();
      closeSmartModal();

    } else {
      // Chế độ layer: giữ nguyên canvas
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imgData.data;

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
        name: `Import: ${loadedFileName.slice(0, 12)}`,
        visible: true,
        locked: false,
        opacity: 1.0,
        pixels: {} as Record<string, PixelColor>
      };

      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4;
          const a = data[idx + 3];
          if (a > 20) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            newLayer.pixels[coordToKey(x + offsetX, y + offsetY)] = hex;
          }
        }
      }

      activeFrame.layers.push(newLayer);
      project.activeLayerId = newLayerId;
      canvasEngine.rebuildBuffers();
      canvasEngine.fitToScreen();
      const zoomBadge = document.getElementById('canvas-zoom-badge');
      if (zoomBadge) zoomBadge.innerText = `${Math.round(canvasEngine.zoom * 100)}%`;
      renderAll();
      syncProjectToServer();
      closeSmartModal();
    }
  });
}

// 13. Modal Xuat File Tac Pham (Export)
function initExportModal(): void {
  const modal = document.getElementById('export-modal');
  const btnOpen = document.getElementById('btn-export');
  const btnClose = document.getElementById('btn-close-export-modal');
  const btnDownloadPng = document.getElementById('btn-download-png');
  const btnDownloadSheet = document.getElementById('btn-download-spritesheet');
  const btnServer = document.getElementById('btn-export-server');
  const btnCloseFooter = document.getElementById('btn-close-export-footer');
  const exportTabsContainer = document.getElementById('export-tabs');
  const layoutSelect = document.getElementById('export-sheet-layout') as HTMLSelectElement | null;
  const colsInput = document.getElementById('export-sheet-cols') as HTMLInputElement | null;
  const chkAtlas = document.getElementById('chk-export-json-meta') as HTMLInputElement | null;

  const btnExportPxDraw = document.getElementById('btn-export-pxdraw');
  const btnExportSaveGallery = document.getElementById('btn-export-save-gallery');

  let singleScale = 1;
  let sheetScale = 1;

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  btnClose?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  btnCloseFooter?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Chuyen tab trong Export Modal
  exportTabsContainer?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.modal-tab-btn') as HTMLElement;
    if (!btn || !btn.dataset.tab) return;
    const targetTab = btn.dataset.tab;

    exportTabsContainer.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    ['tab-export-single', 'tab-export-sheet', 'tab-export-project'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = id === targetTab ? 'block' : 'none';
      }
    });
  });

  // Chon ti le phong to anh don le
  document.querySelectorAll('#single-scale-group .export-scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#single-scale-group .export-scale-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      singleScale = parseInt(btn.getAttribute('data-scale') || '1', 10);
    });
  });

  // Chon ti le phong to SpriteSheet
  document.querySelectorAll('#sheet-scale-group .export-scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sheet-scale-group .export-scale-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sheetScale = parseInt(btn.getAttribute('data-scale') || '1', 10);
    });
  });

  // Tai truc tiep file PNG anh don ve may tinh
  btnDownloadPng?.addEventListener('click', () => {
    const activeFrame = canvasEngine.getCurrentFrame();
    if (!activeFrame) return;

    const outW = project.width * singleScale;
    const outH = project.height * singleScale;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = outW;
    offCanvas.height = outH;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Ve lan luot cac visible layers cua frame hien tai
    for (const layer of activeFrame.layers) {
      if (!layer.visible) continue;
      if (layer.groupId) {
        const group = project.groups?.find(g => g.id === layer.groupId);
        if (group && group.visible === false) continue;
      }
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      for (const [key, color] of Object.entries(layer.pixels)) {
        if (!color) continue;
        const [px, py] = key.split(',').map(Number);
        ctx.fillStyle = color;
        ctx.fillRect(px * singleScale, py * singleScale, singleScale, singleScale);
      }
      ctx.restore();
    }

    const link = document.createElement('a');
    link.download = `${project.name || 'pixel_art'}_frame${project.activeFrameIndex + 1}_${outW}x${outH}.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();
    modal.style.display = 'none';
  });

  // Xuat SpriteSheet (Ho tro ca Dai ngang Strip va Luoi Grid)
  const generateSpriteSheetCanvas = (scale: number, layout: 'strip' | 'grid', cols: number) => {
    const frameCount = project.frames.length;
    if (frameCount === 0) return null;

    const fw = project.width * scale;
    const fh = project.height * scale;

    let columns = frameCount;
    let rows = 1;

    if (layout === 'grid') {
      columns = Math.max(1, Math.min(cols, frameCount));
      rows = Math.ceil(frameCount / columns);
    }

    const totalW = fw * columns;
    const totalH = fh * rows;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = totalW;
    offCanvas.height = totalH;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;

    const frameCoords: { index: number; durationMs: number; x: number; y: number; w: number; h: number }[] = [];

    for (let f = 0; f < frameCount; f++) {
      const colIndex = f % columns;
      const rowIndex = Math.floor(f / columns);
      const destX = colIndex * fw;
      const destY = rowIndex * fh;

      frameCoords.push({
        index: f,
        durationMs: project.frames[f].durationMs,
        x: destX,
        y: destY,
        w: fw,
        h: fh
      });

      const frame = project.frames[f];
      for (const layer of frame.layers) {
        if (!layer.visible) continue;
        if (layer.groupId) {
          const group = project.groups?.find(g => g.id === layer.groupId);
          if (group && group.visible === false) continue;
        }
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        for (const [key, color] of Object.entries(layer.pixels)) {
          if (!color) continue;
          const [px, py] = key.split(',').map(Number);
          ctx.fillStyle = color;
          ctx.fillRect(destX + px * scale, destY + py * scale, scale, scale);
        }
        ctx.restore();
      }
    }

    return { canvas: offCanvas, totalW, totalH, fw, fh, columns, rows, frameCoords };
  };

  btnDownloadSheet?.addEventListener('click', () => {
    const layout = (layoutSelect?.value || 'strip') as 'strip' | 'grid';
    const cols = parseInt(colsInput?.value || '4', 10) || 4;

    const result = generateSpriteSheetCanvas(sheetScale, layout, cols);
    if (!result) return;

    // 1. Tai file PNG
    const link = document.createElement('a');
    link.download = `${project.name || 'SpriteSheet'}_${project.frames.length}frames_${result.totalW}x${result.totalH}.png`;
    link.href = result.canvas.toDataURL('image/png');
    link.click();

    // 2. Tai kem Atlas JSON
    if (chkAtlas?.checked) {
      const meta = {
        name: project.name || 'SpriteSheet',
        framesCount: project.frames.length,
        layout,
        columns: result.columns,
        rows: result.rows,
        frameWidth: result.fw,
        frameHeight: result.fh,
        totalWidth: result.totalW,
        totalHeight: result.totalH,
        scale: sheetScale,
        clips: project.clips || [],
        frames: result.frameCoords
      };
      const jsonBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
      const jsonLink = document.createElement('a');
      jsonLink.download = `${project.name || 'SpriteSheet'}_atlas.json`;
      jsonLink.href = URL.createObjectURL(jsonBlob);
      jsonLink.click();
    }

    modal.style.display = 'none';
  });

  // Luu vao thu muc du an server
  btnServer?.addEventListener('click', async () => {
    try {
      const outputPath = `storage/outputs/${project.name || 'SpriteSheet'}_${Date.now()}.png`;
      const res = await fetch('http://127.0.0.1:3055/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputPath, scale: sheetScale, project })
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

  // Tab 3 buttons: Luu du an .pxdraw
  btnExportPxDraw?.addEventListener('click', () => {
    downloadProjectFile(project);
    modal.style.display = 'none';
  });

  btnExportSaveGallery?.addEventListener('click', () => {
    modal.style.display = 'none';
    document.getElementById('btn-save-gallery')?.click();
  });

  // 4. Ho tro keo tha file .pxdraw truc tiep vao man hinh de mo
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.pxdraw') || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = event.target?.result as string;
          const loaded = importFromPxDraw(raw);
          project.id = loaded.id;
          project.name = loaded.name;
          project.width = loaded.width;
          project.height = loaded.height;
          project.frames = loaded.frames;
          project.clips = loaded.clips || [];
          project.activeFrameIndex = loaded.activeFrameIndex || 0;
          project.activeLayerId = loaded.activeLayerId || loaded.frames[0]?.layers[0]?.id || 'layer_1';
          canvasEngine.rebuildBuffers();
          onionSkinRenderer.resize(project.width, project.height);
          const sizeBadge = document.getElementById('canvas-size-badge');
          if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
          renderAll();
          alert(`Đã kéo thả và nạp thành công dự án "${project.name}"!`);
        } catch (err: any) {
          alert('Lỗi nạp file kéo thả: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  });
}

// 14. Khoi tao Menu Bar phong cach Photoshop / Aseprite tren Headbar
function initAppMenuBar(): void {
  const menuBar = document.getElementById('app-menu-bar');
  if (!menuBar) return;

  const menuItems = menuBar.querySelectorAll<HTMLElement>('.nav-menu-item');
  let isAnyMenuOpen = false;

  const closeAllMenus = () => {
    menuItems.forEach(item => item.classList.remove('active'));
    isAnyMenuOpen = false;
  };

  menuItems.forEach(item => {
    const trigger = item.querySelector<HTMLElement>('.nav-menu-btn');
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = item.classList.contains('active');
      closeAllMenus();
      if (!wasActive) {
        item.classList.add('active');
        isAnyMenuOpen = true;
      }
    });

    item.addEventListener('mouseenter', () => {
      if (isAnyMenuOpen) {
        menuItems.forEach(it => it.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });

  // Dong menu khi click ra ngoai hoac nhan Esc
  document.addEventListener('click', (e) => {
    if (!menuBar.contains(e.target as Node)) {
      closeAllMenus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllMenus();
    }
  });

  // Dong menu khi click vao bat ky dropdown-item nao
  document.querySelectorAll('.dropdown-item').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllMenus();
    });
  });

  // 1. Gan su kien cho cac nut Menu Tep (File)
  document.getElementById('menu-file-new')?.addEventListener('click', () => {
    if (confirm('Tạo dự án mới? Các thay đổi chưa lưu có thể bị mất.')) {
      const newProj = createDefaultProject(24, 24, 'NewSprite');
      project.id = newProj.id;
      project.name = newProj.name;
      project.width = newProj.width;
      project.height = newProj.height;
      project.frames = newProj.frames;
      project.clips = newProj.clips;
      project.activeFrameIndex = 0;
      project.activeLayerId = newProj.frames[0].layers[0].id;
      canvasEngine.rebuildBuffers();
      onionSkinRenderer.resize(project.width, project.height);
      const sizeBadge = document.getElementById('canvas-size-badge');
      if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
      renderAll();
    }
  });

  // Mo file du an .pxdraw tu may tinh
  const projFileInput = document.getElementById('project-file-input') as HTMLInputElement;
  document.getElementById('menu-file-open')?.addEventListener('click', () => {
    projFileInput?.click();
  });

  projFileInput?.addEventListener('change', () => {
    const file = projFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const loadedProj = importFromPxDraw(content);
        project.id = loadedProj.id;
        project.name = loadedProj.name;
        project.width = loadedProj.width;
        project.height = loadedProj.height;
        project.frames = loadedProj.frames;
        project.clips = loadedProj.clips || [];
        project.activeFrameIndex = loadedProj.activeFrameIndex || 0;
        project.activeLayerId = loadedProj.activeLayerId || loadedProj.frames[0]?.layers[0]?.id || 'layer_1';
        canvasEngine.rebuildBuffers();
        onionSkinRenderer.resize(project.width, project.height);
        const sizeBadge = document.getElementById('canvas-size-badge');
        if (sizeBadge) sizeBadge.innerText = `${project.width}x${project.height} px`;
        renderAll();
        alert(`Đã nạp thành công dự án "${project.name}" với ${project.frames.length} frame(s)!`);
      } catch (err: any) {
        alert('Lỗi nạp file dự án: ' + err.message);
      } finally {
        projFileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // Luu file .pxdraw ve may
  document.getElementById('menu-file-save-local')?.addEventListener('click', () => {
    downloadProjectFile(project);
  });

  document.getElementById('menu-file-export')?.addEventListener('click', () => {
    document.getElementById('btn-export')?.click();
  });

  // 2. Menu Chinh sua (Edit)
  document.getElementById('menu-edit-resize')?.addEventListener('click', () => {
    document.getElementById('canvas-size-badge')?.click();
  });

  // 3. Menu Hien thi (View)
  document.getElementById('menu-view-reset-zoom')?.addEventListener('click', () => {
    document.getElementById('canvas-zoom-badge')?.click();
  });

  // Quick Undo/Redo
  document.getElementById('quick-undo')?.addEventListener('click', () => {
    document.getElementById('btn-undo')?.click();
  });
  document.getElementById('quick-redo')?.addEventListener('click', () => {
    document.getElementById('btn-redo')?.click();
  });
}

// 15. Khoi tao Modal Chinh Mau Sac (Color Adjustments)
function initColorAdjustmentsModal(): void {
  const modal = document.getElementById('color-adjustments-modal');
  const btnClose = document.getElementById('btn-close-color-adj-modal');
  const btnCancel = document.getElementById('btn-cancel-color-adj');
  const btnApply = document.getElementById('btn-apply-color-adj');
  const badgeTarget = document.getElementById('color-adj-target-badge');

  const sliderHue = document.getElementById('slider-hue') as HTMLInputElement;
  const sliderSat = document.getElementById('slider-sat') as HTMLInputElement;
  const sliderLight = document.getElementById('slider-light') as HTMLInputElement;
  const labelHue = document.getElementById('label-hue-val');
  const labelSat = document.getElementById('label-sat-val');
  const labelLight = document.getElementById('label-light-val');
  const btnResetHsl = document.getElementById('btn-reset-hsl');

  const colorFromInput = document.getElementById('replace-color-from') as HTMLInputElement;
  const colorToInput = document.getElementById('replace-color-to') as HTMLInputElement;
  const colorFromHex = document.getElementById('replace-color-from-hex');
  const colorToHex = document.getElementById('replace-color-to-hex');
  const sliderReplaceTol = document.getElementById('slider-replace-tol') as HTMLInputElement;
  const labelReplaceTol = document.getElementById('label-replace-tol-val');

  const sliderBright = document.getElementById('slider-bright') as HTMLInputElement;
  const sliderContrast = document.getElementById('slider-contrast') as HTMLInputElement;
  const labelBright = document.getElementById('label-bright-val');
  const labelContrast = document.getElementById('label-contrast-val');
  const btnQuickInvert = document.getElementById('btn-quick-invert');

  const chkPreview = document.getElementById('chk-color-adj-preview') as HTMLInputElement;
  const tabsContainer = document.getElementById('color-adj-tabs');
  const dialog = document.getElementById('color-adjustments-dialog') as HTMLElement | null;
  const dragHandle = document.getElementById('color-adjustments-drag-handle');
  const btnToggleOpacity = document.getElementById('btn-toggle-dialog-opacity');

  if (!modal) return;

  // Luu tru ban sao pixel goc truoc khi keo slider de xem truoc va hoan tac
  let initialPixelsSnapshot: Record<string, PixelColor> = {};
  let currentActiveTab = 'tab-hsl';
  let isSeeThrough = false;

  // Xu ly che do nhin xuyen thau qua cua so
  btnToggleOpacity?.addEventListener('click', () => {
    isSeeThrough = !isSeeThrough;
    dialog?.classList.toggle('is-see-through', isSeeThrough);
    btnToggleOpacity.classList.toggle('active', isSeeThrough);
  });

  // Xu ly keo tha di chuyen cua so (Draggable Floating Window)
  let isDragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startDialogLeft = 0;
  let startDialogTop = 0;

  dragHandle?.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (!dialog) return;

    isDragging = true;
    dragHandle.setPointerCapture(e.pointerId);

    const rect = dialog.getBoundingClientRect();
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startDialogLeft = rect.left;
    startDialogTop = rect.top;

    dialog.style.right = 'auto';
    dialog.style.left = `${startDialogLeft}px`;
    dialog.style.top = `${startDialogTop}px`;
    dialog.dataset.hasMoved = 'true';
  });

  dragHandle?.addEventListener('pointermove', (e) => {
    if (!isDragging || !dialog) return;
    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;

    let newLeft = startDialogLeft + dx;
    let newTop = startDialogTop + dy;

    const dialogWidth = dialog.offsetWidth;
    const dialogHeight = dialog.offsetHeight;
    const maxLeft = window.innerWidth - dialogWidth - 10;
    const maxTop = window.innerHeight - dialogHeight - 10;

    newLeft = Math.max(10, Math.min(newLeft, maxLeft));
    newTop = Math.max(10, Math.min(newTop, maxTop));

    dialog.style.left = `${newLeft}px`;
    dialog.style.top = `${newTop}px`;
  });

  const stopDragging = (e: PointerEvent) => {
    if (isDragging) {
      isDragging = false;
      try {
        dragHandle?.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  dragHandle?.addEventListener('pointerup', stopDragging);
  dragHandle?.addEventListener('pointercancel', stopDragging);

  const resetControls = () => {
    if (sliderHue) sliderHue.value = '0';
    if (sliderSat) sliderSat.value = '0';
    if (sliderLight) sliderLight.value = '0';
    if (labelHue) labelHue.innerText = '0°';
    if (labelSat) labelSat.innerText = '0%';
    if (labelLight) labelLight.innerText = '0%';

    if (sliderBright) sliderBright.value = '0';
    if (sliderContrast) sliderContrast.value = '0';
    if (labelBright) labelBright.innerText = '0';
    if (labelContrast) labelContrast.innerText = '0';

    if (colorFromInput) {
      colorFromInput.value = primaryColor || '#ff0000';
      if (colorFromHex) colorFromHex.innerText = colorFromInput.value;
    }
    if (colorToInput) {
      colorToInput.value = secondaryColor || '#00ff00';
      if (colorToHex) colorToHex.innerText = colorToInput.value;
    }
    if (sliderReplaceTol) sliderReplaceTol.value = '0';
    if (labelReplaceTol) labelReplaceTol.innerText = '0';
  };

  const switchTab = (targetTabId: string) => {
    currentActiveTab = targetTabId;
    tabsContainer?.querySelectorAll('.modal-tab-btn').forEach(btn => {
      const b = btn as HTMLElement;
      b.classList.toggle('active', b.dataset.tab === targetTabId);
    });

    ['tab-hsl', 'tab-replace', 'tab-contrast'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = id === targetTabId ? 'block' : 'none';
      }
    });
  };

  const openModal = (tabId = 'tab-hsl') => {
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (!currentLayer) {
      alert('Vui lòng chọn một Layer để chỉnh màu!');
      return;
    }

    initialPixelsSnapshot = { ...currentLayer.pixels };

    const hasMask = selectionManager.getCustomMask() && selectionManager.getCustomMask()!.size > 0;
    const hasRect = selectionManager.getSelection() !== null;
    if (badgeTarget) {
      if (hasMask) {
        badgeTarget.innerText = `Vùng chọn (${selectionManager.getCustomMask()!.size} px)`;
      } else if (hasRect) {
        badgeTarget.innerText = 'Vùng chọn chữ nhật';
      } else {
        badgeTarget.innerText = `Toàn bộ Layer (${currentLayer.name})`;
      }
    }

    resetControls();
    switchTab(tabId);
    if (dialog && !dialog.dataset.hasMoved) {
      dialog.style.top = '75px';
      dialog.style.right = '28px';
      dialog.style.left = 'auto';
    }
    modal.style.display = 'block';
  };

  tabsContainer?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.modal-tab-btn') as HTMLElement;
    if (!btn || !btn.dataset.tab) return;
    switchTab(btn.dataset.tab);
    triggerLivePreview();
  });

  const triggerLivePreview = () => {
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    const buffer = canvasEngine.getActiveLayerBuffer();
    if (!currentLayer || !buffer) return;

    if (!chkPreview?.checked) {
      currentLayer.pixels = { ...initialPixelsSnapshot };
      buffer.clear();
      for (const [key, color] of Object.entries(currentLayer.pixels)) {
        if (color) {
          const [x, y] = key.split(',').map(Number);
          buffer.setPixel(x, y, color);
        }
      }
      renderAll();
      return;
    }

    let options: ColorAdjustmentOptions | null = null;
    if (currentActiveTab === 'tab-hsl') {
      const h = parseInt(sliderHue.value, 10) || 0;
      const s = parseInt(sliderSat.value, 10) || 0;
      const l = parseInt(sliderLight.value, 10) || 0;
      options = { type: 'hsl', hue: h, saturation: s, lightness: l };
    } else if (currentActiveTab === 'tab-replace') {
      options = {
        type: 'replace',
        fromColor: colorFromInput.value,
        toColor: colorToInput.value,
        tolerance: parseInt(sliderReplaceTol.value, 10) || 0
      };
    } else if (currentActiveTab === 'tab-contrast') {
      options = {
        type: 'brightness-contrast',
        brightness: parseInt(sliderBright.value, 10) || 0,
        contrast: parseInt(sliderContrast.value, 10) || 0
      };
    }

    if (!options) return;

    let mask = selectionManager.getCustomMask() || undefined;
    if (!mask && selectionManager.getSelection()) {
      const rect = selectionManager.getSelection()!;
      mask = new Set<string>();
      for (let r = 0; r < rect.height; r++) {
        for (let c = 0; c < rect.width; c++) {
          mask.add(coordToKey(rect.x + c, rect.y + r));
        }
      }
    }

    const adjusted = applyColorAdjustment(
      initialPixelsSnapshot as Record<string, string>,
      options,
      mask
    );

    currentLayer.pixels = adjusted;
    buffer.clear();
    for (const [key, color] of Object.entries(adjusted)) {
      if (color) {
        const [x, y] = key.split(',').map(Number);
        buffer.setPixel(x, y, color);
      }
    }
    renderAll();
  };

  sliderHue?.addEventListener('input', () => {
    if (labelHue) labelHue.innerText = `${sliderHue.value}°`;
    triggerLivePreview();
  });
  sliderSat?.addEventListener('input', () => {
    if (labelSat) labelSat.innerText = `${sliderSat.value}%`;
    triggerLivePreview();
  });
  sliderLight?.addEventListener('input', () => {
    if (labelLight) labelLight.innerText = `${sliderLight.value}%`;
    triggerLivePreview();
  });
  btnResetHsl?.addEventListener('click', () => {
    if (sliderHue) sliderHue.value = '0';
    if (sliderSat) sliderSat.value = '0';
    if (sliderLight) sliderLight.value = '0';
    if (labelHue) labelHue.innerText = '0°';
    if (labelSat) labelSat.innerText = '0%';
    if (labelLight) labelLight.innerText = '0%';
    triggerLivePreview();
  });

  colorFromInput?.addEventListener('input', () => {
    if (colorFromHex) colorFromHex.innerText = colorFromInput.value;
    triggerLivePreview();
  });
  colorToInput?.addEventListener('input', () => {
    if (colorToHex) colorToHex.innerText = colorToInput.value;
    triggerLivePreview();
  });
  sliderReplaceTol?.addEventListener('input', () => {
    if (labelReplaceTol) labelReplaceTol.innerText = sliderReplaceTol.value;
    triggerLivePreview();
  });

  sliderBright?.addEventListener('input', () => {
    if (labelBright) labelBright.innerText = sliderBright.value;
    triggerLivePreview();
  });
  sliderContrast?.addEventListener('input', () => {
    if (labelContrast) labelContrast.innerText = sliderContrast.value;
    triggerLivePreview();
  });

  btnQuickInvert?.addEventListener('click', () => {
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    const buffer = canvasEngine.getActiveLayerBuffer();
    if (!currentLayer || !buffer) return;

    let mask = selectionManager.getCustomMask() || undefined;
    const adjusted = applyColorAdjustment(
      currentLayer.pixels as Record<string, string>,
      { type: 'invert' },
      mask
    );

    currentLayer.pixels = adjusted;
    buffer.clear();
    for (const [key, color] of Object.entries(adjusted)) {
      if (color) {
        const [x, y] = key.split(',').map(Number);
        buffer.setPixel(x, y, color);
      }
    }
    renderAll();
  });

  chkPreview?.addEventListener('change', triggerLivePreview);

  const handleCancel = () => {
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    const buffer = canvasEngine.getActiveLayerBuffer();
    if (currentLayer && buffer) {
      currentLayer.pixels = { ...initialPixelsSnapshot };
      buffer.clear();
      for (const [key, color] of Object.entries(currentLayer.pixels)) {
        if (color) {
          const [x, y] = key.split(',').map(Number);
          buffer.setPixel(x, y, color);
        }
      }
      renderAll();
    }
    modal.style.display = 'none';
  };

  btnClose?.addEventListener('click', handleCancel);
  btnCancel?.addEventListener('click', handleCancel);

  btnApply?.addEventListener('click', () => {
    const currentLayer = canvasEngine.getCurrentFrame()?.layers.find(l => l.id === project.activeLayerId);
    if (!currentLayer) return;

    const changes: PixelChange[] = [];
    const allKeys = new Set([...Object.keys(initialPixelsSnapshot), ...Object.keys(currentLayer.pixels)]);

    for (const key of allKeys) {
      const oldCol = initialPixelsSnapshot[key] || null;
      const newCol = currentLayer.pixels[key] || null;
      if (oldCol !== newCol) {
        const [x, y] = key.split(',').map(Number);
        changes.push({
          x,
          y,
          oldColor: oldCol,
          newColor: newCol,
          layerId: project.activeLayerId,
          frameIndex: project.activeFrameIndex
        });
      }
    }

    if (changes.length > 0) {
      history.pushStep(changes);
    }

    modal.style.display = 'none';
    renderAll();
  });

  document.getElementById('menu-adj-hsl')?.addEventListener('click', () => openModal('tab-hsl'));
  document.getElementById('menu-adj-replace')?.addEventListener('click', () => openModal('tab-replace'));
  document.getElementById('menu-adj-brightness')?.addEventListener('click', () => openModal('tab-contrast'));
  document.getElementById('menu-adj-invert')?.addEventListener('click', () => {
    openModal('tab-contrast');
    btnQuickInvert?.click();
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      openModal('tab-hsl');
    }
  });
}

// 16. Khoi dong ung dung
loadPalette('endesga-32');
renderAll();
initAppMenuBar();
initColorAdjustmentsModal();
initWebSocketBridge();
initAiPixelModal();
initGalleryModal();
initResizeModal();
initImageImport();
initExportModal();
