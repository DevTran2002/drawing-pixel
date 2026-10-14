import { describe, it, expect } from 'vitest';
import { AnimationController } from '../src/animation/animation-controller';
import { createDefaultProject } from '@pixel-draw/shared-types';

describe('AnimationController Core', () => {
  it('them clip va quan ly danh sach clip theo tag', () => {
    const project = createDefaultProject(24, 24, 'NhanVatHero');
    const controller = new AnimationController(project);

    // Ban dau co 1 frame (index 0) thuoc clip 'idle'
    expect(controller.getClip('idle')?.endFrame).toBe(0);

    // Them clip 'walk' gom 4 frame
    const walkClip = controller.addClip('walk', 4, 12);
    expect(walkClip.name).toBe('walk');
    expect(walkClip.startFrame).toBe(1);
    expect(walkClip.endFrame).toBe(4);
    expect(project.frames.length).toBe(5);
  });

  it('nhan ban frame kem do lech toa do offset phuc vu animation', () => {
    const project = createDefaultProject(16, 16, 'Hero');
    const controller = new AnimationController(project);

    // Ve 1 pixel tai (5, 5) o frame 0 layer 0
    project.frames[0].layers[0].pixels['5,5'] = '#ff0000';

    // Nhan ban frame 0 sang frame moi voi do lech Y = +1 (nhan vat ha xuong 1px)
    const newFrame = controller.duplicateFrameWithOffset(0, 0, 1);
    expect(newFrame.layers[0].pixels['5,6']).toBe('#ff0000');
    expect(newFrame.layers[0].pixels['5,5']).toBeUndefined();
    expect(project.frames.length).toBe(2);
  });

  it('tinh dung chi so frame tiep theo khi chay vong lap theo clip', () => {
    const project = createDefaultProject(16, 16, 'Hero');
    const controller = new AnimationController(project);
    // Tao 4 frames cho clip walk (frames 1 -> 3)
    controller.addClip('walk', 3, 10);
    controller.setActiveClip('walk');

    expect(controller.getNextFrameIndex(1)).toBe(2);
    expect(controller.getNextFrameIndex(2)).toBe(3);
    expect(controller.getNextFrameIndex(3)).toBe(1); // Quay tro lai frame 1 cua clip walk
  });
});
