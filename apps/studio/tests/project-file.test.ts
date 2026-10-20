import { describe, it, expect } from 'vitest';
import { exportToPxDraw, importFromPxDraw, validatePxDraw } from '../src/core/project-file';
import { CanvasProject } from '@pixel-draw/shared-types';

describe('Project File Serializer .pxdraw', () => {
  const sampleProject: CanvasProject = {
    id: 'proj_test',
    name: 'Sample Knight',
    width: 32,
    height: 32,
    pivot: { x: 16, y: 32 },
    activeFrameIndex: 0,
    activeLayerId: 'l1',
    frames: [
      {
        id: 'f1',
        durationMs: 100,
        layers: [
          {
            id: 'l1',
            name: 'Base Layer',
            visible: true,
            locked: false,
            opacity: 1,
            pixels: { '0,0': '#ff0000' }
          }
        ]
      }
    ],
    clips: []
  };

  it('xuat chuoi JSON hop le va chua du thong tin phien ban 2.0', () => {
    const output = exportToPxDraw(sampleProject);
    const parsed = JSON.parse(output);
    expect(parsed.format).toBe('pxdraw');
    expect(parsed.version).toBe('2.0');
    expect(validatePxDraw(parsed)).toBe(true);
  });

  it('khoi phuc chinh xac du lieu CanvasProject khi doc tu JSON', () => {
    const output = exportToPxDraw(sampleProject);
    const imported = importFromPxDraw(output);
    expect(imported.name).toBe('Sample Knight');
    expect(imported.width).toBe(32);
    expect(imported.height).toBe(32);
    expect(imported.frames[0].layers[0].pixels['0,0']).toBe('#ff0000');
  });

  it('tu choi file khong hop le khi validate', () => {
    expect(validatePxDraw(null)).toBe(false);
    expect(validatePxDraw({})).toBe(false);
    expect(validatePxDraw({ format: 'invalid' })).toBe(false);
  });
});
