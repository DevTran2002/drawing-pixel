// apps/server/src/asset-manager.ts
// Quan ly cay thu muc tai nguyen du an (Project Asset Tree) va anh thumbnail phong cach Unity

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ProjectAssetItem,
  ProjectAssetTree,
  createDefaultAssetTree,
  PixelColor,
  LayerData
} from '@pixel-draw/shared-types';
import { exportPngBuffer } from './exporter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export interface SaveSpritePayload {
  name: string;
  folderPath: string;
  data: {
    width: number;
    height: number;
    pixels: Record<string, PixelColor>;
    layers?: LayerData[];
  };
}

export class ProjectAssetManager {
  private assetsDir: string;
  private thumbnailsDir: string;
  private metadataPath: string;

  constructor() {
    const root = getProjectRoot();
    this.assetsDir = path.join(root, 'storage', 'project_assets');
    this.thumbnailsDir = path.join(this.assetsDir, 'thumbnails');
    this.metadataPath = path.join(this.assetsDir, 'tree_metadata.json');

    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
    }
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }

    if (!fs.existsSync(this.metadataPath)) {
      const defaultTree = createDefaultAssetTree();
      fs.writeFileSync(this.metadataPath, JSON.stringify(defaultTree.items, null, 2), 'utf-8');
    }
  }

  // Doc danh sach tat ca cac item tu file metadata
  private readItems(): ProjectAssetItem[] {
    try {
      if (!fs.existsSync(this.metadataPath)) {
        return createDefaultAssetTree().items;
      }
      const raw = fs.readFileSync(this.metadataPath, 'utf-8');
      const items: ProjectAssetItem[] = JSON.parse(raw || '[]');
      return items;
    } catch (err) {
      console.error('[AssetManager] Loi khi doc metadata cay tai nguyen:', err);
      return createDefaultAssetTree().items;
    }
  }

  // Ghi danh sach item vao file metadata
  private writeItems(items: ProjectAssetItem[]): void {
    try {
      fs.writeFileSync(this.metadataPath, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AssetManager] Loi khi ghi metadata cay tai nguyen:', err);
    }
  }

  // Lay toan bo cay tai nguyen kem so luong item con va du lieu thumbnail Base64
  public getAssetTree(): ProjectAssetTree {
    const items = this.readItems();

    // Tinh so luong con cho tung thu muc
    const countMap: Record<string, number> = {};
    for (const item of items) {
      if (item.parentPath) {
        countMap[item.parentPath] = (countMap[item.parentPath] || 0) + 1;
      }
    }

    const processedItems: ProjectAssetItem[] = items.map(item => {
      if (item.type === 'folder') {
        return {
          ...item,
          childrenCount: countMap[item.path] || 0
        };
      }

      // Neu la sprite, kiem tra va nap thumbnail neu chua co san data URL
      if (item.type === 'sprite' && (!item.thumbnailUrl || !item.thumbnailUrl.startsWith('data:'))) {
        const thumbFile = path.join(this.thumbnailsDir, `${item.id}.png`);
        if (fs.existsSync(thumbFile)) {
          const buf = fs.readFileSync(thumbFile);
          return {
            ...item,
            thumbnailUrl: `data:image/png;base64,${buf.toString('base64')}`
          };
        }
      }

      return item;
    });

    return { items: processedItems };
  }

  // Tao thu muc moi trong cay tai nguyen
  public createFolder(name: string, parentPath: string): ProjectAssetItem {
    const items = this.readItems();
    const cleanName = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
    const folderPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;

    // Kiem tra thu muc da ton tai chua
    const existing = items.find(i => i.path === folderPath && i.type === 'folder');
    if (existing) {
      return existing;
    }

    const newItem: ProjectAssetItem = {
      id: `folder_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      type: 'folder',
      path: folderPath,
      parentPath: parentPath,
      createdAt: Date.now(),
      childrenCount: 0
    };

    items.push(newItem);
    this.writeItems(items);
    return newItem;
  }

  // Luu mot sprite moi vao thu muc chi dinh kem sinh thumbnail PNG
  public async saveSprite(payload: SaveSpritePayload): Promise<ProjectAssetItem> {
    const items = this.readItems();
    const cleanName = payload.name.trim().replace(/[/\\?%*:|"<>]/g, '_') || `Sprite_${Date.now()}`;
    const id = `sprite_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const spritePath = `${payload.folderPath}/${cleanName}`;

    // Sinh thumbnail PNG tu pixel data voi ti le phong to scale = 4 de xem ro net
    let thumbnailUrl = '';
    try {
      const pngBuffer = await exportPngBuffer(
        payload.data.width,
        payload.data.height,
        payload.data.pixels,
        4
      );
      const thumbFile = path.join(this.thumbnailsDir, `${id}.png`);
      fs.writeFileSync(thumbFile, pngBuffer);
      thumbnailUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    } catch (err) {
      console.error('[AssetManager] Loi khi sinh thumbnail PNG:', err);
    }

    const newItem: ProjectAssetItem = {
      id,
      name: cleanName,
      type: 'sprite',
      path: spritePath,
      parentPath: payload.folderPath,
      thumbnailUrl,
      data: payload.data,
      createdAt: Date.now()
    };

    items.push(newItem);
    this.writeItems(items);
    return newItem;
  }

  // Xoa mot item (neu la thu muc thi xoa de quy toan bo item con)
  public deleteItem(targetPath: string): boolean {
    const items = this.readItems();
    const target = items.find(i => i.path === targetPath);
    if (!target) return false;

    // Danh sach cac item can giu lai
    const remainingItems = items.filter(item => {
      const isTarget = item.path === targetPath;
      const isChild = item.path.startsWith(`${targetPath}/`);

      if (isTarget || isChild) {
        // Neu item bi xoa la sprite thi xoa file thumbnail
        if (item.type === 'sprite') {
          const thumbFile = path.join(this.thumbnailsDir, `${item.id}.png`);
          if (fs.existsSync(thumbFile)) {
            try {
              fs.unlinkSync(thumbFile);
            } catch (e) {
              console.error('[AssetManager] Loi khi xoa file thumbnail:', e);
            }
          }
        }
        return false;
      }
      return true;
    });

    this.writeItems(remainingItems);
    return true;
  }

  // Doi ten mot item va cap nhat de quy tat ca duong dan con
  public renameItem(targetPath: string, newName: string): boolean {
    const items = this.readItems();
    const target = items.find(i => i.path === targetPath);
    if (!target) return false;

    const cleanNewName = newName.trim().replace(/[/\\?%*:|"<>]/g, '_');
    const newPath = target.parentPath ? `${target.parentPath}/${cleanNewName}` : cleanNewName;

    target.name = cleanNewName;
    target.path = newPath;

    // Neu la thu muc thi cap nhat tat ca duong dan con
    if (target.type === 'folder') {
      const oldPrefix = `${targetPath}/`;
      const newPrefix = `${newPath}/`;

      for (const item of items) {
        if (item.path.startsWith(oldPrefix)) {
          item.path = newPrefix + item.path.substring(oldPrefix.length);
          if (item.parentPath === targetPath) {
            item.parentPath = newPath;
          } else if (item.parentPath.startsWith(oldPrefix)) {
            item.parentPath = newPrefix + item.parentPath.substring(oldPrefix.length);
          }
        }
      }
    }

    this.writeItems(items);
    return true;
  }
}
