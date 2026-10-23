# scripts/import_lpc_tools_and_weapons.py
# Kịch bản biên soạn chuẩn xác từng pixel cho Công Cụ (Tools), Vũ Khí (Weapons) và Khiên (Shields)
# Tuyệt đối không chồng đè bg lên fg, không chèn ảnh 128x128 vào ô 64x64 gây duplicate

import os
import json
from PIL import Image

SRC_BASE = 'scratch/lpc-generator/spritesheets'
DEST_BASE = 'apps/studio/public/lpc_assets'
MANIFEST_PATH = os.path.join(DEST_BASE, 'lpc_manifest.json')

FRAME_SIZE = 64
SHEET_WIDTH = 832
SHEET_HEIGHT = 3456

# Tọa độ Y các hàng chuẩn LPC 54 hàng (chuẩn 64x64)
ANIMATION_OFFSETS = {
    'spellcast': 0,
    'thrust': 4 * FRAME_SIZE,      # 256
    'walk': 8 * FRAME_SIZE,        # 512
    'slash': 12 * FRAME_SIZE,      # 768
    'shoot': 16 * FRAME_SIZE,      # 1024
    'hurt': 20 * FRAME_SIZE,       # 1280
    'climb': 21 * FRAME_SIZE,      # 1344
    'idle': 22 * FRAME_SIZE,       # 1408
    'jump': 26 * FRAME_SIZE,       # 1664
    'sit': 30 * FRAME_SIZE,        # 1920
    'emote': 34 * FRAME_SIZE,      # 2176
    'run': 38 * FRAME_SIZE,        # 2432
    'combat_idle': 42 * FRAME_SIZE,# 2688
    'backslash': 46 * FRAME_SIZE,  # 2944
    'halfslash': 50 * FRAME_SIZE   # 3200
}

def create_blank_sheet():
    return Image.new('RGBA', (SHEET_WIDTH, SHEET_HEIGHT), (0, 0, 0, 0))

def overlay_single_sprite(dest, src_path, y):
    """Vẽ 1 nguồn ảnh duy nhất vào dest tại Y, tuyệt đối không dán nhiều tệp đè lên nhau."""
    if not os.path.exists(src_path):
        return False
    try:
        im = Image.open(src_path).convert('RGBA')
        w = min(im.width, dest.width)
        h = min(im.height, dest.height - y)
        if w > 0 and h > 0:
            crop = im.crop((0, 0, w, h))
            dest.alpha_composite(crop, (0, y))
            return True
    except Exception as e:
        print(f"Loi doc file {src_path}: {e}")
    return False

def fill_fallback_rows_clean(sheet):
    """Điền an toàn các hàng mở rộng từ hàng Walk mà không gây bóng mờ duplicate."""
    # Lấy 4 hàng walk (từ hàng 8 đến hàng 11, Y = 512, cao 256)
    walk_box = sheet.crop((0, ANIMATION_OFFSETS['walk'], SHEET_WIDTH, ANIMATION_OFFSETS['walk'] + 4 * FRAME_SIZE))
    if not walk_box.getbbox():
        return sheet
        
    stand_frame = walk_box.crop((0, 0, FRAME_SIZE, 4 * FRAME_SIZE))
    
    # 1. Idle (hàng 22..25, Y = 1408)
    idle_area = sheet.crop((0, ANIMATION_OFFSETS['idle'], SHEET_WIDTH, ANIMATION_OFFSETS['idle'] + 4 * FRAME_SIZE))
    if not idle_area.getbbox():
        for col in range(3):
            sheet.alpha_composite(stand_frame, (col * FRAME_SIZE, ANIMATION_OFFSETS['idle']))
            
    # 2. Combat Idle (hàng 42..45, Y = 2688)
    combat_area = sheet.crop((0, ANIMATION_OFFSETS['combat_idle'], SHEET_WIDTH, ANIMATION_OFFSETS['combat_idle'] + 4 * FRAME_SIZE))
    if not combat_area.getbbox():
        for col in range(3):
            sheet.alpha_composite(stand_frame, (col * FRAME_SIZE, ANIMATION_OFFSETS['combat_idle']))
            
    # 3. Run (hàng 38..41, Y = 2432)
    run_area = sheet.crop((0, ANIMATION_OFFSETS['run'], SHEET_WIDTH, ANIMATION_OFFSETS['run'] + 4 * FRAME_SIZE))
    if not run_area.getbbox():
        sheet.alpha_composite(walk_box, (0, ANIMATION_OFFSETS['run']))
        
    # 4. Jump (hàng 26..29, Y = 1664)
    jump_area = sheet.crop((0, ANIMATION_OFFSETS['jump'], SHEET_WIDTH, ANIMATION_OFFSETS['jump'] + 4 * FRAME_SIZE))
    if not jump_area.getbbox():
        for col in range(6):
            sheet.alpha_composite(stand_frame, (col * FRAME_SIZE, ANIMATION_OFFSETS['jump']))
            
    # 5. Sit (hàng 30..33, Y = 1920)
    sit_area = sheet.crop((0, ANIMATION_OFFSETS['sit'], SHEET_WIDTH, ANIMATION_OFFSETS['sit'] + 4 * FRAME_SIZE))
    if not sit_area.getbbox():
        for col in range(3):
            sheet.alpha_composite(stand_frame, (col * FRAME_SIZE, ANIMATION_OFFSETS['sit']))
            
    return sheet

