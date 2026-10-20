// apps/server/src/gallery-manager.ts
// Quan ly kho luu tru anh va metadata trong storage/gallery

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportPngBuffer, saveToFile } from './exporter';
import { CanvasProject, FrameData, PixelColor } from '@pixel-draw/shared-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GalleryItem {
  id: string;
  filename: string;
  name: string;
  createdAt: string;
  width: number;
  height: number;
  sourceType: 'ai' | 'custom';
  prompt?: string;
  thumbnailBase64?: string;
  projectFile?: string; // Ten file JSON luu toan bo frames, layers, clips
  frameCount?: number; // So luong frame hoat anh
  layerCount?: number; // So luong layer
  hasProjectData?: boolean; // Co luu du lieu du an nguyen ban hay khong
}

// Tim thu muc goc cua du an (d:\pixel_draw)
function getProjectRoot(): string {
  let cur = __dirname;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'package.json')) && fs.existsSync(path.join(cur, 'apps'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return process.cwd();
}

export class GalleryManager {
  private galleryDir: string;
  private metadataPath: string;

  constructor() {
    const root = getProjectRoot();
    this.galleryDir = path.join(root, 'storage', 'gallery');
    this.metadataPath = path.join(this.galleryDir, 'metadata.json');

    if (!fs.existsSync(this.galleryDir)) {
      fs.mkdirSync(this.galleryDir, { recursive: true });
    }

    if (!fs.existsSync(this.metadataPath)) {
      fs.writeFileSync(this.metadataPath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  // Lay toan bo danh sach anh trong kho
  getAllItems(): GalleryItem[] {
    try {
      if (!fs.existsSync(this.metadataPath)) return [];
      const content = fs.readFileSync(this.metadataPath, 'utf-8');
      const items: GalleryItem[] = JSON.parse(content || '[]');

      // Gan them thumbnail base64 de frontend hien thi ngay
      return items.map(item => {
        const filePath = path.join(this.galleryDir, item.filename);
        if (fs.existsSync(filePath)) {
          const buf = fs.readFileSync(filePath);
          return {
            ...item,
            thumbnailBase64: `data:image/png;base64,${buf.toString('base64')}`
          };
        }
        return item;
      });
    } catch (err) {
      console.error('[Gallery] Loi khi doc metadata:', err);
      return [];
    }
  }

  // Luu anh do AI sinh ra vao kho
  saveAiGeneratedItem(sourcePngPath: string, prompt: string, size = 64): GalleryItem {
    const timestamp = Date.now();
    const filename = `ai_portrait_${timestamp}.png`;
    const targetPath = path.join(this.galleryDir, filename);

    // Sao chep tep anh vao thu muc gallery
    if (fs.existsSync(sourcePngPath)) {
      fs.copyFileSync(sourcePngPath, targetPath);
    }

    const newItem: GalleryItem = {
      id: `item_${timestamp}`,
      filename,
      name: `AI Portrait #${timestamp.toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      width: size,
      height: size,
      sourceType: 'ai',
      prompt,
      frameCount: 1,
      layerCount: 1,
      hasProjectData: false
    };

    this.appendMetadata(newItem);
    return newItem;
  }

  // Luu tac pham nguoi dung dang ve tren Canvas vao kho (bao gom toan bo frames, layers va project structure)
  async saveCanvasItem(project: CanvasProject, customName?: string): Promise<GalleryItem> {
    const timestamp = Date.now();
    const filename = `artwork_${timestamp}.png`;
    const targetPath = path.join(this.galleryDir, filename);

    // 1. Gop cac layer cua frame hien tai de xuat anh PNG thumbnail xem truoc
    const currentFrame = project.frames[project.activeFrameIndex] || project.frames[0];
    const mergedPixels: Record<string, PixelColor> = {};

    if (currentFrame) {
      for (const layer of currentFrame.layers) {
        if (!layer.visible) continue;
        for (const [key, color] of Object.entries(layer.pixels)) {
          if (color) mergedPixels[key] = color;
        }
      }
    }

    const buffer = await exportPngBuffer(project.width, project.height, mergedPixels, 1);
    await saveToFile(targetPath, buffer);

    // 2. Luu toan bo du lieu cau truc du an CanvasProject vao file JSON de sau nay co the mo lai va chinh sua day du layer, frame
    const projectFilename = `project_${timestamp}.json`;
    const projectPath = path.join(this.galleryDir, projectFilename);
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');

    // Tinh toan so luong frame va so luong layer lon nhat de hien thi thong tin
    const frameCount = project.frames?.length || 1;
    let maxLayerCount = 1;
    if (project.frames) {
      for (const f of project.frames) {
        if (f.layers && f.layers.length > maxLayerCount) {
          maxLayerCount = f.layers.length;
        }
      }
    }

    const newItem: GalleryItem = {
      id: `item_${timestamp}`,
      filename,
      projectFile: projectFilename,
      name: customName || project.name || `Artwork #${timestamp.toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      width: project.width,
      height: project.height,
      sourceType: 'custom',
      frameCount,
      layerCount: maxLayerCount,
      hasProjectData: true
    };

    this.appendMetadata(newItem);
    return newItem;
  }

  // Doc du lieu du an nguyen ban (tat ca cac frame, layer, animation clips)
  getProjectData(item: GalleryItem): CanvasProject | null {
    try {
      if (!item.projectFile) return null;
      const projectPath = path.join(this.galleryDir, item.projectFile);
      if (!fs.existsSync(projectPath)) return null;
      const raw = fs.readFileSync(projectPath, 'utf-8');
      return JSON.parse(raw) as CanvasProject;
    } catch (err) {
      console.error('[Gallery] Loi khi doc du lieu du an:', err);
      return null;
    }
  }

  // Xoa mot anh khoi kho
  deleteItem(id: string): boolean {
    try {
      const items = this.readRawMetadata();
      const targetIndex = items.findIndex(item => item.id === id);
      if (targetIndex === -1) return false;

      const [removed] = items.splice(targetIndex, 1);
      const filePath = path.join(this.galleryDir, removed.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Xoa kem file project JSON neu co
      if (removed.projectFile) {
        const projPath = path.join(this.galleryDir, removed.projectFile);
        if (fs.existsSync(projPath)) {
          fs.unlinkSync(projPath);
        }
      }

      fs.writeFileSync(this.metadataPath, JSON.stringify(items, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[Gallery] Loi khi xoa item:', err);
      return false;
    }
  }

  // Lay duong dan tep anh de nap len canvas
  getItemFilePath(filename: string): string {
    return path.join(this.galleryDir, filename);
  }

  private readRawMetadata(): GalleryItem[] {
    try {
      if (!fs.existsSync(this.metadataPath)) return [];
      const content = fs.readFileSync(this.metadataPath, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [];
    }
  }

  private appendMetadata(item: GalleryItem): void {
    const items = this.readRawMetadata();
    items.unshift(item); // Them vao dau danh sach de anh moi nhat len dau
    fs.writeFileSync(this.metadataPath, JSON.stringify(items, null, 2), 'utf-8');
  }
}
