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

  getActiveClip(): AnimationClip | undefined {
    return this.getClip(this.activeClipName) || this.project.clips[0];
  }

  // Them clip moi voi so luong frame chi dinh
  addClip(name: string, frameCount: number, fps = 10, loop = true): AnimationClip {
    const startFrame = this.project.frames.length;
    const endFrame = startFrame + frameCount - 1;

    // Tao cac frame cho clip moi
    for (let i = 0; i < frameCount; i++) {
      const newFrame: FrameData = {
        id: `frame_${Date.now()}_${startFrame + i}`,
        durationMs: Math.round(1000 / fps),
        layers: this.project.frames[0].layers.map(layer => ({
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          locked: layer.locked,
          opacity: layer.opacity,
          pixels: {}
        }))
      };
      this.project.frames.push(newFrame);
    }

    const clip: AnimationClip = {
      id: `clip_${Date.now()}_${name}`,
      name,
      startFrame,
      endFrame,
      fps,
      loop
    };

    this.project.clips.push(clip);
    return clip;
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

    this.project.frames.push(newFrame);

    // Tu dong mo rong endFrame cua clip hien tai neu dang o cuoi clip
    const activeClip = this.getActiveClip();
    if (activeClip && activeClip.endFrame === this.project.frames.length - 2) {
      activeClip.endFrame = this.project.frames.length - 1;
    }

    return newFrame;
  }

  // Tinh frame tiep theo theo vong lap cua clip
  getNextFrameIndex(currentFrame: number): number {
    const clip = this.getActiveClip();
    if (!clip) {
      return (currentFrame + 1) % this.project.frames.length;
    }

    if (currentFrame < clip.startFrame || currentFrame >= clip.endFrame) {
      return clip.startFrame;
    }

    return currentFrame + 1;
  }
}
