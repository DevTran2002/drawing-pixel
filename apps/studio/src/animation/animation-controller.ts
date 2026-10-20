// apps/studio/src/animation/animation-controller.ts
// Quan ly danh sach thu muc hoat anh (Action Folders / Clips), frame va vong lap chuyen dong

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
    this.ensureDefaultClips();
  }

  // Dam bao du an luon co day du cac thu muc dong tac co ban
  private ensureDefaultClips(): void {
    if (!this.project.clips || this.project.clips.length === 0) {
      const initialFrame: FrameData = this.project.frames?.[0] || {
        id: `frame_${Date.now()}`,
        durationMs: 100,
        layers: [
          {
            id: 'layer_1',
            name: 'Layer 1',
            visible: true,
            locked: false,
            opacity: 1.0,
            pixels: {}
          }
        ]
      };

      this.project.clips = [
        {
          id: 'clip_base',
          name: 'base',
          label: 'Tư thế gốc',
          startFrame: 0,
          endFrame: 0,
          fps: 10,
          loop: false,
          frames: [initialFrame],
          isBase: true
        },
        {
          id: 'clip_idle',
          name: 'idle',
          label: 'Đứng im',
          startFrame: 0,
          endFrame: 0,
          fps: 10,
          loop: true,
          frames: []
        },
        {
          id: 'clip_run',
          name: 'run',
          label: 'Chạy bộ',
          startFrame: 0,
          endFrame: 0,
          fps: 12,
          loop: true,
          frames: []
        }
      ];
    }

    // Dam bao tat ca clip deu co mang frames
    for (const clip of this.project.clips) {
      if (!clip.frames) {
        clip.frames = [];
      }
    }

    // Neu chua co clip_base, tim hoac danh dau clip dau tien la base
    let baseClip = this.project.clips.find(c => c.isBase || c.name === 'base');
    if (!baseClip) {
      baseClip = this.project.clips[0];
      baseClip.isBase = true;
      if (!baseClip.label) baseClip.label = 'Tư thế gốc';
      if (!baseClip.frames) baseClip.frames = [];
      if (baseClip.frames.length === 0 && this.project.frames?.length > 0) {
        baseClip.frames = [...this.project.frames];
      }
    } else {
      if (!baseClip.frames) baseClip.frames = [];
    }

    // Xac dinh thu muc hoat dong mac dinh
    if (!this.project.activeClipId) {
      this.project.activeClipId = baseClip ? baseClip.id : this.project.clips[0].id;
    }

    // Dong bo tham chieu mang frames cua project theo clip dang kich hoat
    const activeClip = this.getActiveClip();
    if (!activeClip.frames) activeClip.frames = [];
    this.project.frames = activeClip.frames;
  }

  // Lay clip theo ten dong tac
  getClip(name: string): AnimationClip | undefined {
    return this.project.clips.find(c => c.name === name);
  }

  // Lay clip theo dinh danh ID duy nhat
  getClipById(id: string): AnimationClip | undefined {
    return this.project.clips.find(c => c.id === id);
  }

  // Lay toan bo danh sach cac thu muc dong tac
  getAllClips(): AnimationClip[] {
    return this.project.clips;
  }

  // Lay thu muc nhan vat goc (Base Pose)
  getBaseClip(): AnimationClip {
    const base = this.project.clips.find(c => c.isBase || c.name === 'base');
    return base || this.project.clips[0];
  }

  // Lay thu muc dong tac dang kich hoat
  getActiveClip(): AnimationClip {
    if (this.project.activeClipId) {
      const byId = this.getClipById(this.project.activeClipId);
      if (byId) return byId;
    }
    const byName = this.getClip(this.activeClipName);
    if (byName) return byName;
    return this.project.clips[0];
  }

  // Kich hoat thu muc dong tac theo ten
  setActiveClip(name: string): void {
    const clip = this.getClip(name);
    if (clip) {
      this.setActiveClipById(clip.id);
    }
  }

  // Kich hoat thu muc dong tac theo ID (Chuyen doi giua cac tab tren footer)
  setActiveClipById(clipId: string): void {
    const targetClip = this.getClipById(clipId);
    if (!targetClip) return;

    this.project.activeClipId = targetClip.id;
    this.activeClipName = targetClip.name;

    // Dam bao thu muc co mang frames hop le
    if (!targetClip.frames) {
      targetClip.frames = [];
    }

    const isLegacySubClip = (targetClip.startFrame ?? 0) > 0 && this.project.frames.length > targetClip.frames.length;
    if (isLegacySubClip) {
      // Che do flat array tuong thich cu
      this.project.activeFrameIndex = targetClip.startFrame;
    } else {
      // Che do Action Folder: cach ly frames rieng cho thu muc
      this.project.frames = targetClip.frames;
      this.project.activeFrameIndex = 0;
      targetClip.startFrame = 0;
      targetClip.endFrame = Math.max(0, targetClip.frames.length - 1);
    }

    // Dong bo layer hien tai
    const activeFrame = this.project.frames[this.project.activeFrameIndex];
    if (activeFrame && activeFrame.layers.length > 0) {
      this.project.activeLayerId = activeFrame.layers[0].id;
    }
  }

  // Tao thu muc dong tac moi
  addFolderClip(name: string, label?: string, fps = 10, loop = true): AnimationClip {
    const existing = this.getClip(name);
    if (existing) {
      return existing;
    }

    const newClip: AnimationClip = {
      id: `clip_${Date.now()}_${name}`,
      name,
      label: label || name,
      startFrame: 0,
      endFrame: 0,
      fps,
      loop,
      frames: []
    };

    this.project.clips.push(newClip);
    return newClip;
  }

  // Xoa thu muc dong tac (Bao ve khong cho xoa thu muc nhan vat goc)
  removeFolderClip(clipId: string): boolean {
    const clip = this.getClipById(clipId);
    if (!clip) return false;

    // Ngan chan xoa thu muc Base Pose
    if (clip.isBase || clip.name === 'base') {
      return false;
    }

    // Luon giu it nhat 1 thu muc
    if (this.project.clips.length <= 1) {
      return false;
    }

    const index = this.project.clips.findIndex(c => c.id === clipId);
    if (index === -1) return false;

    this.project.clips.splice(index, 1);

    // Neu thu muc bi xoa dang mo, tu dong quay ve thu muc Base Pose
    if (this.project.activeClipId === clipId) {
      const base = this.getBaseClip();
      this.setActiveClipById(base.id);
    }

    return true;
  }

  // Cap nhat toan bo frames cho mot thu muc dong tac
  setClipFrames(clipId: string, frames: FrameData[]): void {
    const clip = this.getClipById(clipId);
    if (!clip) return;

    clip.frames = frames;
    clip.startFrame = 0;
    clip.endFrame = Math.max(0, frames.length - 1);

    if (this.project.activeClipId === clipId) {
      this.project.frames = frames;
      this.project.activeFrameIndex = 0;
      if (frames[0]?.layers?.[0]) {
        this.project.activeLayerId = frames[0].layers[0].id;
      }
    }
  }

  // Them clip (Tuong thich nguoc voi flat array va ho tro ca action folder)
  addClip(name: string, frameCount = 1, fps = 10, loop = true): AnimationClip {
    let clip = this.getClip(name);
    const startFrame = this.project.frames.length;
    if (!clip) {
      clip = {
        id: `clip_${Date.now()}_${name}`,
        name,
        label: name,
        startFrame,
        endFrame: startFrame + frameCount - 1,
        fps,
        loop,
        frames: []
      };
      this.project.clips.push(clip);
    }

    const baseClip = this.getBaseClip();
    const templateFrame = this.project.frames[this.project.frames.length - 1] || baseClip.frames?.[0];
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

      if (!clip.frames) clip.frames = [];
      clip.frames.push(newFrame);
      if (this.project.frames !== clip.frames) {
        this.project.frames.push(newFrame);
      }
    }

    clip.endFrame = clip.startFrame + frameCount - 1;
    return clip;
  }

  // Them mot frame vao thu muc dong tac dang hoat dong
  addFrameToActiveClip(copyPrevious = true): FrameData {
    const clip = this.getActiveClip();
    clip.frames = clip.frames || [];

    const curIdx = this.project.activeFrameIndex;
    const currentFrame = clip.frames[curIdx] || this.getBaseClip().frames?.[0] || this.project.frames[0];

    const newLayers: LayerData[] = currentFrame ? currentFrame.layers.map(layer => ({
      id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      pixels: copyPrevious ? { ...layer.pixels } : {}
    })) : [
      {
        id: `layer_${Date.now()}`,
        name: 'Layer 1',
        visible: true,
        locked: false,
        opacity: 1.0,
        pixels: {}
      }
    ];

    const newFrame: FrameData = {
      id: `frame_${Date.now()}`,
      durationMs: currentFrame?.durationMs || 100,
      layers: newLayers
    };

    if (clip.frames.length === 0) {
      clip.frames.push(newFrame);
      this.project.activeFrameIndex = 0;
    } else {
      const insertIndex = Math.min(curIdx + 1, clip.frames.length);
      clip.frames.splice(insertIndex, 0, newFrame);
      this.project.activeFrameIndex = insertIndex;
    }

    clip.endFrame = Math.max(0, clip.frames.length - 1);
    this.project.frames = clip.frames;

    if (newLayers.length > 0) {
      this.project.activeLayerId = newLayers[0].id;
    }

    return newFrame;
  }

  // Nhan ban frame hien tai trong thu muc
  duplicateActiveFrame(): FrameData {
    return this.addFrameToActiveClip(true);
  }

  // Xoa mot frame khoi thu muc dang hoat dong
  deleteFrame(frameIndex: number): boolean {
    const clip = this.getActiveClip();
    clip.frames = clip.frames || [];

    // Thu muc nhan vat goc bat buoc luon phai giu lai it nhat 1 frame
    if (clip.isBase && clip.frames.length <= 1) {
      return false;
    }

    if (clip.frames.length === 0 || frameIndex < 0 || frameIndex >= clip.frames.length) {
      return false;
    }

    clip.frames.splice(frameIndex, 1);
    clip.endFrame = Math.max(0, clip.frames.length - 1);

    if (this.project.activeFrameIndex >= clip.frames.length) {
      this.project.activeFrameIndex = Math.max(0, clip.frames.length - 1);
    }

    const currentFrame = clip.frames[this.project.activeFrameIndex];
    if (currentFrame && currentFrame.layers.length > 0) {
      const hasLayer = currentFrame.layers.some(l => l.id === this.project.activeLayerId);
      if (!hasLayer) {
        this.project.activeLayerId = currentFrame.layers[0].id;
      }
    }

    return true;
  }

  // Thay doi thu tu sap xep cua frame trong thu muc (phuc vu keo tha timeline)
  reorderFrame(fromIndex: number, toIndex: number): boolean {
    const clip = this.getActiveClip();
    clip.frames = clip.frames || [];

    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      fromIndex >= clip.frames.length ||
      toIndex < 0 ||
      toIndex >= clip.frames.length
    ) {
      return false;
    }

    const activeFrame = clip.frames[this.project.activeFrameIndex];

    const [movedFrame] = clip.frames.splice(fromIndex, 1);
    clip.frames.splice(toIndex, 0, movedFrame);

    const newActiveIndex = clip.frames.indexOf(activeFrame);
    this.project.activeFrameIndex = newActiveIndex !== -1 ? newActiveIndex : 0;

    return true;
  }

  // Nhan ban frame va ap dung do lech toa do
  duplicateFrameWithOffset(sourceIndex: number, offsetX: number, offsetY: number): FrameData {
    const clip = this.getActiveClip();
    clip.frames = clip.frames || [];

    const sourceFrame = clip.frames[sourceIndex] || this.getBaseClip().frames?.[0];
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

    clip.frames.push(newFrame);
    clip.endFrame = clip.frames.length - 1;
    this.project.frames = clip.frames;

    return newFrame;
  }

  // Bat / tat che do an frame khi phat hoat canh
  toggleFrameHidden(index: number): boolean {
    const clip = this.getActiveClip();
    const frame = clip.frames?.[index];
    if (!frame) return false;
    frame.hidden = !frame.hidden;
    return true;
  }

  // Cai dat thoi gian hien thi cho frame (mili-giay)
  setFrameDuration(index: number, durationMs: number): boolean {
    const clip = this.getActiveClip();
    const frame = clip.frames?.[index];
    if (!frame) return false;
    frame.durationMs = Math.max(10, Math.min(10000, durationMs));
    return true;
  }

  // Tinh frame tiep theo theo vong lap cua thu muc dang mo
  getNextFrameIndex(currentFrame: number): number {
    const clip = this.getActiveClip();
    if (!clip) return 0;

    const isLegacySubClip = (clip.startFrame ?? 0) > 0 && this.project.frames.length > (clip.frames?.length || 0);
    const frames = isLegacySubClip ? this.project.frames : (clip.frames && clip.frames.length > 0 ? clip.frames : this.project.frames);
    if (!frames || frames.length === 0) {
      return 0;
    }

    const start = isLegacySubClip ? clip.startFrame : 0;
    const end = isLegacySubClip ? clip.endFrame : frames.length - 1;

    if (start >= end) {
      return start;
    }

    const clipLength = end - start + 1;
    let next = currentFrame + 1;
    if (next < start || next > end) {
      next = start;
    }

    // Neu frame tiep theo bi an, bo qua va tim frame tiep theo chua bi an
    let attempts = 0;
    while (frames[next]?.hidden && attempts < clipLength) {
      next++;
      if (next > end) {
        next = start;
      }
      attempts++;
    }

    // Neu toan bo frame trong clip deu bi an, giu nguyen frame
    if (attempts >= clipLength) {
      return currentFrame;
    }

    return next;
  }
}
