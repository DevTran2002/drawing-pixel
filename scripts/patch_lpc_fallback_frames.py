# scripts/patch_lpc_fallback_frames.py
# Kịch bản tự động kiểm tra và vá các khung hình chuyển động (Motion Rig Fallback Frames)
# cho toàn bộ tài nguyên LPC sang chuẩn 54 hàng x 13 cột (832x3456 pixel).
# Tự động tính toán bù trừ trọng tâm (Offset Compensation) theo ma trận LPC_MOTION_RIG_OFFSETS
# cho toàn bộ 9 hành động mở rộng: Leo trèo (Climb), Đứng thở (Idle), Bật nhảy (Jump),
# Ngồi nghỉ (Sit), Biểu cảm (Emote), Chạy nhanh (Run), Thủ thế chiến đấu (Combat Idle),
# Chém ngược (Backslash) và Chém nửa vòng (Halfslash).
# Giúp toàn bộ phụ kiện (tai, đuôi, tóc, mũ, áo, quần, khiên, vũ khí) ôm khít 100% vào cơ thể.

import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
from PIL import Image
from concurrent.futures import ThreadPoolExecutor

ASSET_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "studio", "public", "lpc_assets")

# Danh sách các tệp trang phục đã được vẽ tay đầy đủ 15 animations theo chuẩn Universal LPC
# Tuyệt đối không ghi đè lên các tệp vẽ tay nguyên bản này
GENUINE_HAND_DRAWN_FILES = {
    'armor_plate.png', 'armor_legion.png', 'armor_chainmail.png', 'armor_leather.png',
    'pants_leather.png', 'pants_pantaloons.png', 'pants_cuffed.png',
    'boots_leather.png', 'boots_fold.png', 'boots_plate.png', 'shoes_brown.png',
    'hat_helmet.png', 'hat_barbuta.png',
    'hair_messy.png', 'hair_spiked.png', 'hair_curtains.png', 'hair_bob.png', 'hair_pixie.png'
}

# Ma trận độ lệch chuyển động khung xương (dx, dy) chuẩn xác từng pixel cho 9 hành động mở rộng
OFFSETS = {
    # 1. Leo trèo (Climb - Hàng 21, 6 frames, góc nhìn từ sau lưng)
    'climb': [
        (2, -3), (1, -2), (0, -4), (-2, -3), (-1, -2), (0, -4)
    ],

    # 2. Đứng thở (Idle - Hàng 22..25, 2 frames)
    'idle': {
        0: [(0, 1), (0, 0)],    # Up (Hàng 22)
        1: [(0, 0), (0, -1)],   # Left (Hàng 23)
        2: [(0, 0), (0, -1)],   # Down (Hàng 24)
        3: [(0, 0), (0, -1)]    # Right (Hàng 25)
    },

    # 3. Bật nhảy (Jump - Hàng 26..29, 5 frames: nhún đà -> bật cao -> rơi xuống -> tiếp đất)
    'jump': {
        0: [(0, 2), (0, 4), (0, -2), (0, -4), (0, 0)],         # Up
        1: [(0, 0), (-3, 3), (0, -1), (0, -3), (0, 1)],        # Left
        2: [(0, 0), (0, 3), (0, 0), (0, -3), (0, 1)],          # Down
        3: [(0, 0), (3, 3), (0, -1), (0, -3), (0, 1)]          # Right
    },

    # 4. Ngồi nghỉ (Sit - Hàng 30..33, 3 frames: ngồi xuống -> ngồi bệt sâu -> đứng dậy)
    'sit': {
        0: [(0, 10), (-1, 9), (0, 0)],   # Up (Hàng 30)
        1: [(0, 8), (0, 8), (-3, 0)],    # Left (Hàng 31)
        2: [(0, 2), (0, 7), (0, -2)],    # Down (Hàng 32 - Frame 1 ngồi bệt sâu dy=+7)
        3: [(0, 9), (0, 9), (3, 0)]      # Right (Hàng 33)
    },

    # 5. Biểu cảm (Emote - Hàng 34..37, 3 frames)
    'emote': {
        0: [(0, 1), (0, 1), (0, -1)],
        1: [(0, 0), (0, 0), (6, -2)],
        2: [(0, 0), (0, 0), (0, -2)],
        3: [(0, 0), (0, 0), (-6, -2)]
    },

    # 6. Chạy nhanh (Run - Hàng 38..41, 8 frames sải chân theo chu kỳ bước đi Walk)
    'run': {
        0: [(0, 0), (0, 1), (0, 0), (0, -2), (0, 0), (0, 1), (0, 0), (0, -2)],
        1: [(-2, 1), (-2, 2), (-2, 1), (-2, -1), (-2, 1), (-2, 2), (-2, 1), (-2, -1)],
        2: [(0, 1), (0, 2), (0, 1), (0, -1), (0, 1), (0, 2), (0, 1), (0, -1)],
        3: [(2, 1), (2, 2), (2, 1), (2, -1), (2, 1), (2, 2), (2, 1), (2, -1)]
    },

    # 7. Thủ thế chiến đấu (Combat Idle - Hàng 42..45, 2 frames hạ thấp trọng tâm)
    'combat_idle': {
        0: [(0, 1), (0, 3)],
        1: [(-2, 0), (-3, 2)],
        2: [(1, -1), (1, 1)],
        3: [(2, 0), (3, 2)]
    },

    # 8. Chém ngược (Backslash - Hàng 46..49, 13 frames vung kiếm cực mạnh từ tư thế Slash)
    'backslash': {
        0: [(-1, 3), (0, -1), (-4, 0), (-6, 1), (-6, 1), (-6, 1), (0, -1), (-7, 1), (-5, 0), (1, -1), (3, -1), (3, -1), (3, -1)],
        1: [(5, -1), (-7, 1), (-9, 2), (-10, 2), (-10, 2), (-10, 2), (-7, 1), (-8, 2), (-3, 2), (1, 0), (4, -1), (4, -1), (4, -1)],
        2: [(-3, -1), (1, 1), (3, 1), (4, 1), (4, 1), (4, 1), (1, 1), (6, 1), (3, 1), (0, -1), (-1, -2), (-1, -2), (-1, -2)],
        3: [(-5, -1), (7, 1), (9, 2), (10, 2), (10, 2), (10, 2), (7, 1), (9, 2), (3, 2), (-1, 0), (-4, -1), (-4, -1), (-4, -1)]
    },

    # 9. Chém nửa vòng (Halfslash - Hàng 50..53, 6 frames chém nhanh nửa vòng tròn từ tư thế Slash)
    'halfslash': {
        0: [(-1, 3), (0, -1), (-3, -2), (-3, -3), (-3, -3), (0, -1)],
        1: [(5, -1), (-7, 1), (-10, 2), (-14, 2), (-14, 2), (-7, 1)],
        2: [(-3, -1), (1, 1), (3, 2), (4, 2), (4, 2), (1, 1)],
        3: [(-5, -1), (7, 1), (10, 2), (14, 2), (14, 2), (7, 1)]
    }
}

