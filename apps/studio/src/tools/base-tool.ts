// apps/studio/src/tools/base-tool.ts
// Interface va lop co so cho cac cong cu tuong tac tren canvas

import { PixelColor, Point2D } from '@pixel-draw/shared-types';
import { PixelBuffer } from '../core/pixel-buffer';
import { HistoryManager, PixelChange } from '../core/history-manager';

export type ToolType =
  | 'pencil'
  | 'eraser'
  | 'bucket'
  | 'eyedropper'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'dither'
  | 'lighten'
  | 'darken'
  | 'select'
  | 'magicwand'
  | 'move';

export interface ToolContext {
  primaryColor: PixelColor;
  secondaryColor: PixelColor;
  brushSize: number; // 1, 2, 3, 4
  symmetryX: boolean;
  symmetryY: boolean;
  activeBuffer: PixelBuffer | undefined;
  history: HistoryManager;
  onColorPicked?: (color: PixelColor) => void;
  onNeedsRender: () => void;
}

export abstract class BaseTool {
  abstract readonly type: ToolType;
  protected isDrawing = false;
  protected currentChanges: PixelChange[] = [];

  abstract onPointerDown(point: Point2D, ctx: ToolContext): void;
  abstract onPointerMove(point: Point2D, ctx: ToolContext): void;
  abstract onPointerUp(point: Point2D, ctx: ToolContext): void;
}
