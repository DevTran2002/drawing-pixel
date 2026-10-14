import { describe, it, expect } from 'vitest';
import { HistoryManager, PixelChange } from '../src/core/history-manager';
import { PixelBuffer } from '../src/core/pixel-buffer';

describe('HistoryManager Core', () => {
  it('thuc hien undo va redo chinh xac cho cac thay doi diem anh', () => {
    const buffer = new PixelBuffer(8, 8);
    const history = new HistoryManager(30);

    // Thay doi 1
    const change1: PixelChange[] = [
      { x: 1, y: 1, oldColor: null, newColor: '#ff0000' }
    ];
    buffer.setPixel(1, 1, '#ff0000');
    history.pushStep(change1);

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    // Undo
    history.undo((changes) => {
      for (const ch of changes) {
        buffer.setPixel(ch.x, ch.y, ch.oldColor);
      }
    });

    expect(buffer.getPixel(1, 1)).toBeNull();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    // Redo
    history.redo((changes) => {
      for (const ch of changes) {
        buffer.setPixel(ch.x, ch.y, ch.newColor);
      }
    });

    expect(buffer.getPixel(1, 1)).toBe('#ff0000');
  });
});
