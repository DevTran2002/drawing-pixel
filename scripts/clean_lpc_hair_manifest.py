# scripts/clean_lpc_hair_manifest.py
# Tinh gọn kho kiểu tóc LPC trong lpc_manifest.json:
# Gom nhóm 1.266 tệp tóc bị nhân bản màu sắc thành 48 kiểu dáng gốc độc nhất.
# Mỗi kiểu dáng gốc sẽ có 1 tệp đại diện chuẩn màu Carrot/Gốc để dải màu Palette Shading
# và Color Mixer tự do hoạt động tối ưu nhất.

import json
import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "..", "apps", "studio", "public", "lpc_assets", "lpc_manifest.json")

# Danh mục tên tiếng Việt chuẩn mực cho 48 kiểu dáng tóc độc nhất
HAIR_NAMES = {
    "afro": "Tóc Xù Tự Nhiên (Afro)",
    "balding": "Tóc Hói Đỉnh Đầu (Balding)",
    "bangs_bun": "Tóc Búi Cài Trâm (Bangs Bun)",
    "bob": "Tóc Ngắn Bob Hiện Đại (Bob)",
    "bob_side_part": "Tóc Bob Rẽ Ngôi (Bob Side Part)",
    "braid": "Tóc Tết Đuôi Sam Dài (Long Braid)",
    "braid2": "Tóc Tết Bím Đôi (Twin Braids)",
    "buzzcut": "Tóc Đầu Đinh (Buzzcut)",
    "cornrows": "Tóc Tết Sát Da Đầu (Cornrows)",
    "cowlick": "Tóc Mái Xoáy Ngang (Cowlick)",
    "cowlick_tall": "Tóc Mái Xoáy Cao (Tall Cowlick)",
    "curly_long": "Tóc Xoăn Dài Lọn Sóng (Long Curly)",
    "curly_short": "Tóc Xoăn Ngắn Gợn (Short Curly)",
    "curtains": "Tóc Bổ Luống Lãng Tử (Curtains)",
    "curtains_long": "Tóc Bổ Luống Dài (Long Curtains)",
    "dreadlocks_long": "Tóc Bện Dài Dreadlocks (Long Dreads)",
    "dreadlocks_short": "Tóc Bện Ngắn Dreadlocks (Short Dreads)",
    "flat_top_fade": "Tóc Vuốt Bằng Fade (Flat Top Fade)",
    "flat_top_straight": "Tóc Vuốt Bằng Thẳng (Flat Top Straight)",
    "half_up": "Tóc Buộc Nửa Nữ Tính (Half Up)",
    "halfmessy": "Tóc Rối Tự Do (Half Messy)",
    "high_and_tight": "Tóc Quân Đội Gọn Gàng (High & Tight)",
    "high_ponytail": "Tóc Đuôi Ngựa Buộc Cao (High Ponytail)",
    "idol": "Tóc Thần Tượng Hàn Quốc (Idol Cut)",
    "lob": "Tóc Ngang Vai Dịu Dàng (Long Bob)",
    "long_band": "Tóc Dài Đeo Băng Đô (Long Band)",
    "long_center_part": "Tóc Dài Rẽ Ngôi Giữa (Long Center Part)",
    "long_messy": "Tóc Dài Đánh Rối (Long Messy)",
    "long_messy2": "Tóc Dài Lượn Sóng Rối (Long Messy Wave)",
    "long_tied": "Tóc Dài Buộc Sau (Long Tied)",
    "messy": "Tóc Xù Lãng Tử (Messy)",
    "messy3": "Tóc Tỉa Lớp Phong Trần (Layered Messy)",
    "mop": "Tóc Nấm Trẻ Trung (Mop Top)",
    "natural": "Tóc Suôn Tự Nhiên (Natural)",
    "part2": "Tóc Rẽ Ngôi Lệch Cổ Điển (Side Part)",
    "pigtails": "Tóc Cột Hai Bên (Pigtails)",
    "pigtails_bangs": "Tóc Mái Cột Hai Bên (Pigtails Bangs)",
    "pixie": "Tóc Tém Pixie Cá Tính (Pixie Cut)",
    "sara": "Tóc Tiểu Thư Sara (Sara Hair)",
    "spiked": "Tóc Chông Gai Chiến Binh (Spiked)",
    "spiked2": "Tóc Dựng Đỉnh Nhọn (Tall Spiked)",
    "spiked_beehive": "Tóc Dựng Tổ Ong (Beehive Spiked)",
    "spiked_liberty": "Tóc Tự Do Gai Nhọn (Liberty Spikes)",
    "spiked_liberty2": "Tóc Gai Nhọn Kép (Double Liberty)",
    "spiked_porcupine": "Tóc Nhím Gai Sắc Sảo (Porcupine)",
    "twists_fade": "Tóc Xoắn Fade Hiện Đại (Twists Fade)",
    "twists_straight": "Tóc Xoắn Thẳng Tự Nhiên (Straight Twists)",
    "warrior": "Tóc Búi Võ Sĩ Samurai (Warrior Bun)"
}