# -------------------------------------------------------------
# 1. TỔNG HỢP CÁC CÔNG CỤ LAO ĐỘNG (TOOLS) - CHUẨN 1 NGUỒN ẢNH DUY NHẤT
# -------------------------------------------------------------
TOOLS_CONFIG = [
    {
        'id': 'tool_axe',
        'name': 'Rìu Chặt Củi (Wood Axe)',
        'folder': 'tools/axe',
        'walk_file': 'male/walk.png'
    },
    {
        'id': 'tool_pickaxe',
        'name': 'Cuốc Chim Khai Khoáng (Pickaxe)',
        'folder': 'tools/pickaxe',
        'walk_file': 'male/walk.png'
    },
    {
        'id': 'tool_hammer',
        'name': 'Búa Thợ Rèn (Forge Hammer)',
        'folder': 'tools/hammer',
        'walk_file': 'male/walk.png'
    },
    {
        'id': 'tool_shovel',
        'name': 'Xẻng Đào Đất (Iron Shovel)',
        'folder': 'tools/shovel',
        'walk_file': 'fg/walk.png',
        'thrust_file': 'fg/thrust.png'
    },
    {
        'id': 'tool_hoe',
        'name': 'Cuốc Làm Nông (Garden Hoe)',
        'folder': 'tools/hoe',
        'walk_file': 'fg/walk.png',
        'thrust_file': 'fg/thrust.png'
    },
    {
        'id': 'tool_watering_can',
        'name': 'Bình Tưới Cây (Watering Can)',
        'folder': 'tools/watering_can',
        'walk_file': 'fg/walk.png',
        'thrust_file': 'fg/thrust.png'
    }
]

def build_tool(cfg):
    base_dir = os.path.join(SRC_BASE, cfg['folder'])
    sheet = create_blank_sheet()
    
    if 'walk_file' in cfg:
        p = os.path.join(base_dir, cfg['walk_file'])
        overlay_single_sprite(sheet, p, ANIMATION_OFFSETS['walk'])
        
    if 'thrust_file' in cfg:
        p = os.path.join(base_dir, cfg['thrust_file'])
        overlay_single_sprite(sheet, p, ANIMATION_OFFSETS['thrust'])
        
    fill_fallback_rows_clean(sheet)
    out_path = os.path.join(DEST_BASE, f"{cfg['id']}.png")
    sheet.save(out_path, optimize=True)
    print(f"Da tao Tool sach: {out_path}")
    return {
        'id': cfg['id'],
        'name': cfg['name'],
        'imageUrl': f"/lpc_assets/{cfg['id']}.png"
    }

