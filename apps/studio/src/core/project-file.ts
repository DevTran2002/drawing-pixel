// apps/studio/src/core/project-file.ts
// Module dong goi va trich xuat file du an Pixel Draw (.pxdraw)

import { CanvasProject } from '@pixel-draw/shared-types';

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

// Doc va giai ma chuoi JSON thanh CanvasProject
export function importFromPxDraw(jsonStr: string): CanvasProject {
  const data = JSON.parse(jsonStr);
  if (!validatePxDraw(data)) {
    // Ho tro fallback tuong thich nguoc neu file la JSON CanvasProject nguyen ban
    if (data && typeof data === 'object' && Array.isArray(data.frames)) {
      return data as CanvasProject;
    }
    throw new Error('Định dạng file .pxdraw không hợp lệ hoặc bị lỗi cấu trúc');
  }
  return data.project as CanvasProject;
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
