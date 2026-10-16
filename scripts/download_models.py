# /// script
# dependencies = [
#     "huggingface_hub",
#     "tqdm",
#     "requests",
# ]
# ///

"""
Script tu dong tai cac mo hinh AI Checkpoint va LoRA tu Hugging Face ve thu muc models/
Giup nguoi dung moi co the setup toan bo tai nguyen AI chi voi 1 cau lenh.
"""

import os
import sys
import shutil
import argparse
import urllib.request

# Dam bao terminal Windows ho tro UTF-8 khong bi loi charmap
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

MODELS_CONFIG = [
    {
        "name": "AbyssOrangeMix3 (AOM3A1B) Checkpoint",
        "target_path": os.path.join("models", "checkpoints", "AOM3A1B_orangemixs.safetensors"),
        "repo_id": "WarriorMama777/OrangeMixs",
        "filename": "Models/AbyssOrangeMix3/AOM3A1B_orangemixs.safetensors",
        "direct_url": "https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AOM3A1B_orangemixs.safetensors",
        "min_size_bytes": 2_000_000_000, # ~2.13 GB
        "description": "Mo hinh Stable Diffusion 1.5 nang cao cho phong cach pixel / anime",
    },
    {
        "name": "Pixel F2 LoRA",
        "target_path": os.path.join("models", "lora", "pixel_f2.safetensors"),
        "repo_id": "zenafey/pixel_f2",
        "filename": "pixel_f2.safetensors",
        "direct_url": "https://huggingface.co/zenafey/pixel_f2/resolve/main/pixel_f2.safetensors",
        "min_size_bytes": 140_000_000, # ~151 MB
        "description": "LoRA tao hinh Pixel Art RPG, Sprite va Khung canh da dung",
    },
]

def format_size(bytes_val):
    if bytes_val >= 1024 * 1024 * 1024:
        return f"{bytes_val / (1024 * 1024 * 1024):.2f} GB"
    elif bytes_val >= 1024 * 1024:
        return f"{bytes_val / (1024 * 1024):.2f} MB"
    elif bytes_val >= 1024:
        return f"{bytes_val / 1024:.2f} KB"
    return f"{bytes_val} B"

def download_with_urllib(url, target_path):
    print(f"Dang tai truc tiep tu URL: {url}")
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    temp_path = target_path + ".tmp"

    def progress_callback(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100.0, downloaded * 100.0 / total_size)
            downloaded_str = format_size(downloaded)
            total_str = format_size(total_size)
            sys.stdout.write(f"\r  Tien do: [{percent:5.1f}%] {downloaded_str} / {total_str}")
        else:
            sys.stdout.write(f"\r  Da tai: {format_size(downloaded)}")
        sys.stdout.flush()

    try:
        opener = urllib.request.build_opener()
        opener.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]
        urllib.request.install_opener(opener)
        urllib.request.urlretrieve(url, temp_path, reporthook=progress_callback)
        print()
        if os.path.exists(target_path):
            os.remove(target_path)
        shutil.move(temp_path, target_path)
        return True
    except Exception as e:
        print(f"\nLoi khi tai bang urllib: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return False

def download_model(item, force=False):
    target_path = item["target_path"]
    name = item["name"]
    min_size = item["min_size_bytes"]

    print("=" * 70)
    print(f"Kiem tra: {name}")
    print(f"Mo ta:    {item['description']}")
    print(f"Luu tai:  {target_path}")

    # Kiem tra file da ton tai chua
    if os.path.exists(target_path) and not force:
        file_size = os.path.getsize(target_path)
        if file_size >= min_size:
            print(f"[DA TON TAI] Tap tin da co san ({format_size(file_size)}). Bo qua buoc tai.")
            return True
        else:
            print(f"[CANH BAO] Tap tin co kich thuoc nho ({format_size(file_size)} < {format_size(min_size)}). Se tien hanh tai lai.")

    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    # Phuong phap 1: Thu tai bang huggingface_hub neu co san
    download_success = False
    try:
        from huggingface_hub import hf_hub_download
        print(f"Dang tai qua huggingface_hub: repo '{item['repo_id']}', file '{item['filename']}'...")
        downloaded_file = hf_hub_download(
            repo_id=item["repo_id"],
            filename=item["filename"],
            local_dir_use_symlinks=False,
        )
        if os.path.exists(downloaded_file):
            if os.path.abspath(downloaded_file) != os.path.abspath(target_path):
                shutil.copy2(downloaded_file, target_path)
            print(f"Tai thanh cong qua huggingface_hub: {target_path}")
            download_success = True
    except Exception as hf_err:
        print(f"Khong the tai qua huggingface_hub ({hf_err}). Chuyen sang phuong phap truc tiep...")

    # Phuong phap 2: Fallback tai truc tiep bang urllib
    if not download_success:
        download_success = download_with_urllib(item["direct_url"], target_path)

    if download_success and os.path.exists(target_path):
        final_size = os.path.getsize(target_path)
        print(f"[HOAN TAT] {name}: {format_size(final_size)}")
        return True
    else:
        print(f"[THAT BAI] Khong the tai {name}.")
        print(f"Ban co the tai thu cong tai: {item['direct_url']}")
        print(f"Sau do copy vao duong dan: {target_path}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Tu dong tai cac Model AI can thiet cho Pixel Draw")
    parser.add_argument("--force", action="store_true", help="Bat buoc tai lai du file da ton tai")
    parser.add_argument("--lora-only", action="store_true", help="Chi tai cac file LoRA nho (~150MB)")
    parser.add_argument("--checkpoint-only", action="store_true", help="Chi tai file Checkpoint lon (~2GB)")
    args = parser.parse_args()

    # Xac dinh thu muc goc cua du an
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)

    print("=" * 70)
    print("PIXEL DRAW - TRINH TAI MO HINH AI TU DONG (MODEL DOWNLOADER)")
    print("=" * 70)

    selected_models = MODELS_CONFIG
    if args.lora_only:
        selected_models = [m for m in MODELS_CONFIG if "lora" in m["target_path"]]
    elif args.checkpoint_only:
        selected_models = [m for m in MODELS_CONFIG if "checkpoints" in m["target_path"]]

    results = []
    for item in selected_models:
        success = download_model(item, force=args.force)
        results.append((item["name"], success))

    print("=" * 70)
    print("KET QUA TAI MO HINH:")
    all_ok = True
    for name, success in results:
        status_text = "THANH CONG" if success else "THAT BAI"
        print(f"  - {name}: {status_text}")
        if not success:
            all_ok = False

    print("=" * 70)
    if all_ok:
        print("Tat ca cac mo hinh AI da san sang hoat dong trong Pixel Draw.")
    else:
        print("Mot so mo hinh chua tai duoc. Vui long kiem tra lai ket noi mang hoac tai thu cong.")
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
