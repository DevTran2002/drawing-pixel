// apps/studio/src/core/project-file.ts
// Module dong goi va trich xuat file du an Pixel Draw (.pxdraw)

import { CanvasProject, AnimationClip } from '@pixel-draw/shared-types';

export interface PxDrawProjectContainer {
  format: 'pxdraw';
  version: '2.0';
  createdAt: string;
  updatedAt: string;
  project: CanvasProject;
}

// Chuyen doi CanvasProject thanh chuoi JSON dinh dang .pxdraw
export function exportToPxDraw(project: CanvasProject): string {
  const container: PxDrawProjectContainer = {
    format: 'pxdraw',
    version: '2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    project
  };
  return JSON.stringify(container, null, 2);
}

// Kiem tra tinh hop le cua du lieu file .pxdraw
export function validatePxDraw(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (data.format !== 'pxdraw') return false;
  if (!data.project || typeof data.project !== 'object') return false;
  const p = data.project;
  if (typeof p.width !== 'number' || typeof p.height !== 'number') return false;
  if (!Array.isArray(p.frames) || p.frames.length === 0) return false;
  return true;
}

// Doc va giai ma chuoi JSON thanh CanvasProject, tu dong migrate sang he thong thu muc Action Folders
export function importFromPxDraw(jsonStr: string): CanvasProject {
  const data = JSON.parse(jsonStr);
  let project: CanvasProject;
  if (!validatePxDraw(data)) {
    // Ho tro fallback tuong thich nguoc neu file la JSON CanvasProject nguyen ban
    if (data && typeof data === 'object' && Array.isArray(data.frames)) {
      project = data as CanvasProject;
    } else {
      throw new Error('Định dạng file .pxdraw không hợp lệ hoặc bị lỗi cấu trúc');
    }
  } else {
    project = data.project as CanvasProject;
  }

  // Tu dong chuyen doi ho tro he thong thu muc Action Folders
  if (!project.clips || project.clips.length === 0) {
    const baseFrame = project.frames[0];
    const idleFrames = project.frames.length > 1 ? project.frames.slice(1) : [];
    project.clips = [
      {
        id: 'clip_base',
        name: 'base',
        label: 'Tư thế gốc',
        startFrame: 0,
        endFrame: 0,
        fps: 10,
        loop: false,
        frames: [baseFrame],
        isBase: true
      },
      {
        id: 'clip_idle',
        name: 'idle',
        label: 'Đứng im',
        startFrame: 0,
        endFrame: Math.max(0, idleFrames.length - 1),
        fps: 10,
        loop: true,
        frames: idleFrames
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
    project.activeClipId = 'clip_base';
    project.frames = project.clips[0].frames;
  } else {
    // Dam bao moi clip deu co mang frames
    for (const clip of project.clips) {
      if (!clip.frames) {
        clip.frames = [];
      }
    }
    // Dam bao co base clip hop le
    let baseClip: AnimationClip | undefined = project.clips.find(c => c.isBase || c.name === 'base');
    if (!baseClip) {
      baseClip = project.clips[0];
      baseClip.isBase = true;
      if (!baseClip.label) baseClip.label = 'Tư thế gốc';
      if (!baseClip.frames) baseClip.frames = [];
      if (baseClip.frames.length === 0 && project.frames?.length > 0) {
        baseClip.frames = [project.frames[0]];
      }
    } else {
      if (!baseClip.frames) baseClip.frames = [];
    }

    if (!project.activeClipId) {
      project.activeClipId = baseClip.id;
    }
    const currentActive: AnimationClip = project.clips.find(c => c.id === project.activeClipId) || baseClip;
    if (!currentActive.frames) currentActive.frames = [];
    project.frames = currentActive.frames;
  }

  return project;
}

// Tai file du an .pxdraw truc tiep ve may tinh qua trinh duyet
export function downloadProjectFile(project: CanvasProject, customName?: string): void {
  const json = exportToPxDraw(project);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (customName || project.name || 'pixel_project').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'project';
  const filename = `${safeName}.pxdraw`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