# Các tệp đại diện chuẩn xác nhất (ưu tiên bản vẽ tay gốc hoặc bản dải màu Carrot)
REPRESENTATIVE_FILES = {
    "afro": "hair_afro_carrot.png",
    "balding": "hair_balding_carrot.png",
    "bangs_bun": "hair_bangs_bun_carrot.png",
    "bob": "hair_bob.png",
    "bob_side_part": "hair_bob_side_part_carrot.png",
    "braid": "hair_braid_carrot.png",
    "braid2": "hair_braid2_carrot.png",
    "buzzcut": "hair_buzzcut_carrot.png",
    "cornrows": "hair_cornrows_carrot.png",
    "cowlick": "hair_cowlick_carrot.png",
    "cowlick_tall": "hair_cowlick_tall_carrot.png",
    "curly_long": "hair_curly_long_carrot.png",
    "curly_short": "hair_curly_short_carrot.png",
    "curtains": "hair_curtains.png",
    "curtains_long": "hair_curtains_long_carrot.png",
    "dreadlocks_long": "hair_dreadlocks_long_carrot.png",
    "dreadlocks_short": "hair_dreadlocks_short_carrot.png",
    "flat_top_fade": "hair_flat_top_fade_carrot.png",
    "flat_top_straight": "hair_flat_top_straight_carrot.png",
    "half_up": "hair_half_up_carrot.png",
    "halfmessy": "hair_halfmessy_carrot.png",
    "high_and_tight": "hair_high_and_tight_carrot.png",
    "high_ponytail": "hair_high_ponytail_carrot.png",
    "idol": "hair_idol_carrot.png",
    "lob": "hair_lob_carrot.png",
    "long_band": "hair_long_band_carrot.png",
    "long_center_part": "hair_long_center_part_carrot.png",
    "long_messy": "hair_long_messy_carrot.png",
    "long_messy2": "hair_long_messy2_carrot.png",
    "long_tied": "hair_long_tied_carrot.png",
    "messy": "hair_messy.png",
    "messy3": "hair_messy3_carrot.png",
    "mop": "hair_mop_carrot.png",
    "natural": "hair_natural_carrot.png",
    "part2": "hair_part2_carrot.png",
    "pigtails": "hair_pigtails_carrot.png",
    "pigtails_bangs": "hair_pigtails_bangs_carrot.png",
    "pixie": "hair_pixie.png",
    "sara": "hair_sara_carrot.png",
    "spiked": "hair_spiked.png",
    "spiked2": "hair_spiked2_carrot.png",
    "spiked_beehive": "hair_spiked_beehive_carrot.png",
    "spiked_liberty": "hair_spiked_liberty_carrot.png",
    "spiked_liberty2": "hair_spiked_liberty2_carrot.png",
    "spiked_porcupine": "hair_spiked_porcupine_carrot.png",
    "twists_fade": "hair_twists_fade_carrot.png",
    "twists_straight": "hair_twists_straight_carrot.png",
    "warrior": "hair_warrior.png"
}

def main():
    if not os.path.exists(MANIFEST_PATH):
        print(f"Khong tim thay tep manifest tai {MANIFEST_PATH}")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    old_hair_count = len(manifest.get("hair", []))
    print(f"So luong toc ban dau trong manifest: {old_hair_count}")

    # Xây dựng danh sách 48 kiểu tóc độc nhất
    unique_hairs = []
    for key in sorted(REPRESENTATIVE_FILES.keys()):
        fname = REPRESENTATIVE_FILES[key]
        clean_name = HAIR_NAMES.get(key, key.replace("_", " ").title())
        unique_hairs.append({
            "id": f"hair_{key}",
            "name": clean_name,
            "imageUrl": f"/lpc_assets/{fname}"
        })

    manifest["hair"] = unique_hairs
    print(f"So luong toc sau khi tinh gon: {len(unique_hairs)} kieu dang doc nhat.")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"Da ghi de thanh cong vao {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
