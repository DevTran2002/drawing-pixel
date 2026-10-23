# scripts/build_full_lpc_collection.py
# Kịch bản tự động tổng hợp, tải và ghép đầy đủ các lớp phụ kiện Universal LPC
# (Giáp ngực, Áo sơ mi, Quần, Váy, Giày, Ủng, Sandal, Mũ sắt, Mũ trùm, Áo choàng, Khiên, Thắt lưng...)
# vào apps/studio/public/lpc_assets thành chuẩn Full Spritesheet 832x3456 vẽ tay 100%.

import os
import sys
import urllib.request
from PIL import Image

# Thiết lập bảng mã UTF-8 cho console Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_LPC_ENTRY = os.path.join(BASE_DIR, "assets", "lpc_collection", "characters", "lpc_entry_base", "lpc_entry", "png")
OUTPUT_DIR = os.path.join(BASE_DIR, "apps", "studio", "public", "lpc_assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

GITHUB_RAW_BASE = "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets"

# Tọa độ Y pixel chuẩn của các animation trong sprite sheet 832x3456 (Row * 64)
ANIM_LAYOUT = {
    "spellcast": 0,      # Hàng 0-3 (Y: 0..255)
    "thrust": 256,       # Hàng 4-7 (Y: 256..511)
    "walk": 512,         # Hàng 8-11 (Y: 512..767)
    "slash": 768,        # Hàng 12-15 (Y: 768..1023)
    "shoot": 1024,       # Hàng 16-19 (Y: 1024..1279)
    "hurt": 1280,        # Hàng 20 (Y: 1280..1343)
}

# Bản đồ ánh xạ tên animation trong thư mục local lpc_entry
LOCAL_ANIM_FOLDER_MAP = {
    "spellcast": "spellcast",
    "thrust": "thrust",
    "walk": "walkcycle",
    "slash": "slash",
    "shoot": "bow",
    "hurt": "hurt",
}

# 1. Danh sách phụ kiện từ nguồn Local lpc_entry (vẽ tay gốc, độ phân giải pixel hoàn hảo)
LOCAL_LPC_ITEMS = [
    # --- ÁO & GIÁP THÂN (TORSO) ---
    {
        "file_name": "TORSO_plate_armor_torso.png",
        "output": "armor_plate_heavy.png",
        "name": "Giáp Sắt Đại Hiệp Sĩ (Heavy Plate)",
        "category": "torso",
    },
    {
        "file_name": "TORSO_plate_armor_arms_shoulders.png",
        "output": "armor_plate_shoulders.png",
        "name": "Giáp Vai Cánh Tay Bọc Sắt (Plate Pauldrons)",
        "category": "torso",
    },
    {
        "file_name": "TORSO_chain_armor_torso.png",
        "output": "armor_chainmail.png",
        "name": "Áo Giáp Lưới Xích (Chainmail)",
        "category": "torso",
    },
    {
        "file_name": "TORSO_chain_armor_jacket_purple.png",
        "output": "jacket_purple_chain.png",
        "name": "Áo Khoác Hoàng Gia Lót Xích (Royal Purple Jacket)",
        "category": "torso",
    },
    {
        "file_name": "TORSO_leather_armor_torso.png",
        "output": "armor_leather_vest.png",
        "name": "Áo Giáp Da Thợ Săn (Leather Vest)",
        "category": "torso",
    },
    {
        "file_name": "TORSO_leather_armor_shirt_white.png",
        "output": "shirt_white.png",
        "name": "Áo Sơ Mi Trắng Lữ Khách (White Hunter Shirt)",
        "category": "torso",
    },
    {
        "file_name": "TORSO_robe_shirt_brown.png",
        "output": "robe_brown.png",
        "name": "Áo Choàng Pháp Sư Nâu (Mage Robe Shirt)",
        "category": "torso",
    },

    # --- QUẦN & VÁY (LEGS) ---
    {
        "file_name": "LEGS_plate_armor_pants.png",
        "output": "pants_plate.png",
        "name": "Giáp Chân Bọc Thép (Plate Greaves)",
        "category": "legs",
    },
    {
        "file_name": "LEGS_pants_greenish.png",
        "output": "pants_forest.png",
        "name": "Quần Vải Lục Lâm (Forest Green Pants)",
        "category": "legs",
    },
    {
        "file_name": "LEGS_robe_skirt.png",
        "output": "skirt_robe.png",
        "name": "Váy Choàng Đạo Sĩ (Mage Robe Skirt)",
        "category": "legs",
    },

    # --- GIÀY & ỦNG (FEET) ---
    {
        "file_name": "FEET_plate_armor_shoes.png",
        "output": "boots_plate.png",
        "name": "Ủng Sắt Thiết Kỵ (Iron Plate Boots)",
        "category": "feet",
    },
    {
        "file_name": "FEET_shoes_brown.png",
        "output": "shoes_brown.png",
        "name": "Giày Da Nâu Du Hành (Traveler Brown Shoes)",
        "category": "feet",
    },

    # --- MŨ & TRANG SỨC ĐẦU (HAT) ---
    {
        "file_name": "HEAD_plate_armor_helmet.png",
        "output": "hat_plate_helm.png",
        "name": "Mũ Sắt Toàn Diện (Full Plate Helm)",
        "category": "hat",
    },
    {
        "file_name": "HEAD_chain_armor_helmet.png",
        "output": "hat_chain_helm.png",
        "name": "Mũ Nồi Giáp Xích (Chainmail Coif Helm)",
        "category": "hat",
    },
    {
        "file_name": "HEAD_chain_armor_hood.png",
        "output": "hat_chain_hood.png",
        "name": "Mũ Trùm Đầu Giáp Xích (Chainmail Hood)",
        "category": "hat",
    },
    {
        "file_name": "HEAD_leather_armor_hat.png",
        "output": "hat_leather.png",
        "name": "Mũ Da Cung Thủ (Ranger Leather Hat)",
        "category": "hat",
    },
    {
        "file_name": "HEAD_robe_hood.png",
        "output": "hat_robe_hood.png",
        "name": "Mũ Trùm Pháp Sư Huyền Bí (Mage Cowl Hood)",
        "category": "hat",
    },

    # --- THẮT LƯNG (BELT) ---
    {
        "file_name": "BELT_leather.png",
        "output": "belt_leather.png",
        "name": "Thắt Lưng Da Khóa Đồng (Leather Belt)",
        "category": "belt",
    },
    {
        "file_name": "BELT_rope.png",
        "output": "belt_rope.png",
        "name": "Thắt Lưng Dây Thừng Đạo Sĩ (Monk Rope Belt)",
        "category": "belt",
    },

    # --- GĂNG TAY (GLOVES) ---
    {
        "file_name": "HANDS_plate_armor_gloves.png",
        "output": "gloves_plate.png",
        "name": "Găng Tay Bọc Thép (Plate Gauntlets)",
        "category": "gloves",
    },

    # --- VŨ KHÍ & KHIÊN (WEAPON / SHIELD) ---
    {
        "file_name": "BEHIND_quiver.png",
        "output": "quiver_arrows.png",
        "name": "Ống Tên Cung Thủ Sau Lưng (Back Quiver)",
        "category": "quiver",
    },
    {
        "file_name": "WEAPON_shield_cutout_body.png",
        "output": "shield_wooden.png",
        "name": "Khiên Gỗ Viền Sắt (Reinforced Wooden Shield)",
        "category": "shield",
    },
]

# 2. Danh sách phụ kiện trực tuyến từ GitHub LiberatedPixelCup (tải bổ sung)
ONLINE_LPC_ITEMS = [
    # --- ÁO & GIÁP THÂN (TORSO) ---
    {
        "github_path": "torso/clothes/longsleeve/longsleeve/male",
        "output": "torso_longsleeve.png",
        "name": "Áo Sơ Mi Tay Dài (Longsleeve Shirt)",
        "category": "torso",
    },
    {
        "github_path": "torso/clothes/shortsleeve/shortsleeve/male",
        "output": "torso_shortsleeve.png",
        "name": "Áo Cộc Tay Thoải Mái (Shortsleeve Shirt)",
        "category": "torso",
    },
    {
        "github_path": "torso/jacket/tabard/male",
        "output": "torso_tabard.png",
        "name": "Áo Choàng Ngực Tabard (Knight Tabard)",
        "category": "torso",
    },
    {
        "github_path": "torso/jacket/collared/male",
        "output": "torso_jacket_collared.png",
        "name": "Áo Khoác Cổ Đứng Lãng Du (Collared Jacket)",
        "category": "torso",
    },

    # --- QUẦN & VÁY (LEGS) ---
    {
        "github_path": "legs/pantaloons/male",
        "output": "pants_pantaloons.png",
        "name": "Quần Thụng Quý Tộc (Noble Pantaloons)",
        "category": "legs",
    },
    {
        "github_path": "legs/shorts/shorts/male",
        "output": "pants_shorts.png",
        "name": "Quần Đùi Dã Chiến (Adventurer Shorts)",
        "category": "legs",
    },
    {
        "github_path": "legs/cuffed/male",
        "output": "pants_cuffed.png",
        "name": "Quần Túm Gấu Du Mục (Cuffed Pants)",
        "category": "legs",
    },

    # --- GIÀY & ỦNG (FEET) ---
    {
        "github_path": "feet/sandals/male",
        "output": "boots_sandals.png",
        "name": "Dép Quai Hậu Sandal (Traveler Sandals)",
        "category": "feet",
    },

    # --- MŨ (HAT) ---
    {
        "github_path": "hat/helmet/horned/adult",
        "output": "hat_horned.png",
        "name": "Mũ Sừng Chiến Binh Viking (Horned Helmet)",
        "category": "hat",
    },
    {
        "github_path": "hat/helmet/barbuta/male",
        "output": "hat_barbuta.png",
        "name": "Mũ Thiết Kỵ Barbuta (Barbuta Helm)",
        "category": "hat",
    },

    # --- ÁO CHOÀNG (CAPE) ---
    {
        "github_path": "cape/solid/fg",
        "output": "cape_solid.png",
        "name": "Áo Choàng Hiệp Sĩ (Knight Cloak)",
        "category": "cape",
    },
]

def build_from_local_entry(item):
    """Ghép sprite sheet chuẩn 832x3456 từ thư mục lpc_entry có sẵn trong máy."""
    out_file = item["output"]
    out_path = os.path.join(OUTPUT_DIR, out_file)
    target_name = item["file_name"]
    sheet = Image.new("RGBA", (832, 3456), (0, 0, 0, 0))
    count = 0

    for anim_name, y_offset in ANIM_LAYOUT.items():
        subfolder = LOCAL_ANIM_FOLDER_MAP.get(anim_name, anim_name)
        src_path = os.path.join(LOCAL_LPC_ENTRY, subfolder, target_name)
        if os.path.exists(src_path):
            try:
                anim_img = Image.open(src_path).convert("RGBA")
                sheet.paste(anim_img, (0, y_offset), anim_img)
                count += 1
            except Exception as e:
                print(f"    Lỗi đọc ảnh {src_path}: {e}")

    sheet.save(out_path, format="PNG")
    print(f"  [Local LPC] Hoàn thành {item['name']} -> {out_file} ({count}/6 hoạt ảnh)")
    return True

def build_from_github_raw(item):
    """Tải và ghép các file animation rời từ GitHub LiberatedPixelCup thành 832x3456."""
    out_file = item["output"]
    out_path = os.path.join(OUTPUT_DIR, out_file)
    gh_path = item["github_path"]
    sheet = Image.new("RGBA", (832, 3456), (0, 0, 0, 0))
    headers = {"User-Agent": "Mozilla/5.0"}
    count = 0

    for anim_name, y_offset in ANIM_LAYOUT.items():
        url = f"{GITHUB_RAW_BASE}/{gh_path}/{anim_name}.png"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                anim_img = Image.open(resp).convert("RGBA")
                sheet.paste(anim_img, (0, y_offset), anim_img)
                count += 1
        except Exception:
            pass

    if count > 0:
        sheet.save(out_path, format="PNG")
        print(f"  [Online LPC] Hoàn thành {item['name']} -> {out_file} ({count}/6 hoạt ảnh)")
        return True
    else:
        print(f"  [Cảnh báo] Không tải được hoạt ảnh nào cho {item['name']} tại {gh_path}")
        return False

def main():
    print("=== BẮT ĐẦU TỔNG HỢP TOÀN BỘ DANH MỤC TRANG PHỤC VÀ GIÁP UNIVERSAL LPC ===")
    
    # 1. Xử lý các tài nguyên cục bộ lpc_entry
    print(f"\n--- 1. Xử lý {len(LOCAL_LPC_ITEMS)} phụ kiện gốc từ thư mục Local lpc_entry ---")
    for item in LOCAL_LPC_ITEMS:
        build_from_local_entry(item)

    # 2. Xử lý các tài nguyên từ GitHub Raw
    print(f"\n--- 2. Tải và xử lý {len(ONLINE_LPC_ITEMS)} phụ kiện từ kho trực tuyến LPC ---")
    for item in ONLINE_LPC_ITEMS:
        build_from_github_raw(item)

    print("\n=== HOÀN TẤT TIẾN TRÌNH XUẤT SPRITESHEET ĐẦY ĐỦ CHO TẤT CẢ CÁC LỚP LPC! ===")

if __name__ == "__main__":
    main()
