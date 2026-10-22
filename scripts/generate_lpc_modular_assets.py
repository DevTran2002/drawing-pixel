"""
scripts/generate_lpc_modular_assets.py
Tự động trích xuất và sinh 3 layer phụ kiện chuẩn LPC:
1. hair_warrior.png: Lớp tóc dài chiến binh (Z-Index 50)
2. armor_plate.png: Lớp áo giáp ngực thép xanh (Z-Index 40)
3. pants_leather.png: Lớp quần da chiến binh (Z-Index 30)
Kích thước chuẩn: 832 x 3456 px (khớp từng pixel với phôi cơ thể sprites.png)
"""
import os
import sys
from PIL import Image

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    base_lpc_path = r"d:\pixel_draw\apps\studio\public\sprites.png"
    out_dir = r"d:\pixel_draw\apps\studio\public\lpc_assets"
    os.makedirs(out_dir, exist_ok=True)

    if not os.path.exists(base_lpc_path):
        print(f"Lỗi: Không tìm thấy file {base_lpc_path}")
        return

    print("Đang đọc phôi cơ thể LPC...")
    base_img = Image.open(base_lpc_path).convert("RGBA")
    w, h = base_img.size # 832 x 3456
    print(f"Kích thước phôi LPC: {w} x {h}")

    # Tạo 3 canvas trống nền trong suốt
    hair_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    armor_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pants_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    base_data = base_img.load()
    hair_data = hair_img.load()
    armor_data = armor_img.load()
    pants_data = pants_img.load()

    # Dải màu chuẩn nguồn
    # Tóc: Nâu (#2b180d, #4d2a14, #78431e, #a56230, #cf874e)
    c_hair_dark = (77, 42, 20, 255)
    c_hair_mid = (120, 67, 30, 255)
    c_hair_light = (165, 98, 48, 255)

    # Giáp: Thép xanh (#182333, #273b54, #3d5c82, #5881b5, #7eaae6)
    c_armor_dark = (39, 59, 84, 255)
    c_armor_mid = (61, 92, 130, 255)
    c_armor_light = (88, 129, 181, 255)
    c_armor_highlight = (126, 170, 230, 255)
    c_belt = (218, 165, 32, 255) # Khóa thắt lưng vàng

    # Quần: Da nâu (#1d140e, #332318, #523826, #755137, #9c6f4c)
    c_pants_dark = (51, 35, 24, 255)
    c_pants_mid = (82, 56, 38, 255)
    c_pants_light = (117, 81, 55, 255)

    cols = w // 64
    rows = h // 64

    for row in range(rows):
        for col in range(cols):
            x_offset = col * 64
            y_offset = row * 64

            # Quét từng ô 64x64
            for py in range(64):
                for px in range(64):
                    gx = x_offset + px
                    gy = y_offset + py
                    p = base_data[gx, gy]
                    # Nếu pixel có màu da (Alpha > 50)
                    if p[3] > 50:
                        # 1. Vùng tóc (Đầu: py từ 10 đến 26)
                        if 10 <= py <= 26:
                            # Tóc phủ đỉnh đầu và hai bên thái dương
                            if py <= 20 or px <= 24 or px >= 39:
                                if py <= 14:
                                    hair_data[gx, gy] = c_hair_light
                                elif py <= 20:
                                    hair_data[gx, gy] = c_hair_mid
                                else:
                                    hair_data[gx, gy] = c_hair_dark

                        # 2. Vùng áo giáp ngực và thân (py từ 28 đến 42)
                        elif 28 <= py <= 42:
                            if py == 41 or py == 42:
                                # Thắt lưng
                                if 26 <= px <= 37:
                                    armor_data[gx, gy] = c_belt
                                else:
                                    armor_data[gx, gy] = c_armor_dark
                            elif 29 <= py <= 40:
                                if 23 <= px <= 40:
                                    if px in (23, 40) or py == 29:
                                        armor_data[gx, gy] = c_armor_highlight # Viền sáng giáp
                                    elif py <= 34:
                                        armor_data[gx, gy] = c_armor_mid
                                    else:
                                        armor_data[gx, gy] = c_armor_dark

                        # 3. Vùng quần (py từ 43 đến 53)
                        elif 43 <= py <= 53:
                            if 22 <= px <= 42:
                                if py <= 46:
                                    pants_data[gx, gy] = c_pants_mid
                                else:
                                    pants_data[gx, gy] = c_pants_dark

    # Lưu 3 file PNG
    hair_path = os.path.join(out_dir, "hair_warrior.png")
    armor_path = os.path.join(out_dir, "armor_plate.png")
    pants_path = os.path.join(out_dir, "pants_leather.png")

    hair_img.save(hair_path, "PNG")
    print(f"Đã tạo layer tóc: {hair_path}")

    armor_img.save(armor_path, "PNG")
    print(f"Đã tạo layer áo giáp: {armor_path}")

    pants_img.save(pants_path, "PNG")
    print(f"Đã tạo layer quần: {pants_path}")

    print("Hoàn tất tạo kho phụ kiện LPC!")

if __name__ == "__main__":
    main()
