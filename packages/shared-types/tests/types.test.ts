import { describe, it, expect } from 'vitest';
import { coordToKey, keyToCoord, createDefaultProject } from '../src/index';

describe('Toa do pixel key helper', () => {
  it('chuyen doi qua lai chinh xac giua toa do va key chuoi', () => {
    const key = coordToKey(12, 24);
    expect(key).toBe('12,24');
    const coord = keyToCoord(key);
    expect(coord).toEqual({ x: 12, y: 24 });
  });

  it('tao du an mac dinh voi frame va layer day du', () => {
    const project = createDefaultProject(24, 24, 'NhanVatHero');
    expect(project.name).toBe('NhanVatHero');
    expect(project.width).toBe(24);
    expect(project.height).toBe(24);
    expect(project.frames.length).toBe(1);
    expect(project.frames[0].layers.length).toBe(1);
    expect(project.clips.length).toBe(1);
    expect(project.clips[0].name).toBe('idle');
  });
});