# -------------------------------------------------------------
# 2. TỔNG HỢP CÁC LOẠI VŨ KHÍ (WEAPONS) - CHỈ LẤY FOREGROUND FG CHUẨN
# -------------------------------------------------------------
WEAPONS_CONFIG = {
    'weapons_sword': [
        ('weapon_sword_arming', 'Kiếm Hiệp Sĩ (Arming Sword)', 'weapon/sword/arming'),
        ('weapon_sword_katana', 'Kiếm Nhật Katana', 'weapon/sword/katana'),
        ('weapon_sword_dagger', 'Đoản Đao Thích Khách (Dagger)', 'weapon/sword/dagger'),
        ('weapon_sword_longsword', 'Trường Kiếm (Longsword)', 'weapon/sword/longsword'),
        ('weapon_sword_rapier', 'Kiếm Liễu Quý Tộc (Rapier)', 'weapon/sword/rapier'),
        ('weapon_sword_saber', 'Kiếm Kỵ Binh (Saber)', 'weapon/sword/saber'),
        ('weapon_sword_scimitar', 'Đao Cong Sa Mạc (Scimitar)', 'weapon/sword/scimitar'),
    ],
    'weapons_blunt': [
        ('weapon_blunt_mace', 'Chùy Gai Thiết Giáp (Mace)', 'weapon/blunt/mace'),
        ('weapon_blunt_waraxe', 'Rìu Chiến Song Lưỡi (Battle Axe)', 'weapon/blunt/waraxe'),
        ('weapon_blunt_flail', 'Chùy Xích Hiệp Sĩ (Flail)', 'weapon/blunt/flail'),
        ('weapon_blunt_club', 'Gậy Gai Chiến Binh (Spiked Club)', 'weapon/blunt/club'),
    ],
    'weapons_polearm': [
        ('weapon_polearm_spear', 'Ngọn Giáo Chiến Binh (Spear)', 'weapon/polearm/spear'),
        ('weapon_polearm_halberd', 'Đại Kích Chiến Trận (Halberd)', 'weapon/polearm/halberd'),
        ('weapon_polearm_trident', 'Đinh Ba Thần Biển (Trident)', 'weapon/polearm/trident'),
        ('weapon_polearm_scythe', 'Lưỡi Hái Tử Thần (Death Scythe)', 'weapon/polearm/scythe'),
    ],
    'weapons_ranged': [
        ('weapon_ranged_bow', 'Cung Gỗ Xạ Thủ (Recurve Bow)', 'weapon/ranged/bow'),
        ('weapon_ranged_crossbow', 'Nỏ Săn Cơ Khí (Crossbow)', 'weapon/ranged/crossbow'),
        ('weapon_ranged_slingshot', 'Súng Cao Su (Slingshot)', 'weapon/ranged/slingshot'),
        ('weapon_ranged_boomerang', 'Vũ Khí Boomerang', 'weapon/ranged/boomerang'),
    ],
    'weapons_magic': [
        ('weapon_magic_wand', 'Đũa Phép Thuật (Magic Wand)', 'weapon/magic/wand'),
        ('weapon_magic_crystal', 'Gậy Phép Pha Lê (Crystal Staff)', 'weapon/magic/crystal'),
        ('weapon_magic_diamond', 'Gậy Kim Cương Cổ Đại (Diamond Staff)', 'weapon/magic/diamond'),
        ('weapon_magic_gnarled', 'Trượng Gỗ Thần Bí (Gnarled Staff)', 'weapon/magic/gnarled'),
    ]
}

def find_best_weapon_file(folder_path, anim_name):
    """Tìm đúng duy nhất 1 tệp FG (foreground) chuẩn 64x64 cho animation, bỏ qua hoàn toàn bg."""
    candidates = []
    for root, dirs, files in os.walk(folder_path):
        for f in files:
            if not f.endswith('.png'):
                continue
            fp = os.path.join(root, f)
            rel = os.path.relpath(fp, folder_path).lower().replace('\\', '/')
            
            # Loại bỏ hoàn toàn các thư mục bg (background) và các biến thể kim loại
            if '/bg/' in rel or rel.endswith('/bg.png') or 'behind' in rel or 'background' in rel:
                continue
            if any(c in rel for c in ['brass', 'bronze', 'copper', 'gold', 'silver', 'steel', 'iron', 'ceramic']):
                continue
                
            # Kiểm tra xem có khớp animation
            if anim_name in rel:
                try:
                    im = Image.open(fp)
                    # Chỉ lấy ảnh có chiều cao tương ứng với 64x64 (ví dụ 1 hàng = 64, 4 hàng = 256)
                    # Bỏ qua các ảnh 128x128 có chiều cao 512 hoặc 768
                    if im.height in [64, 256]:
                        candidates.append((fp, im.size))
                except:
                    pass
                    
    # Ưu tiên tệp có 'fg' hoặc 'universal'
    candidates.sort(key=lambda x: (0 if 'universal' in x[0] else 1, 0 if 'fg' in x[0] else 1))
    return candidates[0][0] if candidates else None

