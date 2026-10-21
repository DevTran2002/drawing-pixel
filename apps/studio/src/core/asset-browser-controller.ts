// apps/studio/src/core/asset-browser-controller.ts
// Bộ điều khiển trình duyệt tài nguyên dự án (Project Asset Browser) phong cách Unity

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
  private zoomSize: number = 72; // Kích thước thumbnail thu nhỏ (px), từ 48 đến 128
  private expandedFolders: Set<string> = new Set(['Assets', 'Assets/Characters', 'Assets/Characters/Hero']);
  private serverUrl: string = 'http://127.0.0.1:3055';

  constructor(serverUrl = 'http://127.0.0.1:3055') {
    this.serverUrl = serverUrl;
    this.tree = createDefaultAssetTree();
    this.loadFromLocalStorage();
  }

  // Lưu bộ nhớ tạm vào localStorage để hỗ trợ chế độ ngoại tuyến
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('pixel_draw_project_assets', JSON.stringify(this.tree));
    } catch (e) {
      // Bỏ qua nếu đầy bộ nhớ lưu trữ
    }
  }

  // Nạp cây tài nguyên từ localStorage
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
      // Sử dụng cây mặc định nếu không có dữ liệu lưu
    }
  }

  // Lấy dữ liệu cây tài nguyên từ máy chủ backend
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
      console.warn('[AssetBrowserController] Không thể kết nối máy chủ, sử dụng dữ liệu cục bộ:', err);
    }
    return this.tree;
  }

  // Lấy đường dẫn thư mục hiện tại
  public getCurrentPath(): string {
    return this.currentPath;
  }

  // Lấy mức zoom hiện tại
  public getZoomSize(): number {
    return this.zoomSize;
  }

  // Thiết lập mức zoom (48px - 128px)
  public setZoomSize(size: number): void {
    this.zoomSize = Math.max(48, Math.min(128, size));
  }

  // Đặt từ khóa tìm kiếm
  public setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
  }

  // Lấy từ khóa tìm kiếm
  public getSearchQuery(): string {
    return this.searchQuery;
  }

  // Chọn một mục tài nguyên
  public selectItem(path: string | null): void {
    this.selectedItemPath = path;
  }

  // Lấy đường dẫn mục đang được chọn
  public getSelectedItemPath(): string | null {
    return this.selectedItemPath;
  }

  // Điều hướng tới một thư mục cụ thể
  public navigateTo(targetPath: string): void {
    if (this.currentPath === targetPath) return;

    // Cắt bỏ phần lịch sử phía sau nếu đang ở giữa lịch sử
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(targetPath);
    this.historyIndex = this.history.length - 1;
    this.currentPath = targetPath;
    this.selectedItemPath = null;
    this.expandedFolders.add(targetPath);
  }

  // Quay lại thư mục trước đó trong lịch sử
  public goBack(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentPath = this.history[this.historyIndex];
      this.selectedItemPath = null;
      return true;
    }
    return false;
  }

  // Tiến tới thư mục tiếp theo trong lịch sử
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

  // Danh sách breadcrumbs điều hướng (ví dụ: Assets > Characters > Hero)
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

  // Lấy toàn bộ danh sách các thư mục để hiển thị cây thư mục bên trái (Treeview)
  public getFolderHierarchy(): FolderNodeItem[] {
    const folders = this.tree.items.filter(item => item.type === 'folder');
    const folderMap = new Map<string, ProjectAssetItem>();
    folders.forEach(f => folderMap.set(f.path, f));

    // Tìm tất cả thư mục con trực tiếp của một parentPath
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

      // Nếu thư mục được mở thì đệ quy tiếp các thư mục con
      if (isExpanded) {
        children.forEach(child => traverse(child.path, level + 1));
      }
    };

    traverse('Assets', 0);
    return result;
  }

  // Mở rộng hoặc thu gọn thư mục trên cây thư mục (Treeview)
  public toggleFolderExpand(path: string): void {
    if (this.expandedFolders.has(path)) {
      this.expandedFolders.delete(path);
    } else {
      this.expandedFolders.add(path);
    }
  }

  // Lấy danh sách các mục trong thư mục hiện tại (hoặc kết quả tìm kiếm)
  public getItemsInCurrentFolder(): ProjectAssetItem[] {
    if (this.searchQuery) {
      // Nếu có từ khóa tìm kiếm, quét toàn bộ cây tài nguyên
      return this.tree.items.filter(item =>
        item.name.toLowerCase().includes(this.searchQuery)
      );
    }

    // Lấy các thư mục và sprite có parentPath là currentPath
    return this.tree.items.filter(item => item.parentPath === this.currentPath);
  }

  // Tạo một thư mục mới trong thư mục hiện tại
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
      console.warn('[AssetBrowserController] Lỗi máy chủ khi tạo thư mục, thực hiện tạo cục bộ:', err);
    }

    // Cơ chế dự phòng tạo thư mục cục bộ
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

  // Lưu sprite hiện tại vào thư mục đang mở
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
      console.warn('[AssetBrowserController] Lỗi máy chủ khi lưu sprite, thực hiện lưu cục bộ:', err);
    }

    // Cơ chế dự phòng lưu sprite cục bộ
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

  // Xóa một mục tài nguyên
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
      console.warn('[AssetBrowserController] Lỗi máy chủ khi xóa mục, thực hiện xóa cục bộ:', err);
    }

    // Cơ chế dự phòng xóa cục bộ
    this.tree.items = this.tree.items.filter(
      item => item.path !== path && !item.path.startsWith(`${path}/`)
    );
    this.saveToLocalStorage();
    return true;
  }

  // Đổi tên mục tài nguyên
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
      console.warn('[AssetBrowserController] Lỗi máy chủ khi đổi tên, thực hiện cập nhật cục bộ:', err);
    }

    // Cơ chế dự phòng đổi tên cục bộ
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

  // Di chuyển một mục sang thư mục khác (Kéo & Thả - Drag & Drop)
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
      console.warn('[AssetBrowserController] Lỗi máy chủ khi di chuyển mục, thực hiện xử lý cục bộ:', err);
    }

    // Cơ chế dự phòng di chuyển cục bộ
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
