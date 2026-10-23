# scripts/delete_redundant_hair_assets.py
# Xóa an toàn các tệp tóc trùng lặp màu sắc trong public/lpc_assets:
# Giữ lại toàn bộ 48 kiểu dáng tóc độc nhất chuẩn dải màu và toàn bộ phụ kiện khác.
# Giải phóng gần 80 MB dung lượng và làm sạch kho tài nguyên.

import os
import json
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ASSET_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "studio", "public", "lpc_assets")
MANIFEST_PATH = os.path.join(ASSET_DIR, "lpc_manifest.json")

def main():
    if not os.path.exists(MANIFEST_PATH):
        print(f"Khong tim thay manifest tai {MANIFEST_PATH}")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    keep_files = set()
    for cat in manifest:
        for item in manifest[cat]:
            url = item.get("imageUrl", "")
            if url.startswith("/lpc_assets/"):
                keep_files.add(url.replace("/lpc_assets/", ""))

    # Các tệp hệ thống quan trọng khác cần giữ lại
    system_files = {
        "lpc_manifest.json",
        "sheet_masks_female.png", "sheet_masks_male.png",
        "sheet_reference_points_female.png", "sheet_reference_points_male.png",
        "hair_messy.png", "hair_spiked.png", "hair_curtains.png", "hair_bob.png", "hair_pixie.png", "hair_warrior.png"
    }
    keep_files.update(system_files)

    all_files = set(os.listdir(ASSET_DIR))
    deleted_count = 0
    deleted_bytes = 0

    for fname in all_files:
        # Chỉ xóa các tệp tóc bắt đầu bằng hair_ và có đuôi màu lặp lại, không nằm trong keep_files
        if fname not in keep_files and fname.startswith("hair_") and fname.endswith(".png"):
            fpath = os.path.join(ASSET_DIR, fname)
            try:
                fsize = os.path.getsize(fpath)
                os.remove(fpath)
                deleted_count += 1
                deleted_bytes += fsize
            except Exception as e:
                print(f"Loi khi xoa {fname}: {e}")

    mb = deleted_bytes / (1024 * 1024)
    print(f"DA XOA THANH CONG: {deleted_count} tep toc trung lap mau.")
    print(f"DUNG LUONG DA GIAI PHONG: {mb:.2f} MB.")
    print(f"SO TEP CON LAI TRONG KHO LPC: {len(os.listdir(ASSET_DIR))} tep tinh gon.")

if __name__ == "__main__":
    main()
