// apps/studio/src/animation/animation-controller.ts
// Quan ly danh sach animation clips, chuyen doi frame va vong lap hoat anh

import {
  AnimationClip,
  CanvasProject,
  FrameData,
  LayerData,
  PixelColor,
  coordToKey,
  keyToCoord
} from '@pixel-draw/shared-types';

export class AnimationController {
  private project: CanvasProject;
  private activeClipName = 'idle';

  constructor(project: CanvasProject) {
    this.project = project;
    this.ensureDefaultClip();
  }

  // Dam bao luon co it nhat mot clip mac dinh
  private ensureDefaultClip(): void {
    if (!this.project.clips || this.project.clips.length === 0) {
      this.project.clips = [{
        id: 'clip_idle',
        name: 'idle',
        startFrame: 0,
        endFrame: Math.max(0, this.project.frames.length - 1),
        fps: 10,
        loop: true
      }];
    }
  }

  getClip(name: string): AnimationClip | undefined {
    return this.project.clips.find(c => c.name === name);
  }

  getAllClips(): AnimationClip[] {
    return this.project.clips;
  }

  setActiveClip(name: string): void {
    const clip = this.getClip(name);
    if (clip) {
      this.activeClipName = name;
      this.project.activeFrameIndex = clip.startFrame;
    }
  }

  getActiveClip(): AnimationClip {
    this.ensureDefaultClip();
    return this.getClip(this.activeClipName) || this.project.clips[0];
  }

  // Them clip moi hoac bo sung frame vao clip
  addClip(name: string, frameCount = 1, fps = 10, loop = true): AnimationClip {
    let clip = this.getClip(name);
    const startFrame = this.project.frames.length;
    if (!clip) {
      clip = {
        id: `clip_${Date.now()}_${name}`,
        name,
        startFrame,
        endFrame: startFrame + frameCount - 1,
        fps,
        loop
      };
      this.project.clips.push(clip);
    }

    const templateFrame = this.project.frames[this.project.frames.length - 1] || this.project.frames[0];
    for (let i = 0; i < frameCount; i++) {
      const newLayers: LayerData[] = templateFrame ? templateFrame.layers.map(layer => ({
        id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        pixels: { ...layer.pixels }
      })) : [];

      const newFrame: FrameData = {
        id: `frame_${Date.now()}_${i}`,
        durationMs: templateFrame?.durationMs || 100,
        layers: newLayers
      };

      this.project.frames.push(newFrame);
    }

    clip.endFrame = clip.startFrame + frameCount - 1;
    return clip;
  }

  // Them mot frame vao clip dang hoat dong
  addFrameToActiveClip(copyPrevious = true): FrameData {
    const clip = this.getActiveClip();
    const curIdx = this.project.activeFrameIndex;
    const currentFrame = this.project.frames[curIdx] || this.project.frames[0];

    const newLayers: LayerData[] = currentFrame.layers.map(layer => ({
      id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      pixels: copyPrevious ? { ...layer.pixels } : {}
    }));

    const newFrame: FrameData = {
      id: `frame_${Date.now()}`,
      durationMs: currentFrame.durationMs || 100,
      layers: newLayers
    };

    // Chen ngay sau frame hien tai hoac o cuoi clip
    const insertIndex = Math.min(curIdx + 1, this.project.frames.length);
    this.project.frames.splice(insertIndex, 0, newFrame);

    // Mo rong endFrame cua clip hien tai
    clip.endFrame = Math.max(clip.endFrame + 1, this.project.frames.length - 1);

    // Cap nhat vi tri cac clip phia sau neu co
    for (const c of this.project.clips) {
      if (c !== clip && c.startFrame >= insertIndex) {
        c.startFrame++;
        c.endFrame++;
      }
    }

    this.project.activeFrameIndex = insertIndex;
    if (newLayers.length > 0) {
      this.project.activeLayerId = newLayers[0].id;
    }
    return newFrame;
  }

  // Nhan ban frame hien tai
  duplicateActiveFrame(): FrameData {
    return this.addFrameToActiveClip(true);
  }

  // Xoa mot frame khoi du an
  deleteFrame(frameIndex: number): boolean {
    if (this.project.frames.length <= 1) {
      return false; // Luon giu it nhat 1 frame
    }

    const clip = this.getActiveClip();
    this.project.frames.splice(frameIndex, 1);

    // Thu hep endFrame cua clip
    if (clip.endFrame > clip.startFrame) {
      clip.endFrame--;
    }

    // Dieu chinh vi tri activeFrameIndex
    if (this.project.activeFrameIndex >= this.project.frames.length) {
      this.project.activeFrameIndex = this.project.frames.length - 1;
    }

    const currentFrame = this.project.frames[this.project.activeFrameIndex];
    if (currentFrame && currentFrame.layers.length > 0) {
      const hasLayer = currentFrame.layers.some(l => l.id === this.project.activeLayerId);
      if (!hasLayer) {
        this.project.activeLayerId = currentFrame.layers[0].id;
      }
    }

    return true;
  }

  // Nhan ban frame va ap dung do lech toa do (phuc vu tao hoat anh nhan vat)
  duplicateFrameWithOffset(sourceIndex: number, offsetX: number, offsetY: number): FrameData {
    const sourceFrame = this.project.frames[sourceIndex];
    if (!sourceFrame) {
      throw new Error(`Frame tai index ${sourceIndex} khong ton tai`);
    }

    const newLayers: LayerData[] = sourceFrame.layers.map(layer => {
      const newPixels: Record<string, PixelColor> = {};
      for (const [key, color] of Object.entries(layer.pixels)) {
        if (!color) continue;
        const pt = keyToCoord(key);
        const targetX = pt.x + offsetX;
        const targetY = pt.y + offsetY;
        if (
          targetX >= 0 &&
          targetX < this.project.width &&
          targetY >= 0 &&
          targetY < this.project.height
        ) {
          newPixels[coordToKey(targetX, targetY)] = color;
        }
      }

      return {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        pixels: newPixels
      };
    });

    const newFrame: FrameData = {
      id: `frame_${Date.now()}`,
      durationMs: sourceFrame.durationMs,
      layers: newLayers
    };

    const insertIndex = this.project.frames.length;
    this.project.frames.push(newFrame);

    const activeClip = this.getActiveClip();
    activeClip.endFrame = this.project.frames.length - 1;

    return newFrame;
  }

  // Tinh frame tiep theo theo vong lap cua clip
  getNextFrameIndex(currentFrame: number): number {
    const clip = this.getActiveClip();
    if (!clip || clip.startFrame === clip.endFrame) {
      return clip ? clip.startFrame : 0;
    }

    if (currentFrame < clip.startFrame || currentFrame >= clip.endFrame) {
      return clip.startFrame;
    }

    return currentFrame + 1;
  }
}
