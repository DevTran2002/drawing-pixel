// apps/studio/src/main.ts
// Diem vao chinh cua ung dung Pixel Art Studio

import {
  createDefaultProject,
  CanvasProject,
  PixelColor,
  Point2D,
  coordToKey,
  McpDrawPayload
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

// 1. Khoi tao trang thai toan cuc cua Studio
const project: CanvasProject = createDefaultProject(24, 24, 'HeroSprite');
const history = new HistoryManager(50);
const animController = new AnimationController(project);

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

// Trang thai cong cu va co ve
let activeTool: ToolType = 'pencil';
let primaryColor: PixelColor = '#ec4899';
let secondaryColor: PixelColor = '#000000';
let brushSize = 1;
let symmetryX = false;
let symmetryY = false;
let onionSkinEnabled = false;

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

// Su kien chuot tren Canvas
mainCanvas.addEventListener('pointerdown', (e) => {
  const pt = canvasEngine.screenToPixel(e.clientX, e.clientY);
  if (!pt) return;

  isPointerDown = true;
  pointerStartPoint = pt;
  currentStrokeChanges = [];

  const isRightClick = e.button === 2;

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
  const pt = canvasEngine.screenToPixel(e.clientX, e.clientY);

  const coordLabel = document.getElementById('cursor-coord');
  if (coordLabel) {
    coordLabel.innerText = pt ? `X: ${pt.x}, Y: ${pt.y}` : 'X: --, Y: --';
  }

  if (!isPointerDown || !pt) return;

  if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') {
    // Khong ve pixel truc tiep luc di chuyen hinh hoc
    return;
  }

  const isRightClick = e.buttons === 2;
  applyBrushAt(pt.x, pt.y, primaryColor, isRightClick);
  canvasEngine.render();
});

window.addEventListener('pointerup', (e) => {
  if (!isPointerDown) return;
  isPointerDown = false;

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

// Chặn menu chuột phải mặc định trên canvas
mainCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Cuộn chuột để thu phóng (Zoom)
mainCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.deltaY < 0) {
    canvasEngine.zoom = Math.min(64, canvasEngine.zoom + 2);
  } else {
    canvasEngine.zoom = Math.max(2, canvasEngine.zoom - 2);
  }
  const zoomBadge = document.getElementById('canvas-zoom-badge');
  if (zoomBadge) {
    zoomBadge.innerText = `${canvasEngine.zoom * 100}%`;
  }
  renderAll();
}, { passive: false });

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

// 6. UI: Quan ly Layer
function renderLayers(): void {
  const container = document.getElementById('layers-list');
  if (!container) return;
  container.innerHTML = '';

  const currentFrame = canvasEngine.getCurrentFrame();
  if (!currentFrame) return;

  for (let i = currentFrame.layers.length - 1; i >= 0; i--) {
    const layer = currentFrame.layers[i];
    const item = document.createElement('div');
    item.className = `layer-item ${layer.id === project.activeLayerId ? 'active' : ''}`;

    item.innerHTML = `
      <span>${layer.name}</span>
      <div class="layer-actions">
        <button class="btn btn-small" data-act="toggle-vis">${layer.visible ? 'Vis' : 'Hide'}</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).dataset.act;
      if (act === 'toggle-vis') {
        layer.visible = !layer.visible;
        renderAll();
        return;
      }
      project.activeLayerId = layer.id;
      renderAll();
    });

    container.appendChild(item);
  }
}

document.getElementById('btn-add-layer')?.addEventListener('click', () => {
  const currentFrame = canvasEngine.getCurrentFrame();
  if (!currentFrame) return;

  const newId = `layer_${Date.now()}`;
  const newLayer = {
    id: newId,
    name: `Layer ${currentFrame.layers.length + 1}`,
    visible: true,
    locked: false,
    opacity: 1.0,
    pixels: {}
  };

  currentFrame.layers.push(newLayer);
  project.activeLayerId = newId;
  canvasEngine.rebuildBuffers();
  renderAll();
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
    `;

    card.addEventListener('click', () => {
      project.activeFrameIndex = idx;
      canvasEngine.rebuildBuffers();
      renderAll();
    });

    container.appendChild(card);
  });
}

document.getElementById('btn-add-frame')?.addEventListener('click', () => {
  animController.addClip(animController.getActiveClip()?.name || 'idle', 1);
  project.activeFrameIndex = project.frames.length - 1;
  canvasEngine.rebuildBuffers();
  renderAll();
});

// Play / Pause Animation
const btnPlayPause = document.getElementById('btn-play-pause');
const btnTogglePlay = document.getElementById('btn-toggle-play');

function togglePlayback(): void {
  const isPlaying = previewPlayer.toggle();
  const label = isPlaying ? 'Pause' : 'Play';
  if (btnPlayPause) btnPlayPause.innerText = label;
  if (btnTogglePlay) btnTogglePlay.innerText = label;
}

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

// 9. Khoi tao Modal va ket noi AI LoRA Stardew Valley
function initAiPortraitModal(): void {
  const modal = document.getElementById('ai-modal');
  const btnOpen = document.getElementById('btn-ai-portrait');
  const btnClose = document.getElementById('btn-close-ai-modal');
  const promptInput = document.getElementById('ai-prompt-input') as HTMLTextAreaElement;
  const statusMsg = document.getElementById('ai-status-msg');
  const statusText = document.getElementById('ai-status-text');
  const btnLoad = document.getElementById('btn-load-existing-ai');
  const btnGenerate = document.getElementById('btn-run-ai-generate');

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  btnClose?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Gan su kien cho cac tag mau
  const tagButtons = document.querySelectorAll('.tag-btn');
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
        statusText.innerText = 'Đang nạp ảnh 64x64 vào Canvas...';
      }
      const res = await fetch('http://127.0.0.1:3055/api/ai/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: 'th_stardew_character_pixel_64x64.png' })
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

  // Sinh anh moi bang AI LoRA
  btnGenerate?.addEventListener('click', async () => {
    const prompt = promptInput?.value.trim();
    if (!prompt) {
      alert('Vui lòng nhập mô tả nhân vật');
      return;
    }

    try {
      if (statusMsg && statusText) {
        statusMsg.style.display = 'block';
        statusText.innerText = 'Đang khởi động AI LoRA và vẽ nhân vật (khoảng 20-30s)...';
      }
      if (btnGenerate) (btnGenerate as HTMLButtonElement).disabled = true;

      const res = await fetch('http://127.0.0.1:3055/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, steps: 15, size: 64 })
      });
      const data = await res.json();
      if (data.success) {
        modal.style.display = 'none';
      } else {
        alert('Lỗi sinh ảnh: ' + (data.error || 'Thao tác thất bại'));
      }
    } catch (err: any) {
      alert('Lỗi kết nối máy chủ AI: ' + err.message);
    } finally {
      if (btnGenerate) (btnGenerate as HTMLButtonElement).disabled = false;
      if (statusMsg) statusMsg.style.display = 'none';
    }
  });
}

// 10. Khoi dong ung dung
loadPalette('endesga-32');
renderAll();
initWebSocketBridge();
initAiPortraitModal();
