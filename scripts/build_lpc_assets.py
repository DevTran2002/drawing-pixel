 # scripts/build_lpc_assets.py
# Kich ban tu dong tai va ghep cac animation PNG tu kho Universal LPC
# thanh cac sprite sheet chuan 832x3456 ve tay tinh xao 100%

import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
import urllib.request
from PIL import Image

BASE_URL = "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "studio", "public", "lpc_assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Toa do Y (pixel) cua tung animation trong sheet chuan 832x3456 (Row * 64)
# Tuan thu nghiem ngat chuan Universal LPC (sources/state/constants.ts)
ANIM_LAYOUT = {
    "spellcast": 0,       # Rows 0-3 (Y: 0..255, 4 huong, 7 frames)
    "thrust": 256,        # Rows 4-7 (Y: 256..511, 4 huong, 8 frames)
    "walk": 512,          # Rows 8-11 (Y: 512..767, 4 huong, 9 frames)
    "slash": 768,         # Rows 12-15 (Y: 768..1023, 4 huong, 6 frames)
    "shoot": 1024,        # Rows 16-19 (Y: 1024..1279, 4 huong, 13 frames)
    "hurt": 1280,         # Row 20 (Y: 1280..1343, 1 hang duy nhat, 6 frames)
    "climb": 1344,        # Row 21 (Y: 1344..1407, 1 hang duy nhat leo thang, 6 frames)
    "idle": 1408,         # Rows 22-25 (Y: 1408..1663, 4 huong, 2 frames)
    "jump": 1664,         # Rows 26-29 (Y: 1664..1919, 4 huong, 5 frames)
    "sit": 1920,          # Rows 30-33 (Y: 1920..2175, 4 huong, 3 frames)
    "emote": 2176,        # Rows 34-37 (Y: 2176..2431, 4 huong, 3 frames)
    "run": 2432,          # Rows 38-41 (Y: 2432..2687, 4 huong, 8 frames)
    "combat_idle": 2688,  # Rows 42-45 (Y: 2688..2943, 4 huong, 2 frames)
    "backslash": 2944,    # Rows 46-49 (Y: 2944..3199, 4 huong, 13 frames)
    "halfslash": 3200,    # Rows 50-53 (Y: 3200..3455, 4 huong, 6 frames)
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
    },
    {
        "name": "hat_barbuta",
        "category": "hat",
        "path": "hat/helmet/barbuta/male",
        "output_files": ["hat_barbuta.png"]
    },
    {
        "name": "armor_chainmail",
        "category": "torso",
        "path": "torso/chainmail/male",
        "output_files": ["armor_chainmail.png"]
    },
    {
        "name": "pants_pantaloons",
        "category": "legs",
        "path": "legs/pantaloons/male",
        "output_files": ["pants_pantaloons.png"]
    },
    {
        "name": "pants_cuffed",
        "category": "legs",
        "path": "legs/cuffed/male",
        "output_files": ["pants_cuffed.png"]
    },
    {
        "name": "boots_plate",
        "category": "feet",
        "path": "feet/armour/plate/male",
        "output_files": ["boots_plate.png"]
    },
    {
        "name": "shoes_brown",
        "category": "feet",
        "path": "feet/shoes/basic/male",
        "output_files": ["shoes_brown.png"]
    }
]

from concurrent.futures import ThreadPoolExecutor

def fetch_animation(args):
    anim, y_offset, path = args
    url = f"{BASE_URL}/{path}/{anim}.png"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            anim_img = Image.open(resp).convert("RGBA")
            return anim, y_offset, anim_img
    except Exception:
        return anim, y_offset, None

def download_and_composite(asset_config):
    name = asset_config["name"]
    path = asset_config["path"]
    print(f"--- Dang dung sheet chuan 832x3456 cho: {name} ---", flush=True)

    sheet = Image.new("RGBA", (832, 3456), (0, 0, 0, 0))
    tasks = [(anim, y_offset, path) for anim, y_offset in ANIM_LAYOUT.items()]

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = executor.map(fetch_animation, tasks)

    found_count = 0
    for anim, y_offset, anim_img in results:
        if anim_img:
            sheet.paste(anim_img, (0, y_offset), anim_img)
            found_count += 1

    print(f"  + Da ghep thanh cong {found_count}/{len(ANIM_LAYOUT)} animations cho {name}", flush=True)

    for out_filename in asset_config["output_files"]:
        out_path = os.path.join(OUTPUT_DIR, out_filename)
        sheet.save(out_path, format="PNG")
        print(f"==> Da luu thanh cong: {out_filename}", flush=True)

def main():
    print("Bat dau tien trinh tai va dong goi Asset chuan Universal LPC (Da luong)...", flush=True)
    for item in ASSETS_TO_BUILD:
        download_and_composite(item)
    print("HOAN TAT! Tat ca cac asset phu kien da duoc nang cap len chuan ve tay tinh xao 54 hang.", flush=True)

if __name__ == "__main__":
    main()