def patch_sheet(file_path):
    fname = os.path.basename(file_path)
    if fname in GENUINE_HAND_DRAWN_FILES:
        return False, "Tệp vẽ tay gốc, bỏ qua"

    try:
        im = Image.open(file_path).convert("RGBA")
    except Exception as e:
        return False, f"Lỗi đọc tệp: {e}"

    # Đảm bảo kích thước tối thiểu chuẩn Universal LPC 832x3456 (54 hàng x 13 cột)
    if im.size[0] < 832 or im.size[1] < 3456:
        new_im = Image.new("RGBA", (832, 3456), (0, 0, 0, 0))
        new_im.paste(im, (0, 0))
        im = new_im

    # Cắt 4 khung hình đứng yên làm mẫu từ chu kỳ bước đi Walk (Hàng 8..11, Cột 0)
    walk_up_crop = im.crop((0, 8 * 64, 64, 9 * 64))
    walk_left_crop = im.crop((0, 9 * 64, 64, 10 * 64))
    walk_down_crop = im.crop((0, 10 * 64, 64, 11 * 64))
    walk_right_crop = im.crop((0, 11 * 64, 64, 12 * 64))
    walk_frames_0 = [walk_up_crop, walk_left_crop, walk_down_crop, walk_right_crop]

    # Cắt 4 khung hình từ tư thế chém kiếm Slash (Hàng 12..15, Cột 0) nếu có
    slash_crops = []
    for d_idx in range(4):
        sr = 12 + d_idx
        sc = im.crop((0, sr * 64, 64, (sr + 1) * 64))
        if sc.getchannel("A").getbbox():
            slash_crops.append(sc)
        else:
            slash_crops.append(walk_frames_0[d_idx])

    # Kiểm tra xem tệp có dữ liệu bước đi hay không
    has_walk = any([
        walk_up_crop.getchannel("A").getbbox(),
        walk_left_crop.getchannel("A").getbbox(),
        walk_down_crop.getchannel("A").getbbox(),
        walk_right_crop.getchannel("A").getbbox()
    ])

    if not has_walk:
        return False, "Không có dữ liệu bước đi để làm nguồn fallback"

    blank_row = Image.new("RGBA", (832, 64), (0, 0, 0, 0))

    # 1. Leo trèo (Climb - Hàng 21, 6 frames)
    im.paste(blank_row, (0, 21 * 64))
    for f_idx, (dx, dy) in enumerate(OFFSETS['climb']):
        dest_x = f_idx * 64 + dx
        dest_y = 21 * 64 + dy
        im.paste(walk_up_crop, (dest_x, dest_y), walk_up_crop)

    # 2. Đứng thở (Idle - Hàng 22..25, 2 frames)
    for dir_idx in range(4):
        r = 22 + dir_idx
        im.paste(blank_row, (0, r * 64))
        base_frame = walk_frames_0[dir_idx]
        for f_idx, (dx, dy) in enumerate(OFFSETS['idle'][dir_idx]):
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(base_frame, (dest_x, dest_y), base_frame)

    # 3. Bật nhảy (Jump - Hàng 26..29, 5 frames)
    for dir_idx in range(4):
        r = 26 + dir_idx
        im.paste(blank_row, (0, r * 64))
        base_frame = walk_frames_0[dir_idx]
        for f_idx, (dx, dy) in enumerate(OFFSETS['jump'][dir_idx]):
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(base_frame, (dest_x, dest_y), base_frame)

    # 4. Ngồi nghỉ (Sit - Hàng 30..33, 3 frames)
    for dir_idx in range(4):
        r = 30 + dir_idx
        im.paste(blank_row, (0, r * 64))
        base_frame = walk_frames_0[dir_idx]
        for f_idx, (dx, dy) in enumerate(OFFSETS['sit'][dir_idx]):
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(base_frame, (dest_x, dest_y), base_frame)

    # 5. Biểu cảm (Emote - Hàng 34..37, 3 frames)
    for dir_idx in range(4):
        r = 34 + dir_idx
        im.paste(blank_row, (0, r * 64))
        base_frame = walk_frames_0[dir_idx]
        for f_idx, (dx, dy) in enumerate(OFFSETS['emote'][dir_idx]):
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(base_frame, (dest_x, dest_y), base_frame)

    # 6. Chạy nhanh (Run - Hàng 38..41, 8 frames theo chu kỳ bước đi Walk)
    for dir_idx in range(4):
        r = 38 + dir_idx
        im.paste(blank_row, (0, r * 64))
        walk_row = 8 + dir_idx
        for f_idx in range(8):
            walk_frame = im.crop((f_idx * 64, walk_row * 64, (f_idx + 1) * 64, (walk_row + 1) * 64))
            dx, dy = OFFSETS['run'][dir_idx][f_idx]
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(walk_frame, (dest_x, dest_y), walk_frame)

    # 7. Thủ thế chiến đấu (Combat Idle - Hàng 42..45, 2 frames)
    for dir_idx in range(4):
        r = 42 + dir_idx
        im.paste(blank_row, (0, r * 64))
        base_frame = walk_frames_0[dir_idx]
        for f_idx, (dx, dy) in enumerate(OFFSETS['combat_idle'][dir_idx]):
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(base_frame, (dest_x, dest_y), base_frame)

    # 8. Chém ngược (Backslash - Hàng 46..49, 13 frames)
    for dir_idx in range(4):
        r = 46 + dir_idx
        im.paste(blank_row, (0, r * 64))
        base_frame = slash_crops[dir_idx]
        slash_row = 12 + dir_idx
        for f_idx in range(13):
            # Lấy chu kỳ frame chém kiếm từ Slash (Hàng 12..15)
            slash_col = f_idx % 6
            slash_frame = im.crop((slash_col * 64, slash_row * 64, (slash_col + 1) * 64, (slash_row + 1) * 64))
            f_src = slash_frame if slash_frame.getchannel("A").getbbox() else base_frame
            dx, dy = OFFSETS['backslash'][dir_idx][f_idx]
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(f_src, (dest_x, dest_y), f_src)

    # 9. Chém nửa vòng (Halfslash - Hàng 50..53, 6 frames)
    for dir_idx in range(4):
        r = 50 + dir_idx
        im.paste(blank_row, (0, r * 64))
        base_frame = slash_crops[dir_idx]
        slash_row = 12 + dir_idx
        for f_idx in range(6):
            slash_col = f_idx % 6
            slash_frame = im.crop((slash_col * 64, slash_row * 64, (slash_col + 1) * 64, (slash_row + 1) * 64))
            f_src = slash_frame if slash_frame.getchannel("A").getbbox() else base_frame
            dx, dy = OFFSETS['halfslash'][dir_idx][f_idx]
            dest_x = f_idx * 64 + dx
            dest_y = r * 64 + dy
            im.paste(f_src, (dest_x, dest_y), f_src)

    im.save(file_path, format="PNG")
    return True, "Đã vá thành công 9 hành động mở rộng với bù trừ chuyển động khung xương"

def process_file(fname):
    fpath = os.path.join(ASSET_DIR, fname)
    patched, msg = patch_sheet(fpath)
    return fname, patched

def main():
    print("Bắt đầu tiến trình vá toàn diện ma trận chuyển động khung xương cho kho tài nguyên LPC...", flush=True)
    all_files = sorted([f for f in os.listdir(ASSET_DIR) if f.endswith(".png")])
    print(f"Tổng số tệp cần xử lý: {len(all_files)}", flush=True)

    count_patched = 0
    with ThreadPoolExecutor(max_workers=12) as executor:
        for fname, patched in executor.map(process_file, all_files):
            if patched:
                count_patched += 1
                if count_patched % 100 == 0 or count_patched <= 5:
                    print(f"  + [{count_patched}] Đã vá chính xác 9 hành động cho: {fname}", flush=True)

    print(f"\nHOÀN TẤT! Đã đồng bộ và bù trừ tọa độ chuẩn xác cho {count_patched} tệp tài nguyên LPC.", flush=True)

if __name__ == "__main__":
    main()