def build_weapon(w_id, w_name, folder_rel):
    base_dir = os.path.join(SRC_BASE, folder_rel)
    if not os.path.exists(base_dir):
        return None
        
    sheet = create_blank_sheet()
    
    # 1. Walk (hàng 8..11, Y = 512)
    walk_file = find_best_weapon_file(base_dir, 'walk')
    if walk_file:
        overlay_single_sprite(sheet, walk_file, ANIMATION_OFFSETS['walk'])
        
    # 2. Thrust (hàng 4..7, Y = 256)
    thrust_file = find_best_weapon_file(base_dir, 'thrust')
    if thrust_file:
        overlay_single_sprite(sheet, thrust_file, ANIMATION_OFFSETS['thrust'])
        
    # 3. Shoot (hàng 16..19, Y = 1024)
    shoot_file = find_best_weapon_file(base_dir, 'shoot')
    if shoot_file:
        overlay_single_sprite(sheet, shoot_file, ANIMATION_OFFSETS['shoot'])
        
    # 4. Combat Idle (hàng 42..45, Y = 2688)
    combat_file = find_best_weapon_file(base_dir, 'combat')
    if combat_file:
        overlay_single_sprite(sheet, combat_file, ANIMATION_OFFSETS['combat_idle'])
        
    # 5. Idle (hàng 22..25, Y = 1408)
    idle_file = find_best_weapon_file(base_dir, 'idle')
    if idle_file:
        overlay_single_sprite(sheet, idle_file, ANIMATION_OFFSETS['idle'])
        
    # 6. Hurt (hàng 20, Y = 1280)
    hurt_file = find_best_weapon_file(base_dir, 'hurt')
    if hurt_file:
        overlay_single_sprite(sheet, hurt_file, ANIMATION_OFFSETS['hurt'])
        
    fill_fallback_rows_clean(sheet)
    out_path = os.path.join(DEST_BASE, f"{w_id}.png")
    sheet.save(out_path, optimize=True)
    print(f"Da tao Vu khi sach: {out_path}")
    return {
        'id': w_id,
        'name': w_name,
        'imageUrl': f"/lpc_assets/{w_id}.png"
    }

# -------------------------------------------------------------
# 3. TỔNG HỢP CÁC LOẠI KHIÊN (SHIELDS)
# -------------------------------------------------------------
SHIELDS_CONFIG = [
    ('shield_heater', 'Khiên Tam Giác Hiệp Sĩ (Heater Shield)', 'shield/heater'),
    ('shield_kite', 'Khiên Giọt Nước (Kite Shield)', 'shield/kite'),
    ('shield_round', 'Khiên Tròn Viking (Round Shield)', 'shield/round'),
    ('shield_scutum', 'Khiên Chữ Nhật La Mã (Roman Scutum)', 'shield/scutum'),
    ('shield_spartan', 'Khiên Đồng Sparta (Spartan Shield)', 'shield/spartan'),
]

def build_shield(s_id, s_name, folder_rel):
    base_dir = os.path.join(SRC_BASE, folder_rel)
    if not os.path.exists(base_dir):
        return None
        
    sheet = create_blank_sheet()
    walk_file = find_best_weapon_file(base_dir, 'walk')
    if walk_file:
        overlay_single_sprite(sheet, walk_file, ANIMATION_OFFSETS['walk'])
    combat_file = find_best_weapon_file(base_dir, 'combat')
    if combat_file:
        overlay_single_sprite(sheet, combat_file, ANIMATION_OFFSETS['combat_idle'])
        
    fill_fallback_rows_clean(sheet)
    out_path = os.path.join(DEST_BASE, f"{s_id}.png")
    sheet.save(out_path, optimize=True)
    print(f"Da tao Khien sach: {out_path}")
    return {
        'id': s_id,
        'name': s_name,
        'imageUrl': f"/lpc_assets/{s_id}.png"
    }

def main():
    print("=== BAT DAU BIEN SOAN CONG CU VA VU KHI SACH SE (KHONG CHONG DE) ===")
    
    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
        
    # 1. Tools
    tools_list = []
    for cfg in TOOLS_CONFIG:
        item = build_tool(cfg)
        if item:
            tools_list.append(item)
    manifest['tools'] = tools_list
    
    # 2. Weapons
    for cat_key, w_defs in WEAPONS_CONFIG.items():
        w_list = []
        for w_id, w_name, folder in w_defs:
            item = build_weapon(w_id, w_name, folder)
            if item:
                w_list.append(item)
        manifest[cat_key] = w_list
        
    # 3. Shields
    shield_list = []
    for s_id, s_name, folder in SHIELDS_CONFIG:
        item = build_shield(s_id, s_name, folder)
        if item:
            shield_list.append(item)
    manifest['shield'] = shield_list
    
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        
    print("=== HOAN TAT! Da cap nhat toan bo asset sach se khong con duplicate! ===")

if __name__ == '__main__':
    main()
