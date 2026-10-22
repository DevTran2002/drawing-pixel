 # scripts/build_lpc_assets.py
# Kich ban tu dong tai va ghep cac animation PNG tu kho Universal LPC
# thanh cac sprite sheet chuan 832x3456 ve tay tinh xao 100%

import os
import urllib.request
from PIL import Image

BASE_URL = "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "studio", "public", "lpc_assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Toa do Y (pixel) cua tung animation trong sheet chuan 832x3456 (Row * 64)
ANIM_LAYOUT = {
    "spellcast": 0,      # Rows 0-3 (Y: 0..255)
    "thrust": 256,       # Rows 4-7 (Y: 256..511)
    "walk": 512,         # Rows 8-11 (Y: 512..767)
    "slash": 768,        # Rows 12-15 (Y: 768..1023)
    "shoot": 1024,       # Rows 16-19 (Y: 1024..1279)
    "hurt": 1280,        # Row 20 (Y: 1280..1343)
    "climb": 1344,       # Rows 21-24 (Y: 1344..1599)
    "sit": 1600,         # Rows 25-28 (Y: 1600..1855)
    "run": 2368,         # Rows 37-40 (Y: 2368..2623)
    "jump": 2624,        # Rows 41-44 (Y: 2624..2879)
}

ASSETS_TO_BUILD = [
    {
        "name": "hair_messy",
        "category": "hair",
        "path": "hair/messy1/adult",
        "output_files": ["hair_messy.png", "hair_warrior.png"]  # Ghi de luon hair_warrior cu
    },
    {
        "name": "hair_spiked",
        "category": "hair",
        "path": "hair/spiked/adult",
        "output_files": ["hair_spiked.png"]
    },
    {
        "name": "hair_curtains",
        "category": "hair",
        "path": "hair/curtains/adult",
        "output_files": ["hair_curtains.png"]
    },
    {
        "name": "hair_bob",
        "category": "hair",
        "path": "hair/bob/adult",
        "output_files": ["hair_bob.png"]
    },
    {
        "name": "hair_pixie",
        "category": "hair",
        "path": "hair/pixie/adult",
        "output_files": ["hair_pixie.png"]
    },
    {
        "name": "armor_plate",
        "category": "torso",
        "path": "torso/armour/plate/male",
        "output_files": ["armor_plate.png"]
    },
    {
        "name": "armor_leather",
        "category": "torso",
        "path": "torso/armour/leather/male",
        "output_files": ["armor_leather.png"]
    },
    {
        "name": "armor_legion",
        "category": "torso",
        "path": "torso/armour/legion/male",
        "output_files": ["armor_legion.png"]
    },
    {
        "name": "pants_leather",
        "category": "legs",
        "path": "legs/pants/male",
        "output_files": ["pants_leather.png"]
    },
    {
        "name": "boots_basic",
        "category": "feet",
        "path": "feet/boots/basic/male",
        "output_files": ["boots_leather.png"]
    },
    {
        "name": "boots_fold",
        "category": "feet",
        "path": "feet/boots/fold/male",
        "output_files": ["boots_fold.png"]
    },
    {
        "name": "helmet_greathelm",
        "category": "hat",
        "path": "hat/helmet/greathelm/male",
        "output_files": ["hat_helmet.png"]
    }
]

def download_and_composite(asset_config):
    name = asset_config["name"]
    path = asset_config["path"]
    print(f"--- Dang dung sheet chuan 832x3456 cho: {name} ---")

    sheet = Image.new("RGBA", (832, 3456), (0, 0, 0, 0))
    headers = {"User-Agent": "Mozilla/5.0"}

    for anim, y_offset in ANIM_LAYOUT.items():
        url = f"{BASE_URL}/{path}/{anim}.png"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                anim_img = Image.open(resp).convert("RGBA")
                # Dan vao sheet tai toa do (0, y_offset)
                sheet.paste(anim_img, (0, y_offset), anim_img)
                print(f"  + Da ghep animation '{anim}' (Y={y_offset}, Size={anim_img.size})")
        except Exception as e:
            # Bo qua neu animation nay khong co trong phu kien (vi du hurt hoac sit o mot so asset)
            print(f"  - Khong tim thay '{anim}' ({e}), bo qua.")

    for out_filename in asset_config["output_files"]:
        out_path = os.path.join(OUTPUT_DIR, out_filename)
        sheet.save(out_path, format="PNG")
        print(f"==> Da luu thanh cong: {out_path}")

def main():
    print("Bat dau tien trinh tai va dong goi Asset chuan Universal LPC...")
    for item in ASSETS_TO_BUILD:
        download_and_composite(item)
    print("HOAN TAT! Tat ca cac asset phu kien da duoc nang cap len chuan ve tay tinh xao.")

if __name__ == "__main__":
    main()
