// Dinh nghia cac kieu du lieu dung chung cho Pixel Draw Monorepo

export type PixelColor = string | null; // Ma hex nhu '#ff0000', '#ffffff88' hoac null neu trong suot

export interface PixelPoint {
  x: number;
  y: number;
  color: PixelColor;
}

export interface LayerGroup {
  id: string;
  name: string;
  collapsed?: boolean;
  visible?: boolean;
  locked?: boolean;
}

export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.0 den 1.0
  // Luu du lieu pixel dang Record voi key la 'x,y' de de dang serialize qua JSON/WebSocket
  pixels: Record<string, PixelColor>;
  groupId?: string | null; // Id cua nhom chua layer nay (neu co)
}

export interface FrameData {
  id: string;
  durationMs: number; // Thoi gian hien thi tinh bang mili-giay, mac dinh 100ms
  layers: LayerData[];
}

export interface AnimationClip {
  id: string;
  name: string; // Vi du: 'idle', 'walk', 'attack', 'jump'
  startFrame: number; // Chi so frame bat dau (0-indexed)
  endFrame: number; // Chi so frame ket thuc
  fps: number; // Toc do khung hinh (1-60)
  loop: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CanvasProject {
  id: string;
  name: string;
  width: number;
  height: number;
  pivot: Point2D; // Diem neo toa do (thuong la giua chan nhan vat)
  clips: AnimationClip[];
  frames: FrameData[];
  activeFrameIndex: number;
  activeLayerId: string;
  groups?: LayerGroup[]; // Danh sach cac nhom layer
}

// Chuyen doi toa do sang key luu tru dang chuoi
export function coordToKey(x: number, y: number): string {
  return `${Math.floor(x)},${Math.floor(y)}`;
}

// Chuyen doi key chuoi tro lai toa do so
export function keyToCoord(key: string): Point2D {
  const parts = key.split(',');
  return {
    x: parseInt(parts[0], 10),
    y: parseInt(parts[1], 10)
  };
}

// Ham tao du an mac dinh voi 1 frame, 1 layer va 1 clip idle
export function createDefaultProject(
  width = 24,
  height = 24,
  name = 'NewSprite'
): CanvasProject {
  const defaultLayerId = 'layer_1';
  const defaultFrameId = 'frame_1';

  const initialLayer: LayerData = {
    id: defaultLayerId,
    name: 'Layer 1',
    visible: true,
    locked: false,
    opacity: 1.0,
    pixels: {}
  };

  const initialFrame: FrameData = {
    id: defaultFrameId,
    durationMs: 100,
    layers: [initialLayer]
  };

  const defaultClip: AnimationClip = {
    id: 'clip_idle',
    name: 'idle',
    startFrame: 0,
    endFrame: 0,
    fps: 10,
    loop: true
  };

  return {
    id: `proj_${Date.now()}`,
    name,
    width,
    height,
    pivot: {
      x: Math.floor(width / 2),
      y: height - 1
    },
    clips: [defaultClip],
    frames: [initialFrame],
    activeFrameIndex: 0,
    activeLayerId: defaultLayerId,
    groups: []
  };
}

// Cac kieu payload truyen nhan qua WebSocket va MCP
export type McpDrawEventType =
  | 'PROJECT_SYNC'
  | 'DRAW_PIXELS'
  | 'DRAW_MATRIX'
  | 'ADD_FRAME'
  | 'SELECT_FRAME'
  | 'ADD_LAYER'
  | 'EXPORT_REQUEST'
  | 'AI_PROGRESS';

export interface McpDrawPayload {
  type: McpDrawEventType;
  projectId?: string;
  pixels?: PixelPoint[];
  matrix?: string[];
  paletteMap?: Record<string, PixelColor>;
  offsetX?: number;
  offsetY?: number;
  layerId?: string;
  frameIndex?: number;
  clipName?: string;
  durationMs?: number;
  scale?: number;
  outputPath?: string;
}
