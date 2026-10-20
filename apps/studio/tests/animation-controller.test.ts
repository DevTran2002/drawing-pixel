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

  it('thay doi thu tu cac frame bang cach keo tha reorder', () => {
    const project = createDefaultProject(16, 16, 'Hero');
    const controller = new AnimationController(project);

    // Tao 3 frames voi cac pixel nhan dien
    project.frames[0].layers[0].pixels['0,0'] = '#ff0000'; // Frame 0: mau do
    controller.addFrameToActiveClip(false);
    project.frames[1].layers[0].pixels['0,0'] = '#00ff00'; // Frame 1: mau xanh la
    controller.addFrameToActiveClip(false);
    project.frames[2].layers[0].pixels['0,0'] = '#0000ff'; // Frame 2: mau xanh duong

    expect(project.frames.length).toBe(3);

    // Di chuyen Frame 2 (xanh duong) len dau tien (index 0)
    const success = controller.reorderFrame(2, 0);
    expect(success).toBe(true);
    expect(project.frames[0].layers[0].pixels['0,0']).toBe('#0000ff');
    expect(project.frames[1].layers[0].pixels['0,0']).toBe('#ff0000');
    expect(project.frames[2].layers[0].pixels['0,0']).toBe('#00ff00');

    // Di chuyen Frame 0 (xanh duong) ve cuoi cung (index 2)
    controller.reorderFrame(0, 2);
    expect(project.frames[0].layers[0].pixels['0,0']).toBe('#ff0000');
    expect(project.frames[1].layers[0].pixels['0,0']).toBe('#00ff00');
    expect(project.frames[2].layers[0].pixels['0,0']).toBe('#0000ff');
  });

  it('an frame va bo qua khi tinh chi so frame tiep theo', () => {
    const project = createDefaultProject(16, 16, 'Hero');
    const controller = new AnimationController(project);

    // Tao 3 frames (0, 1, 2)
    controller.addFrameToActiveClip(false);
    controller.addFrameToActiveClip(false);
    expect(project.frames.length).toBe(3);

    // Cai dat duration
    controller.setFrameDuration(1, 250);
    expect(project.frames[1].durationMs).toBe(250);

    // An frame 1 (hidden)
    controller.toggleFrameHidden(1);
    expect(project.frames[1].hidden).toBe(true);

    // Khi o frame 0, next frame se bo qua frame 1 va nhay thang den frame 2
    expect(controller.getNextFrameIndex(0)).toBe(2);

    // Bo an frame 1
    controller.toggleFrameHidden(1);
    expect(project.frames[1].hidden).toBe(false);
    expect(controller.getNextFrameIndex(0)).toBe(1);
  });
});
