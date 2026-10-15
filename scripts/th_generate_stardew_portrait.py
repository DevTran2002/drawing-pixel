# /// script
# dependencies = [
#     "torch",
#     "diffusers",
#     "transformers",
#     "accelerate",
#     "safetensors",
#     "pillow",
#     "numpy",
#     "peft",
# ]
# ///

import os
import argparse
from collections import deque
import numpy as np
from PIL import Image
import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

# Ham tach nen an toan: chi loai bo mau nen phia ngoai, khong xam pham vao co the nhan vat
def th_remove_background_safe(image, tolerance=22):
    img = image.convert("RGBA")
    arr = np.array(img)
    h, w, _ = arr.shape

    # Lay mau nen tai 4 goc ngoai cung
    corner_colors = [
        arr[0, 0, :3].astype(float),
        arr[0, w - 1, :3].astype(float),
        arr[h - 1, 0, :3].astype(float),
        arr[h - 1, w - 1, :3].astype(float),
    ]
    bg_color = np.median(corner_colors, axis=0)

    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    queue = deque()

    # Dua cac diem anh vien ngoai cung co mau giong nen vao hang doi
    for y in range(h):
        for x in [0, w - 1]:
            if np.linalg.norm(arr[y, x, :3].astype(float) - bg_color) <= tolerance:
                queue.append((y, x))
                visited[y, x] = True
                bg_mask[y, x] = True

    for x in range(w):
        for y in [0, h - 1]:
            if not visited[y, x] and np.linalg.norm(arr[y, x, :3].astype(float) - bg_color) <= tolerance:
                queue.append((y, x))
                visited[y, x] = True
                bg_mask[y, x] = True

    # Lan truyen can than: dung ngay khi cham outline toi mau hoac mau lech khoi mau nen
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in directions:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                pixel = arr[ny, nx, :3].astype(float)
                diff = np.linalg.norm(pixel - bg_color)
                is_dark_outline = (pixel[0] < 55 and pixel[1] < 45 and pixel[2] < 45)

                if diff <= tolerance and not is_dark_outline:
                    bg_mask[ny, nx] = True
                    queue.append((ny, nx))

    arr[bg_mask, 3] = 0
    return Image.fromarray(arr, "RGBA")

# Ham sinh anh chan dung Stardew Valley chuan chat luong cao
def th_generate_portrait(
    lora_path="models/lora/th_stardew_portrait_lora.safetensors",
    prompt="stardew valley style, pixel art portrait, 1boy, brown hair, white shirt, smiling, looking at viewer",
    negative_prompt="blurry, photorealistic, 3d, realistic, smooth, noisy, distorted, disfigured, malformed, bad anatomy, artifacts, floating particles",
    output_prefix="storage/outputs/th_stardew_character",
    steps=22,
    guidance_scale=7.5,
    seed=None,
    target_pixel_size=64,
    remove_bg=False,
):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "cuda" else torch.float32

    # Tu dong khoi tao thu muc dau ra neu chua ton tai
    out_dir = os.path.dirname(output_prefix)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Bo sung trigger keywords chuan cua LoRA Stardew Valley neu chua co
    enriched_prompt = prompt
    if "stardew" not in prompt.lower():
        enriched_prompt = f"stardew valley style, pixel art portrait, {prompt}"
    if "clean cluster shading" not in prompt.lower():
        enriched_prompt = f"{enriched_prompt}, clean cluster shading, organic outline"

    print(f"Khoi tao Stable Diffusion 1.5 tren {device.upper()}...")
    pipe = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch_dtype,
        safety_checker=None,
    ).to(device)

    # Su dung DPMSolver de sinh anh nhanh va chat luong cao
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

    print(f"Nap trong so LoRA tu {lora_path}...")
    pipe.load_lora_weights(lora_path)

    generator = None
    if seed is not None:
        generator = torch.Generator(device).manual_seed(seed)

    print(f"Dang sinh anh voi prompt: '{enriched_prompt}' ({steps} steps)...")
    result = pipe(
        prompt=enriched_prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )
    raw_img = result.images[0]

    # 1. Luu ban anh goc 512x512
    raw_out = f"{output_prefix}_raw_512.png"
    raw_img.save(raw_out)
    print(f"Da luu anh goc 512x512: {raw_out}")

    # 2. Xu ly tach nen neu duoc yeu cau
    processed_img = raw_img
    if remove_bg:
        print("Dang tach nen an toan (Safe Flood-fill)...")
        processed_img = th_remove_background_safe(raw_img, tolerance=22)
        trans_out = f"{output_prefix}_transparent_512.png"
        processed_img.save(trans_out)
        print(f"Da luu anh 512x512 nen trong suot: {trans_out}")

    # 3. Thu nho ve chuan Pixel Art 64x64 bang thuat toan LANCZOS de giu nguyen ven net mat va co the
    print(f"Thu nho ve {target_pixel_size}x{target_pixel_size} voi Lanczos downsampling chat luong cao...")
    pixel_img = processed_img.resize(
        (target_pixel_size, target_pixel_size),
        Image.Resampling.LANCZOS,
    )

    pixel_out = f"{output_prefix}_pixel_{target_pixel_size}x{target_pixel_size}.png"
    pixel_img.save(pixel_out)
    print(f"Da tao thanh cong anh Pixel Art chuan {target_pixel_size}x{target_pixel_size}: {pixel_out}")

    return pixel_out

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sinh anh chan dung Stardew Valley bang LoRA")
    parser.add_argument("--lora", default="models/lora/th_stardew_portrait_lora.safetensors", help="Duong dan tep LoRA")
    parser.add_argument("--prompt", default="stardew valley style, pixel art portrait, 1boy, brown hair, white shirt, smiling, looking at viewer", help="Mo ta nhan vat")
    parser.add_argument("--steps", type=int, default=22, help="So buoc lay mau (20-25 buoc)")
    parser.add_argument("--size", type=int, default=64, help="Kich thuoc pixel art xuat ra")
    parser.add_argument("--output_prefix", default="storage/outputs/th_stardew_character", help="Tien to duong dan tep anh dau ra")
    parser.add_argument("--remove_bg", action="store_true", help="Co tach nen trong suot hay khong")
    args = parser.parse_args()

    th_generate_portrait(
        lora_path=args.lora,
        prompt=args.prompt,
        steps=args.steps,
        target_pixel_size=args.size,
        output_prefix=args.output_prefix,
        remove_bg=args.remove_bg,
    )
