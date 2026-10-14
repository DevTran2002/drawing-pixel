import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { StateStore } from '../src/state-store';

describe('StateStore & Bridge Logic', () => {
  it('cap nhat dung ma tran diem anh va offset', () => {
    const store = new StateStore();
    store.createCanvas(10, 10, 'TestSprite');

    const matrix = [
      '#.',
      '.#'
    ];
    const palette = {
      '#': '#ffffff',
      '.': null
    };

    store.applyMatrix(matrix, palette, 2, 2);
    const proj = store.getProject();
    expect(proj.frames[0].layers[0].pixels['2,2']).toBe('#ffffff');
    expect(proj.frames[0].layers[0].pixels['3,3']).toBe('#ffffff');
    expect(proj.frames[0].layers[0].pixels['2,3']).toBeUndefined();
  });

  it('them frame moi vao clip chi dinh', () => {
    const store = new StateStore();
    store.addFrame('walk', true);
    const proj = store.getProject();
    expect(proj.frames.length).toBe(2);
    expect(proj.clips.some(c => c.name === 'walk')).toBe(true);
  });
});
