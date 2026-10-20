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
  LayerData,
  PixelPoint,
  CharacterCoreData,
  CharacterSummary,
  CharacterActionFolder
} from '@pixel-draw/shared-types';
import { exportPngBuffer } from './exporter';

// Chuyen doi chuoi ten tieng Viet thanh slug an toan cho ten thu muc
export function toSafeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'character';
}

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

  // Di chuyen mot item sang thu muc khac (ho tro keo tha Drag & Drop)
  public moveItem(sourcePath: string, targetFolderPath: string): boolean {
    const items = this.readItems();
    const source = items.find(i => i.path === sourcePath);
    if (!source) return false;
    if (sourcePath === targetFolderPath) return false;
    // Khong cho phep di chuyen thu muc cha vao chinh thu muc con cua no
    if (targetFolderPath.startsWith(`${sourcePath}/`)) return false;

    const newPath = `${targetFolderPath}/${source.name}`;
    if (items.some(i => i.path === newPath && i.path !== sourcePath)) {
      return false;
    }

    const oldPath = source.path;
    source.parentPath = targetFolderPath;
    source.path = newPath;

    if (source.type === 'folder') {
      const oldPrefix = `${oldPath}/`;
      const newPrefix = `${newPath}/`;
      for (const item of items) {
        if (item.path.startsWith(oldPrefix)) {
          item.path = newPrefix + item.path.substring(oldPrefix.length);
          if (item.parentPath === oldPath) {
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

  // Lay duong dan goc thu muc characters
  private getCharactersDir(): string {
    const charDir = path.join(this.assetsDir, 'characters');
    if (!fs.existsSync(charDir)) {
      fs.mkdirSync(charDir, { recursive: true });
    }
    return charDir;
  }

  // 1. Luu goi nhan vat cot loi (Character Core Package)
  public saveCharacterCore(payload: CharacterCoreData, base64Png?: string): { success: boolean; character: CharacterCoreData; folderPath: string } {
    const charactersDir = this.getCharactersDir();
    let slug = payload.slug || toSafeSlug(payload.name);
    if (!slug) slug = `char_${Date.now()}`;

    let charDir = path.join(charactersDir, slug);
    // Neu thu muc da ton tai va chua nhan vat khac ID, them timestamp de tranh ghi de nham
    if (fs.existsSync(charDir)) {
      const coreFile = path.join(charDir, 'character_core.json');
      if (fs.existsSync(coreFile)) {
        try {
          const existing = JSON.parse(fs.readFileSync(coreFile, 'utf-8'));
          if (existing.id && existing.id !== payload.id) {
            slug = `${slug}_${Date.now().toString().slice(-4)}`;
            charDir = path.join(charactersDir, slug);
          }
        } catch (e) {}
      }
    }

    if (!fs.existsSync(charDir)) {
      fs.mkdirSync(charDir, { recursive: true });
    }

    payload.slug = slug;
    payload.updatedAt = Date.now();
    if (!payload.createdAt) payload.createdAt = Date.now();
    if (!payload.actions) payload.actions = [];

    // Luu file anh goc base_pose.png neu co base64Png
    if (base64Png) {
      try {
        const base64Data = base64Png.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(path.join(charDir, 'base_pose.png'), buffer);
        payload.thumbnailUrl = base64Png;
      } catch (err) {
        console.error('[AssetManager] Loi khi ghi file base_pose.png:', err);
      }
    }

    // Ghi thong tin metadata character_core.json
    const coreFilePath = path.join(charDir, 'character_core.json');
    fs.writeFileSync(coreFilePath, JSON.stringify(payload, null, 2), 'utf-8');

    // Dong bo vao Cay thu muc du an (tree_metadata.json)
    try {
      this.createFolder('Assets', 'Characters');
      const charFolderPath = `Assets/Characters/${slug}`;
      const charFolder = this.createFolder('Assets/Characters', payload.name);

      // Chuyen doi mang pixel points sang Record<string, PixelColor>
      const pixelsRecord: Record<string, PixelColor> = {};
      if (Array.isArray(payload.pixels)) {
        for (const p of payload.pixels) {
          if (p.color) {
            pixelsRecord[`${p.x},${p.y}`] = p.color;
          }
        }
      }

      this.saveSprite({
        name: 'Base Pose',
        folderPath: charFolder ? charFolder.path : charFolderPath,
        data: {
          width: payload.width || 64,
          height: payload.height || 64,
          pixels: pixelsRecord
        }
      });
    } catch (err) {
      console.warn('[AssetManager] Canh bao khi dong bo Cay tai nguyen cho nhan vat:', err);
    }

    return {
      success: true,
      character: payload,
      folderPath: `Assets/Characters/${slug}`
    };
  }

  // 2. Lay danh sach tat ca cac nhan vat da luu (List Character Packages)
  public listCharacterCores(): CharacterSummary[] {
    const charactersDir = this.getCharactersDir();
    const results: CharacterSummary[] = [];

    if (!fs.existsSync(charactersDir)) return results;

    const entries = fs.readdirSync(charactersDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const charDir = path.join(charactersDir, entry.name);
        const coreFile = path.join(charDir, 'character_core.json');
        if (fs.existsSync(coreFile)) {
          try {
            const data: CharacterCoreData = JSON.parse(fs.readFileSync(coreFile, 'utf-8'));
            let thumb = data.thumbnailUrl;
            if (!thumb) {
              const basePng = path.join(charDir, 'base_pose.png');
              if (fs.existsSync(basePng)) {
                const b64 = fs.readFileSync(basePng).toString('base64');
                thumb = `data:image/png;base64,${b64}`;
              }
            }

            results.push({
              id: data.id,
              name: data.name,
              slug: data.slug || entry.name,
              seed: data.seed,
              width: data.width,
              height: data.height,
              thumbnailUrl: thumb,
              actionsCount: Array.isArray(data.actions) ? data.actions.length : 0,
              actionsList: Array.isArray(data.actions) ? data.actions.map(a => a.action) : [],
              createdAt: data.createdAt || 0,
              updatedAt: data.updatedAt || 0
            });
          } catch (e) {
            console.error('[AssetManager] Loi khi doc character_core.json tai:', charDir, e);
          }
        }
      }
    }

    results.sort((a, b) => b.updatedAt - a.updatedAt);
    return results;
  }

  // 3. Lay chi tiet 1 nhan vat theo id hoac slug
  public getCharacterCore(idOrSlug: string): CharacterCoreData | null {
    const charactersDir = this.getCharactersDir();

    // Thu tim truc tiep theo thu muc slug
    const directDir = path.join(charactersDir, idOrSlug);
    const directFile = path.join(directDir, 'character_core.json');
    if (fs.existsSync(directFile)) {
      try {
        const data: CharacterCoreData = JSON.parse(fs.readFileSync(directFile, 'utf-8'));
        if (!data.thumbnailUrl) {
          const basePng = path.join(directDir, 'base_pose.png');
          if (fs.existsSync(basePng)) {
            data.thumbnailUrl = `data:image/png;base64,${fs.readFileSync(basePng).toString('base64')}`;
          }
        }
        return data;
      } catch (e) {}
    }

    // Neu khong thay, quet toan bo thu muc theo id
    const entries = fs.readdirSync(charactersDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const charDir = path.join(charactersDir, entry.name);
        const coreFile = path.join(charDir, 'character_core.json');
        if (fs.existsSync(coreFile)) {
          try {
            const data: CharacterCoreData = JSON.parse(fs.readFileSync(coreFile, 'utf-8'));
            if (data.id === idOrSlug || data.slug === idOrSlug) {
              if (!data.thumbnailUrl) {
                const basePng = path.join(charDir, 'base_pose.png');
                if (fs.existsSync(basePng)) {
                  data.thumbnailUrl = `data:image/png;base64,${fs.readFileSync(basePng).toString('base64')}`;
                }
              }
              return data;
            }
          } catch (e) {}
        }
      }
    }

    return null;
  }

  // 4. Luu chuoi frames cua mot hanh dong vao thu muc con cua nhan vat
  public saveCharacterAction(
    idOrSlug: string,
    action: string,
    frames: { name: string; pixels: Record<string, PixelColor> | PixelPoint[]; width: number; height: number; base64Png?: string }[]
  ): { success: boolean; actionFolder: string; framesSaved: number } {
    const char = this.getCharacterCore(idOrSlug);
    if (!char) {
      throw new Error(`Khong tim thay nhan vat voi dinh danh: ${idOrSlug}`);
    }

    const charactersDir = this.getCharactersDir();
    const charDir = path.join(charactersDir, char.slug);
    const cleanAction = toSafeSlug(action);
    const actionDir = path.join(charDir, cleanAction);

    if (!fs.existsSync(actionDir)) {
      fs.mkdirSync(actionDir, { recursive: true });
    }

    // Ghi tung frame vao thu muc tren o dia
    frames.forEach((f, idx) => {
      if (f.base64Png) {
        try {
          const b64 = f.base64Png.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(b64, 'base64');
          fs.writeFileSync(path.join(actionDir, `frame_${idx + 1}.png`), buffer);
        } catch (e) {}
      }
    });

    // Dong bo vao Cay thu muc du an (Project Tree)
    const charFolderPath = `Assets/Characters/${char.slug}`;
    const actionFolderPath = `${charFolderPath}/${cleanAction}`;
    this.createFolder(charFolderPath, cleanAction);

    frames.forEach((f, idx) => {
      let pixelsRecord: Record<string, PixelColor> = {};
      if (Array.isArray(f.pixels)) {
        for (const p of f.pixels) {
          if (p.color) pixelsRecord[`${p.x},${p.y}`] = p.color;
        }
      } else if (f.pixels && typeof f.pixels === 'object') {
        pixelsRecord = f.pixels;
      }

      this.saveSprite({
        name: f.name || `Frame ${idx + 1}`,
        folderPath: actionFolderPath,
        data: {
          width: f.width || char.width,
          height: f.height || char.height,
          pixels: pixelsRecord
        }
      });
    });

    // Cap nhat metadata character_core.json
    if (!Array.isArray(char.actions)) char.actions = [];
    const existingIdx = char.actions.findIndex(a => a.action === cleanAction);
    const actionFolderData: CharacterActionFolder = {
      action: cleanAction,
      label: action,
      framesCount: frames.length,
      folderPath: actionFolderPath,
      updatedAt: Date.now()
    };

    if (existingIdx >= 0) {
      char.actions[existingIdx] = actionFolderData;
    } else {
      char.actions.push(actionFolderData);
    }

    char.updatedAt = Date.now();
    fs.writeFileSync(path.join(charDir, 'character_core.json'), JSON.stringify(char, null, 2), 'utf-8');

    return {
      success: true,
      actionFolder: actionFolderPath,
      framesSaved: frames.length
    };
  }

  // 5. Cap nhat diem anh goc khi nguoi dung chinh sua thu cong tren Canvas
  public updateCharacterCorePixels(
    idOrSlug: string,
    pixels: PixelPoint[],
    width: number,
    height: number,
    base64Png?: string
  ): boolean {
    const char = this.getCharacterCore(idOrSlug);
    if (!char) return false;

    const charactersDir = this.getCharactersDir();
    const charDir = path.join(charactersDir, char.slug);

    char.pixels = pixels;
    char.width = width;
    char.height = height;
    char.updatedAt = Date.now();

    if (base64Png) {
      try {
        const b64 = base64Png.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(path.join(charDir, 'base_pose.png'), Buffer.from(b64, 'base64'));
        char.thumbnailUrl = base64Png;
      } catch (e) {}
    }

    fs.writeFileSync(path.join(charDir, 'character_core.json'), JSON.stringify(char, null, 2), 'utf-8');

    // Cap nhat item tren tree_metadata.json
    const items = this.readItems();
    const spriteItem = items.find(i => i.path === `Assets/Characters/${char.slug}/Base Pose`);
    if (spriteItem && spriteItem.data) {
      const pixelsRecord: Record<string, PixelColor> = {};
      for (const p of pixels) {
        if (p.color) pixelsRecord[`${p.x},${p.y}`] = p.color;
      }
      spriteItem.data.width = width;
      spriteItem.data.height = height;
      spriteItem.data.pixels = pixelsRecord;
      if (base64Png) spriteItem.thumbnailUrl = base64Png;
      this.writeItems(items);
    }

    return true;
  }
}

