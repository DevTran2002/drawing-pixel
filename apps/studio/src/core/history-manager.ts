// apps/studio/src/core/history-manager.ts
// Quan ly ngan xep Undo / Redo cho cac thao tac ve

import { PixelColor } from '@pixel-draw/shared-types';

export interface PixelChange {
  x: number;
  y: number;
  oldColor: PixelColor;
  newColor: PixelColor;
  layerId?: string;
  frameIndex?: number;
}

export type HistoryStep = PixelChange[];

export class HistoryManager {
  private undoStack: HistoryStep[] = [];
  private redoStack: HistoryStep[] = [];
  readonly maxSteps: number;

  constructor(maxSteps = 50) {
    this.maxSteps = maxSteps;
  }

  // Them mot buoc thao tac moi vao ngan xep Undo
  pushStep(changes: PixelChange[]): void {
    if (changes.length === 0) return;
    this.undoStack.push(changes);
    if (this.undoStack.length > this.maxSteps) {
      this.undoStack.shift(); // Xoa bot buoc cu nhat khi vuot qua gioi han
    }
    // Khi co thao tac moi thi xoa toan bo ngan xep Redo
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Thuc hien Undo va truyen danh sach thay doi nguoc cho callback xu ly
  undo(applyCallback: (changes: PixelChange[]) => void): boolean {
    const step = this.undoStack.pop();
    if (!step) return false;
    this.redoStack.push(step);
    applyCallback(step);
    return true;
  }

  // Thuc hien Redo va truyen danh sach thay doi xuoi cho callback xu ly
  redo(applyCallback: (changes: PixelChange[]) => void): boolean {
    const step = this.redoStack.pop();
    if (!step) return false;
    this.undoStack.push(step);
    applyCallback(step);
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
