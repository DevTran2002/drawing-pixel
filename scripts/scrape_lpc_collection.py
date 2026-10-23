# -*- coding: utf-8 -*-
"""
Kịch bản tự động cào (Scraper), tải về, giải nén và phân loại toàn bộ tài nguyên
từ bộ sưu tập LPC Collection trên OpenGameArt.org về dự án Pixel Draw.
Tác giả: Antigravity Assistant
"""

import os
import re
import sys
import json
import time
import shutil
import zipfile
import argparse
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional

# Thiết lập đường dẫn các thư mục cơ sở
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_DIR = os.path.join(PROJECT_ROOT, "assets", "lpc_collection")
RAW_ARCHIVE_DIR = os.path.join(ASSETS_DIR, "raw_archives")
CATEGORIES_DIR = {
    "characters": os.path.join(ASSETS_DIR, "characters"),
    "monsters": os.path.join(ASSETS_DIR, "monsters"),
    "tilesets": os.path.join(ASSETS_DIR, "tilesets"),
    "items_objects": os.path.join(ASSETS_DIR, "items_objects"),
    "effects": os.path.join(ASSETS_DIR, "effects"),
    "misc": os.path.join(ASSETS_DIR, "misc")
}
STUDIO_LPC_DIR = os.path.join(PROJECT_ROOT, "apps", "studio", "public", "lpc_assets")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Bảng từ khóa phân loại danh mục thông minh
CLASSIFICATION_RULES = {
    "characters": [
        "character", "sprites", "hair", "armor", "armour", "clothes", "clothing", "pants", 
        "boots", "shoes", "hat", "helmet", "walk", "slash", "thrust", "male", "female", 
        "human", "elf", "dwarf", "paperdoll", "robe", "cloak", "wings", "tails", "ears", 
        "mask", "bandages", "legion", "sword", "shield", "bow", "spear", "weapons", 
        "facial", "beard", "tunic", "jacket", "gloves", "headwear"
    ],
    "monsters": [
        "golem", "imp", "goblin", "enemy", "spider", "monster", "drake", "lizardfolk", 
        "horse", "goat", "turkey", "creature", "zombie", "skeleton", "beast", "bat", 
        "wolf", "slime", "dragon", "boss", "demon", "animals", "farm animals"
    ],
    "tilesets": [
        "tile", "tileset", "terrain", "atlas", "forest", "tree", "house", "inside", 
        "castle", "bridge", "cliff", "mountain", "sand", "water", "cave", "wall", 
        "floor", "dungeon", "village", "city", "building", "interiors", "roof"
    ],
    "items_objects": [
        "item", "icon", "items", "fireplace", "sign", "post", "hanging", "plant", 
        "flower", "food", "chest", "box", "barrel", "potion", "furniture", "repack", 
        "decor", "farming", "cycle"
    ],
    "effects": [
        "magic", "spell", "plasmaball", "animated", "waterfall", "fire", "fx", 
        "explosion", "projectile", "particle", "aura"
    ]
}


def sanitize_folder_name(name: str) -> str:
    """Loại bỏ ký tự không hợp lệ trong tên thư mục Windows/Linux."""
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = clean.strip().replace(" ", "_").lower()
    return clean[:60]


def fetch_url_content(url: str, max_retries: int = 3, delay: float = 1.0) -> Optional[str]:
    """Tải nội dung HTML từ URL với cơ chế thử lại khi gặp lỗi mạng."""
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception as err:
            time.sleep(delay * (attempt + 1))
            if attempt == max_retries - 1:
                print(f"[Canh bao] Khong the tai URL {url}: {err}")
    return None


# Thiết lập chế độ in log không đệm để theo dõi tiến trình thời gian thực
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

