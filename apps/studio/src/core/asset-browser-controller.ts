// apps/studio/src/core/asset-browser-controller.ts
// Bo dieu khien trinh duyet tai nguyen du an (Project Asset Browser) phong cach Unity

import {
  ProjectAssetItem,
  ProjectAssetTree,
  createDefaultAssetTree,
  PixelColor,
  LayerData
} from '@pixel-draw/shared-types';

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface FolderNodeItem {
  path: string;
  name: string;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isSelected: boolean;
}

export class AssetBrowserController {
  private tree: ProjectAssetTree;
  private currentPath: string = 'Assets';
  private history: string[] = ['Assets'];
  private historyIndex: number = 0;
  private searchQuery: string = '';
  private selectedItemPath: string | null = null;
  private zoomSize: number = 72; // Kich thuoc thumbnail (px), tu 48 den 128
  private expandedFolders: Set<string> = new Set(['Assets', 'Assets/Characters', 'Assets/Characters/Hero']);
  private serverUrl: string = 'http://127.0.0.1:3055';

  constructor(serverUrl = 'http://127.0.0.1:3055') {
    this.serverUrl = serverUrl;
    this.tree = createDefaultAssetTree();
    this.loadFromLocalStorage();
  }

  // Luu bo nho tam vao localStorage de ho tro che do offline
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('pixel_draw_project_assets', JSON.stringify(this.tree));
    } catch (e) {
      // Bo qua neu day bo nho storage
    }
  }

  // Nap cay tai nguyen tu localStorage
  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('pixel_draw_project_assets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.items)) {
          this.tree = parsed;
        }
      }
    } catch (e) {
      // Dung cay mac dinh
    }
  }

  // Lay du lieu cay tai nguyen tu backend server
  public async fetchTree(): Promise<ProjectAssetTree> {
    try {
      const response = await fetch(`${this.serverUrl}/api/project-assets/tree`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tree) {
          this.tree = data.tree;
          this.saveToLocalStorage();
        }
      }
    } catch (err) {
      console.warn('[AssetBrowserController] Khong the ket noi server, su dung du lieu cuc bo:', err);
    }
    return this.tree;
  }

  // Lay duong dan thu muc hien tai
  public getCurrentPath(): string {
    return this.currentPath;
  }

  // Lay muc zoom hien tai
  public getZoomSize(): number {
    return this.zoomSize;
  }

  // Thiet lap muc zoom (48px - 128px)
  public setZoomSize(size: number): void {
    this.zoomSize = Math.max(48, Math.min(128, size));
  }

  // Dat tu khoa tim kiem
  public setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
  }

  // Lay tu khoa tim kiem
  public getSearchQuery(): string {
    return this.searchQuery;
  }

  // Chon mot item
  public selectItem(path: string | null): void {
    this.selectedItemPath = path;
  }

  // Lay duong dan item dang duoc chon
  public getSelectedItemPath(): string | null {
    return this.selectedItemPath;
  }

  // Dieu huong toi mot thu muc cu the
  public navigateTo(targetPath: string): void {
    if (this.currentPath === targetPath) return;

    // Cat bo phan lich su phia sau neu dang o giua lich su
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(targetPath);
    this.historyIndex = this.history.length - 1;
    this.currentPath = targetPath;
    this.selectedItemPath = null;
    this.expandedFolders.add(targetPath);
  }

  // Quay lai thu muc truoc do
  public goBack(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentPath = this.history[this.historyIndex];
      this.selectedItemPath = null;
      return true;
    }
    return false;
  }

  // Tien toi thu muc tiep theo
  public goForward(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.currentPath = this.history[this.historyIndex];
      this.selectedItemPath = null;
      return true;
    }
    return false;
  }

  public canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  public canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  // Danh sach breadcrumbs dieu huong (vi du: Assets > Characters > Hero)
  public getBreadcrumbs(): BreadcrumbItem[] {
    const parts = this.currentPath.split('/');
    const breadcrumbs: BreadcrumbItem[] = [];
    let accumulated = '';

    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      breadcrumbs.push({
        name: part,
        path: accumulated
      });
    }

    return breadcrumbs;
  }

  // Lay toan bo danh sach cac folder de render Treeview ben trai
  public getFolderHierarchy(): FolderNodeItem[] {
    const folders = this.tree.items.filter(item => item.type === 'folder');
    const folderMap = new Map<string, ProjectAssetItem>();
    folders.forEach(f => folderMap.set(f.path, f));

    // Tim tat ca folder con truc tiep cua mot parentPath
    const getChildren = (parentPath: string) => {
      return folders.filter(f => f.parentPath === parentPath);
    };

    const result: FolderNodeItem[] = [];

    const traverse = (nodePath: string, level: number) => {
      const node = folderMap.get(nodePath);
      if (!node) return;

      const children = getChildren(nodePath);
      const isExpanded = this.expandedFolders.has(nodePath);

      result.push({
        path: node.path,
        name: node.name,
        level,
        hasChildren: children.length > 0,
        isExpanded,
        isSelected: this.currentPath === node.path
      });

      // Neu folder duoc mo thi de quy tiep cac folder con
      if (isExpanded) {
        children.forEach(child => traverse(child.path, level + 1));
      }
    };

    traverse('Assets', 0);
    return result;
  }

  // Mo rong hoac thu gon thu muc tren Treeview
  public toggleFolderExpand(path: string): void {
    if (this.expandedFolders.has(path)) {
      this.expandedFolders.delete(path);
    } else {
      this.expandedFolders.add(path);
    }
  }

  // Lay danh sach cac item trong thu muc hien tai (hoac ket qua tim kiem)
  public getItemsInCurrentFolder(): ProjectAssetItem[] {
    if (this.searchQuery) {
      // Neu co tu khoa tim kiem, quet toan bo cay tai nguyen
      return this.tree.items.filter(item =>
        item.name.toLowerCase().includes(this.searchQuery)
      );
    }

    // Lay cac folder va sprite co parentPath la currentPath
    return this.tree.items.filter(item => item.parentPath === this.currentPath);
  }

  // Tao mot thu muc moi trong thu muc hien tai
  public async createFolder(name: string): Promise<ProjectAssetItem | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/project-assets/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parentPath: this.currentPath
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tree) {
          this.tree = data.tree;
          this.saveToLocalStorage();
          this.expandedFolders.add(this.currentPath);
          return data.item;
        }
      }
    } catch (err) {
      console.warn('[AssetBrowserController] Loi server tao folder, tao cuc bo:', err);
    }

    // Fallback tao cuc bo
    const cleanName = name.trim().replace(/[/\\?%*:|"<>]/g, '_');
    const folderPath = `${this.currentPath}/${cleanName}`;
    const newItem: ProjectAssetItem = {
      id: `folder_${Date.now()}`,
      name: cleanName,
      type: 'folder',
      path: folderPath,
      parentPath: this.currentPath,
      createdAt: Date.now(),
      childrenCount: 0
    };
    this.tree.items.push(newItem);
    this.saveToLocalStorage();
    this.expandedFolders.add(this.currentPath);
    return newItem;
  }

  // Luu sprite hien tai vao thu muc dang mo
  public async saveCurrentSprite(
    name: string,
    data: {
      width: number;
      height: number;
      pixels: Record<string, PixelColor>;
      layers?: LayerData[];
    }
  ): Promise<ProjectAssetItem | null> {
    try {
      const response = await fetch(`${this.serverUrl}/api/project-assets/save-sprite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          folderPath: this.currentPath,
          data
        })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && resData.tree) {
          this.tree = resData.tree;
          this.saveToLocalStorage();
          return resData.item;
        }
      }
    } catch (err) {
      console.warn('[AssetBrowserController] Loi server luu sprite, luu cuc bo:', err);
    }

    // Fallback luu cuc bo
    const id = `sprite_${Date.now()}`;
    const cleanName = name.trim() || `Sprite_${Date.now()}`;
    const newItem: ProjectAssetItem = {
      id,
      name: cleanName,
      type: 'sprite',
      path: `${this.currentPath}/${cleanName}`,
      parentPath: this.currentPath,
      data,
      createdAt: Date.now()
    };
    this.tree.items.push(newItem);
    this.saveToLocalStorage();
    return newItem;
  }

  // Xoa mot item
  public async deleteItem(path: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/project-assets/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tree) {
          this.tree = data.tree;
          this.saveToLocalStorage();
          return true;
        }
      }
    } catch (err) {
      console.warn('[AssetBrowserController] Loi server xoa item, xoa cuc bo:', err);
    }

    // Fallback xoa cuc bo
    this.tree.items = this.tree.items.filter(
      item => item.path !== path && !item.path.startsWith(`${path}/`)
    );
    this.saveToLocalStorage();
    return true;
  }

  // Doi ten item
  public async renameItem(path: string, newName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/project-assets/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, newName })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tree) {
          this.tree = data.tree;
          this.saveToLocalStorage();
          return true;
        }
      }
    } catch (err) {
      console.warn('[AssetBrowserController] Loi server doi ten item, cap nhat cuc bo:', err);
    }

    // Fallback doi ten cuc bo
    const item = this.tree.items.find(i => i.path === path);
    if (!item) return false;

    const cleanNewName = newName.trim().replace(/[/\\?%*:|"<>]/g, '_');
    const newPath = item.parentPath ? `${item.parentPath}/${cleanNewName}` : cleanNewName;

    item.name = cleanNewName;
    item.path = newPath;

    if (item.type === 'folder') {
      const oldPrefix = `${path}/`;
      const newPrefix = `${newPath}/`;
      for (const it of this.tree.items) {
        if (it.path.startsWith(oldPrefix)) {
          it.path = newPrefix + it.path.substring(oldPrefix.length);
          if (it.parentPath === path) {
            it.parentPath = newPath;
          } else if (it.parentPath.startsWith(oldPrefix)) {
            it.parentPath = newPrefix + it.parentPath.substring(oldPrefix.length);
          }
        }
      }
    }

    this.saveToLocalStorage();
    return true;
  }

  // Di chuyen mot item sang thu muc khac (Drag & Drop)
  public async moveItem(sourcePath: string, targetFolderPath: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/project-assets/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, targetFolderPath })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tree) {
          this.tree = data.tree;
          this.saveToLocalStorage();
          return true;
        }
      }
    } catch (err) {
      console.warn('[AssetBrowserController] Loi server di chuyen item, xu ly cuc bo:', err);
    }

    // Fallback di chuyen cuc bo
    const source = this.tree.items.find(i => i.path === sourcePath);
    if (!source) return false;
    if (sourcePath === targetFolderPath) return false;
    if (targetFolderPath.startsWith(`${sourcePath}/`)) return false;

    const newPath = `${targetFolderPath}/${source.name}`;
    if (this.tree.items.some(i => i.path === newPath && i.path !== sourcePath)) {
      return false;
    }

    const oldPath = source.path;
    source.parentPath = targetFolderPath;
    source.path = newPath;

    if (source.type === 'folder') {
      const oldPrefix = `${oldPath}/`;
      const newPrefix = `${newPath}/`;
      for (const it of this.tree.items) {
        if (it.path.startsWith(oldPrefix)) {
          it.path = newPrefix + it.path.substring(oldPrefix.length);
          if (it.parentPath === oldPath) {
            it.parentPath = newPath;
          } else if (it.parentPath.startsWith(oldPrefix)) {
            it.parentPath = newPrefix + it.parentPath.substring(oldPrefix.length);
          }
        }
      }
    }

    this.saveToLocalStorage();
    return true;
  }
}
