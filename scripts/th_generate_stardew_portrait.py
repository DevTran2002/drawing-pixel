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

# Ham tach nen bang thuat toan lan truyen (Flood Fill) tu cac canh vien, loai bo triet de vien tim
def th_remove_background_floodfill(image, tolerance=85):
    img = image.convert("RGBA")
    arr = np.array(img)
    h, w, _ = arr.shape

    # Tinh mau nen chu dao tu 4 goc cua anh
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

    # Dua toan bo cac diem anh tren 4 duong vien vao hang doi
    for y in range(h):
        for x in [0, w - 1]:
            queue.append((y, x))
            visited[y, x] = True
            bg_mask[y, x] = True

    for x in range(w):
        for y in [0, h - 1]:
            if not visited[y, x]:
                queue.append((y, x))
                visited[y, x] = True
                bg_mask[y, x] = True

    # Lan truyen theo 4 huong: tiep tuc an vao nen tim cho toi khi cham vien den cua nhan vat
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in directions:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                pixel = arr[ny, nx, :3].astype(float)
                
                # Nhan dien vien tim lech mau
                is_purple = (pixel[2] > pixel[1] + 18) and (pixel[0] > pixel[1] + 15)
                diff = np.linalg.norm(pixel - bg_color)
                # Duong vien ngoai toi mau cua nhan vat (outline)
                is_dark_outline = (pixel[0] < 50 and pixel[1] < 30 and pixel[2] < 30)

                if (diff <= tolerance or is_purple) and not is_dark_outline:
                    bg_mask[ny, nx] = True
                    queue.append((ny, nx))

    # Bien toan bo pixel thuoc nen thanh trong suot (Alpha = 0)
    arr[bg_mask, 3] = 0
    return Image.fromarray(arr, "RGBA")

# Ham sinh anh chan dung Stardew Valley
def th_generate_portrait(
    lora_path="models/lora/th_stardew_portrait_lora.safetensors",
    prompt="pixel art, stardew portrait, 1boy, brown hair, white shirt, smiling, looking at viewer, simple white background",
    negative_prompt="blurry, photorealistic, 3d, realistic, smooth, detailed background, scenery, complex background",
    output_prefix="storage/outputs/th_stardew_character",
    steps=25,
    guidance_scale=7.5,
    seed=None,
    target_pixel_size=64,
):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "cuda" else torch.float32

    # Tu dong khoi tao thu muc dau ra neu chua ton tai
    out_dir = os.path.dirname(output_prefix)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    print(f"Khoi tao Stable Diffusion 1.5 tren {device.upper()}...")
    pipe = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        torch_dtype=torch_dtype,
        safety_checker=None,
    ).to(device)

    # Su dung DPMSolver de sinh anh sieu nhanh
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

    print(f"Nap trong so LoRA tu {lora_path}...")
    pipe.load_lora_weights(lora_path)

    generator = None
    if seed is not None:
        generator = torch.Generator(device).manual_seed(seed)

    print(f"Dang sinh anh voi prompt: '{prompt}'...")
    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )
    raw_img = result.images[0]

    # 1. Luu ban anh goc 512x512
    raw_out = f"{output_prefix}_raw_512.png"
    raw_img.save(raw_out)
    print(f"Da luu anh goc: {raw_out}")

    # 2. Xu ly nen trong suot bang Flood Fill
    print("Dang tach nen trong suot bang thuat toan Flood Fill...")
    transparent_img = th_remove_background_floodfill(raw_img, tolerance=35)
    trans_out = f"{output_prefix}_transparent_512.png"
    transparent_img.save(trans_out)
    print(f"Da luu anh 512x512 nen trong suot: {trans_out}")

    # 3. Thu nho ve chuan Pixel Art 64x64 voi thuat toan Nearest Neighbor de giu nguyen khoi pixel
    pixel_img = transparent_img.resize(
        (target_pixel_size, target_pixel_size),
        Image.Resampling.NEAREST,
    )
    pixel_out = f"{output_prefix}_pixel_{target_pixel_size}x{target_pixel_size}.png"
    pixel_img.save(pixel_out)
    print(f"Da tao thanh cong anh Pixel Art chuan {target_pixel_size}x{target_pixel_size} nen trong suot: {pixel_out}")

    # Ho tro tuong thich nguoc cho ca duong dan thu muc goc (d:\pixel_draw)
    root_pixel_file = f"th_stardew_character_pixel_{target_pixel_size}x{target_pixel_size}.png"
    if os.path.abspath(pixel_out) != os.path.abspath(root_pixel_file):
        try:
            import shutil
            shutil.copyfile(pixel_out, root_pixel_file)
        except Exception:
            pass

    return pixel_out

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sinh anh chan dung Stardew Valley bang LoRA")
    parser.add_argument("--lora", default="models/lora/th_stardew_portrait_lora.safetensors", help="Duong dan tep LoRA")
    parser.add_argument("--prompt", default="pixel art, stardew portrait, 1boy, brown hair, white shirt, smiling, looking at viewer, simple white background", help="Mo ta nhan vat")
    parser.add_argument("--steps", type=int, default=20, help="So buoc lay mau (15-25 buoc)")
    parser.add_argument("--size", type=int, default=64, help="Kich thuoc pixel art xuat ra")
    parser.add_argument("--output_prefix", default="storage/outputs/th_stardew_character", help="Tien to duong dan tep anh dau ra")
    args = parser.parse_args()

    th_generate_portrait(
        lora_path=args.lora,
        prompt=args.prompt,
        steps=args.steps,
        target_pixel_size=args.size,
        output_prefix=args.output_prefix,
    )