def download_binary_file(url: str, output_path: str, max_retries: int = 3) -> bool:
    """Tải tệp nhị phân (zip, png) từ URL và lưu vào đĩa cứng an toàn."""
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        return True

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    temp_path = output_path + ".tmp"

    for attempt in range(max_retries):
        try:
            # Giải mã trước rồi mới mã hóa an toàn, tránh bị double-encode (%20 -> %2520)
            parsed = urllib.parse.urlsplit(url)
            unquoted_path = urllib.parse.unquote(parsed.path)
            encoded_path = urllib.parse.quote(unquoted_path)
            safe_url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, encoded_path, parsed.query, parsed.fragment))

            req = urllib.request.Request(safe_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(temp_path, "wb") as out_f:
                    shutil.copyfileobj(resp, out_f)
            
            if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                os.replace(temp_path, output_path)
                return True
        except Exception as err:
            time.sleep(1.5 * (attempt + 1))
            if attempt == max_retries - 1:
                print(f"[Loi tai tep] {url} -> {err}")
    
    if os.path.exists(temp_path):
        try:
            os.remove(temp_path)
        except OSError:
            pass
    return False


def classify_artwork(title: str, file_names: List[str]) -> str:
    """Phân tích tiêu đề và tên tệp để xác định danh mục chính xác."""
    combined_text = (title + " " + " ".join(file_names)).lower()

    scores = {cat: 0 for cat in CLASSIFICATION_RULES}
    for category, keywords in CLASSIFICATION_RULES.items():
        for kw in keywords:
            if kw in combined_text:
                # Ưu tiên nếu từ khóa xuất hiện ngay trong tiêu đề
                if kw in title.lower():
                    scores[category] += 2
                else:
                    scores[category] += 1

    best_category = max(scores, key=scores.get)
    if scores[best_category] > 0:
        return best_category
    return "misc"


def extract_archive_safely(zip_path: str, dest_dir: str) -> List[str]:
    """Giải nén tệp zip an toàn, loại bỏ tệp rác như __MACOSX và .DS_Store."""
    extracted_files = []
    os.makedirs(dest_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.infolist():
                # Bỏ qua tệp hệ thống macOS và thư mục ẩn
                if "__MACOSX" in member.filename or member.filename.endswith(".DS_Store"):
                    continue
                
                # Chống tấn công Zip Slip (Path Traversal)
                target_path = os.path.abspath(os.path.join(dest_dir, member.filename))
                if not target_path.startswith(os.path.abspath(dest_dir)):
                    continue

                if member.is_dir():
                    os.makedirs(target_path, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    with zf.open(member) as source, open(target_path, "wb") as target:
                        shutil.copyfileobj(source, target)
                    extracted_files.append(target_path)
    except Exception as err:
        print(f"[Loi giai nen] {zip_path}: {err}")

    return extracted_files


class LpcCollectionManager:
    """Trình quản lý cào, phân loại và đồng bộ tài nguyên LPC."""

    def __init__(self, cached_content_path: Optional[str] = None):
        self.cached_content_path = cached_content_path
        self.artworks: List[Dict[str, Any]] = []
        self.manifest: List[Dict[str, Any]] = []

    def prepare_directories(self):
        """Khởi tạo đầy đủ cấu trúc thư mục lưu trữ phân loại."""
        os.makedirs(ASSETS_DIR, exist_ok=True)
        os.makedirs(RAW_ARCHIVE_DIR, exist_ok=True)
        for cat_path in CATEGORIES_DIR.values():
            os.makedirs(cat_path, exist_ok=True)

    def parse_collection_index(self) -> List[Dict[str, str]]:
        """Lấy danh sách toàn bộ các bài viết từ trang tổng hợp LPC Collection."""
        html_content = None
        if self.cached_content_path and os.path.exists(self.cached_content_path):
            print(f"[Doc bo nho dem] Dang doc du lieu tu: {self.cached_content_path}")
            with open(self.cached_content_path, "r", encoding="utf-8", errors="ignore") as f:
                html_content = f.read()
        else:
            print("[Ket noi mang] Dang tai trang chu LPC Collection tu OpenGameArt...")
            html_content = fetch_url_content("https://opengameart.org/content/lpc-collection")

        if not html_content:
            print("[Loi] Khong the lay noi dung trang danh muc LPC!")
            return []

        pattern = r'<span class="art-preview-title"><a href="([^"]+)">([^<]+)</a></span>'
        matches = re.findall(pattern, html_content)
        
        results = []
        for href, title in matches:
            full_url = "https://opengameart.org" + href if href.startswith("/") else href
            results.append({
                "title": title.replace("&amp;", "&").strip(),
                "url": full_url,
                "slug": href.strip("/").split("/")[-1]
            })

        print(f"[Thanh cong] Da tim thay tong cong {len(results)} tac pham trong bo suu tap LPC.")
        return results

    def inspect_artwork_page(self, item: Dict[str, str]) -> Dict[str, Any]:
        """Phân tích trang chi tiết để trích xuất tác giả, bản quyền và các tệp tải về."""
        art_info = {
            "title": item["title"],
            "url": item["url"],
            "slug": item["slug"],
            "author": "Unknown",
            "licenses": [],
            "files": [],
            "category": "misc"
        }

        html = fetch_url_content(item["url"])
        if not html:
            return art_info

        # Trích xuất tác giả
        author_m = re.search(r'typeof="sioc:UserAccount"[^>]*>([^<]+)</a>', html)
        if author_m:
            art_info["author"] = author_m.group(1).strip()

        # Trích xuất giấy phép
        licenses = re.findall(r'<div class="field-item [^"]*"><a href="[^"]*licenses[^"]*"[^>]*>([^<]+)</a>', html)
        if licenses:
            art_info["licenses"] = list(set(licenses))
        else:
            art_info["licenses"] = ["CC-BY-SA 3.0 / GPL 3.0"]

        # Trích xuất các tệp đính kèm sạch
        file_matches = re.findall(r'href="(https?://opengameart\.org/sites/default/files/[^"?#]+\.(?:zip|7z|tar\.gz|png|gif|xcf|gz))"', html, re.IGNORECASE)
        clean_files = [f for f in set(file_matches) if "/styles/" not in f and "/css/" not in f]
        art_info["files"] = clean_files

        # Xác định danh mục
        file_names = [os.path.basename(f) for f in clean_files]
        art_info["category"] = classify_artwork(art_info["title"], file_names)

        return art_info

    def process_existing_root_zips(self):
        """Tự động phân loại và giải nén các tệp zip LPC đã có sẵn trong thư mục gốc."""
        print("\n--- Kiem tra va xu ly cac tep ZIP co san trong thu muc goc ---")
        existing_zips = [
            ("lpc-hair.zip", "characters", "lpc_hair_master"),
            ("lpc_entry.zip", "characters", "lpc_entry_base"),
            ("expansion_pack-0.04.zip", "characters", "lpc_expansion_pack")
        ]

        for zip_name, category, subfolder in existing_zips:
            zip_path = os.path.join(PROJECT_ROOT, zip_name)
            if os.path.exists(zip_path):
                dest_dir = os.path.join(CATEGORIES_DIR[category], subfolder)
                print(f"[Giai nen tep san co] {zip_name} -> {category}/{subfolder}")
                files = extract_archive_safely(zip_path, dest_dir)
                print(f"  + Da giai nen thanh cong {len(files)} tep.")
                
                # Thêm vào manifest
                self.manifest.append({
                    "title": f"Pre-downloaded Package: {zip_name}",
                    "author": "OpenGameArt LPC Contributors",
                    "source": "Local Root Archive",
                    "category": category,
                    "target_dir": dest_dir,
                    "extracted_count": len(files)
                })

    def run_pipeline(self, limit: int = 50, workers: int = 4, category_filter: Optional[str] = None):
        """Khởi động toàn bộ chu trình cào, tải, giải nén và phân loại."""
        self.prepare_directories()
        
        # 1. Xử lý các tệp zip hiện có trước
        self.process_existing_root_zips()

        # 2. Phân tích danh sách bài viết
        items = self.parse_collection_index()
        if not items:
            return

        if limit > 0:
            items = items[:limit]
            print(f"[Thuc thi theo lo] Gioi han xu ly {len(items)} tac pham dau tien.")

        # 3. Phân tích chi tiết từng bài viết (Metadata Extraction)
        print(f"\n--- Dang thu thap thong tin chi tiet ({len(items)} tac pham) ---")
        detailed_items = []
        for idx, item in enumerate(items):
            info = self.inspect_artwork_page(item)
            if category_filter and info["category"] != category_filter:
                continue
            detailed_items.append(info)
            print(f"[{idx+1}/{len(items)}] {info['title']} -> Danh muc: [{info['category']}] (Co {len(info['files'])} tep)")
            time.sleep(0.3)  # Delay nhe de tranh gay qua tai may chu OpenGameArt

        # 4. Tải và phân loại tệp
        print(f"\n--- Tien hanh tai xuong va phan loai tep ---")
        for idx, item in enumerate(detailed_items):
            cat = item["category"]
            cat_dir = CATEGORIES_DIR.get(cat, CATEGORIES_DIR["misc"])
            subfolder_name = sanitize_folder_name(item["slug"])
            item_dest_dir = os.path.join(cat_dir, subfolder_name)
            os.makedirs(item_dest_dir, exist_ok=True)

            print(f"\n[Dang xu ly {idx+1}/{len(detailed_items)}] {item['title']} -> {cat}/{subfolder_name}")

            downloaded_paths = []
            for file_url in item["files"]:
                file_name = urllib.parse.unquote(os.path.basename(file_url))
                raw_save_path = os.path.join(RAW_ARCHIVE_DIR, file_name)
                
                print(f"  + Dang tai: {file_name}")
                success = download_binary_file(file_url, raw_save_path)
                
                if success:
                    # Nếu là file zip, giải nén thẳng vào thư mục danh mục
                    if file_name.lower().endswith((".zip", ".7z", ".tar.gz")):
                        print(f"    * Dang giai nen {file_name} vao {cat}/{subfolder_name}...")
                        extracted = extract_archive_safely(raw_save_path, item_dest_dir)
                        downloaded_paths.extend(extracted)
                    else:
                        # Nếu là ảnh PNG/GIF đơn lẻ, sao chép vào thư mục đích
                        dest_file_path = os.path.join(item_dest_dir, file_name)
                        if not os.path.exists(dest_file_path):
                            shutil.copy2(raw_save_path, dest_file_path)
                        downloaded_paths.append(dest_file_path)

            self.manifest.append({
                "title": item["title"],
                "author": item["author"],
                "url": item["url"],
                "licenses": item["licenses"],
                "category": cat,
                "folder": os.path.relpath(item_dest_dir, PROJECT_ROOT),
                "files_count": len(downloaded_paths)
            })

        # 5. Xuất Manifest và CREDITS
        self.export_manifest_and_credits()

        # 6. Quét và đồng bộ các sheet tương thích vào Studio
        self.sync_compatible_sheets_to_studio()

    def export_manifest_and_credits(self):
        """Ghi nhận thông tin tác giả và bản quyền đầy đủ theo chuẩn OpenGameArt."""
        manifest_path = os.path.join(ASSETS_DIR, "lpc_collection_manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(self.manifest, f, ensure_ascii=False, indent=2)
        print(f"\n[Manifest] Da luu ban do tai nguyen tai: {manifest_path}")

        credits_path = os.path.join(ASSETS_DIR, "CREDITS.md")
        with open(credits_path, "w", encoding="utf-8") as f:
            f.write("# Bang Ghi Danh Tac Gia & Giay Phep LPC Collection\n\n")
            f.write("Tap tin nay tong hop thong tin ban quyen cua tat ca tac pham duoc tai tu OpenGameArt LPC Collection.\n\n")
            f.write("| STT | Ten Tac Pham | Tac Gia | Giay Phep | Danh Muc | Lien Ket Nguon |\n")
            f.write("|---|---|---|---|---|---|\n")
            for idx, entry in enumerate(self.manifest):
                licenses_str = ", ".join(entry.get("licenses", ["CC-BY-SA 3.0"]))
                f.write(f"| {idx+1} | {entry['title']} | {entry['author']} | {licenses_str} | {entry['category']} | [Link]({entry.get('url', '#')}) |\n")
        print(f"[Credits] Da tao tep ghi danh ban quyen hop phap tai: {credits_path}")

    def sync_compatible_sheets_to_studio(self):
        """Quét và tích hợp các spritesheet nhân vật tương thích 832x3456 và 832x1344 vào Studio."""
        print("\n--- Kiem tra va dong bo cac Sprite Sheet chuan vao Studio ---")
        from PIL import Image
        copied_count = 0
        char_dir = CATEGORIES_DIR["characters"]
        os.makedirs(STUDIO_LPC_DIR, exist_ok=True)

        for root, _, files in os.walk(char_dir):
            for file in files:
                if not file.lower().endswith(".png"):
                    continue
                full_path = os.path.join(root, file)

                try:
                    with Image.open(full_path) as img:
                        width, height = img.size

                        # Trường hợp 1: Sheet đầy đủ 832x3456 chuẩn 54 hàng
                        if width == 832 and height == 3456:
                            target_file = os.path.join(STUDIO_LPC_DIR, file)
                            if not os.path.exists(target_file):
                                shutil.copy2(full_path, target_file)
                                print(f"  + Da sao chep sheet 832x3456: {file}")
                                copied_count += 1

                        # Trường hợp 2: Sheet 832x1344 chuẩn 21 hàng (Spellcast, Thrust, Walk, Slash, Shoot, Hurt)
                        elif width == 832 and height == 1344:
                            # Đặt tên tệp theo kiểu tóc và màu sắc
                            rel_parts = os.path.relpath(full_path, char_dir).replace("\\", "/").split("/")
                            if "hair" in rel_parts:
                                idx_h = rel_parts.index("hair")
                                style = rel_parts[idx_h + 1] if idx_h + 1 < len(rel_parts) else "style"
                                color = os.path.splitext(file)[0]
                                out_name = f"hair_{style}_{color}.png"
                            else:
                                out_name = f"sheet_{os.path.splitext(file)[0]}.png"

                            target_file = os.path.join(STUDIO_LPC_DIR, out_name)
                            if not os.path.exists(target_file):
                                # Tạo sheet 832x3456 trong suốt và dán sheet 21 hàng vào tọa độ (0, 0)
                                expanded_canvas = Image.new("RGBA", (832, 3456), (0, 0, 0, 0))
                                expanded_canvas.paste(img.convert("RGBA"), (0, 0))
                                expanded_canvas.save(target_file, "PNG")
                                print(f"  + Da mo rong va chuyen doi sheet 832x1344 -> 832x3456: {out_name}")
                                copied_count += 1
                except Exception:
                    pass

        # Quét và tạo tệp lpc_manifest.json cho Studio
        manifest_data: Dict[str, List[Dict[str, str]]] = {
            "hair": [], "torso": [], "legs": [], "feet": [], "hat": [], "weapons": [], "tails": [], "ears": []
        }
        for item_name in sorted(os.listdir(STUDIO_LPC_DIR)):
            if not item_name.endswith(".png"):
                continue
            cat = "hair" if item_name.startswith("hair_") else \
                  "torso" if item_name.startswith(("armor_", "torso_")) else \
                  "legs" if item_name.startswith(("pants_", "legs_")) else \
                  "feet" if item_name.startswith(("boots_", "feet_")) else \
                  "hat" if item_name.startswith(("hat_", "helmet_")) else \
                  "weapons" if item_name.startswith("weapon_") else \
                  "tails" if item_name.startswith("tail_") else \
                  "ears" if item_name.startswith("ears_") else "misc"
            
            if cat in manifest_data:
                clean_title = item_name.replace(".png", "").replace("_", " ").title()
                manifest_data[cat].append({
                    "id": item_name.replace(".png", ""),
                    "name": clean_title,
                    "imageUrl": f"/lpc_assets/{item_name}"
                })

        manifest_file_path = os.path.join(STUDIO_LPC_DIR, "lpc_manifest.json")
        with open(manifest_file_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, ensure_ascii=False, indent=2)

        print(f"[Studio Sync] Da dong bo them {copied_count} spritesheet vao public/lpc_assets.")
        print(f"[Studio Sync] Da cap nhat tep lpc_manifest.json tai: {manifest_file_path}")


def main():
    parser = argparse.ArgumentParser(description="Cong cu cao va phan loai tai nguyen OpenGameArt LPC Collection.")
    parser.add_argument("--limit", type=int, default=30, help="So luong tac pham can cao va xu ly (mac dinh: 30, truyen 0 neu muon cao het).")
    parser.add_argument("--category", type=str, default=None, choices=["characters", "monsters", "tilesets", "items_objects", "effects"], help="Loc theo danh muc mong muon.")
    parser.add_argument("--cache-file", type=str, default=r"C:\Users\hn.ngoitv\.gemini\antigravity-ide\brain\8ebdb57c-9310-4d31-b0d5-083303185882\.system_generated\steps\11\content.md", help="Duong dan tep cache HTML cua trang chu LPC Collection.")

    args = parser.parse_args()

    manager = LpcCollectionManager(cached_content_path=args.cache_file)
    manager.run_pipeline(limit=args.limit, category_filter=args.category)


if __name__ == "__main__":
    main()
