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
import time
import inspect
import argparse
from collections import deque
import numpy as np
from PIL import Image
import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

# Ham tach nen an toan: chi loai bo mau nen phia ngoai, khong xam pham vao co the nhan vat
def remove_background_safe(image, tolerance=22):
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

# Ham sinh anh Pixel Art da nang chat luong cao
def generate_pixel_art(
    lora_path="models/lora/pixel_portrait_lora.safetensors",
    checkpoint="models/checkpoints/AOM3A1B_orangemixs.safetensors",
    prompt="pixel art, character portrait, 1boy, brown hair, white shirt, smiling, looking at viewer",
    negative_prompt="blurry, photorealistic, 3d, realistic, smooth, noisy, distorted, disfigured, malformed, bad anatomy, artifacts, floating particles",
    output_prefix="storage/outputs/pixel_character",
    steps=22,
    guidance_scale=7.5,
    lora_scale=0.55,
    seed=None,
    target_pixel_size=64,
    resample_method="NEAREST",
    remove_bg=False,
):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "cuda" else torch.float32

    # Tu dong khoi tao thu muc dau ra neu chua ton tai
    out_dir = os.path.dirname(output_prefix)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Chuan hoa va uu tien dua boi canh len dau cau prompt
    tags = [t.strip() for t in prompt.split(",") if t.strip()]
    if not any("pixel" in t.lower() for t in tags):
        tags.insert(0, "pixel art")

    # Phan loai va dua tag boi canh len dau ngay sau trigger pixel art
    bg_keywords = ["background", "white background", "simple background", "flat background", "transparent background"]
    bg_tags = [t for t in tags if any(k in t.lower() for k in bg_keywords)]
    other_tags = [t for t in tags if not any(k in t.lower() for k in bg_keywords)]

    # Xep lai: [pixel art triggers, boi canh uu tien nhat, cac tag con lai]
    trigger_tags = [t for t in other_tags if "pixel" in t.lower() or "portrait" in t.lower() or "chibi" in t.lower()]
    detail_tags = [t for t in other_tags if t not in trigger_tags]

    sorted_tags = trigger_tags + bg_tags + detail_tags
    enriched_prompt = ", ".join(sorted_tags)

    # Neu co yeu cau nen don gian, bo sung tu khoa loai tru cay coi, dao bay, moc da vao negative prompt
    has_simple_bg = any("simple" in t.lower() or "white" in t.lower() or "flat" in t.lower() for t in bg_tags)
    if has_simple_bg and "tree" not in negative_prompt.lower():
        negative_prompt = f"{negative_prompt}, tree, trees, floating island, rock, rocks, ground, grass, scenery, nature, outdoors, mountains, clouds"

    # Uu tien su dung Checkpoint cuc bo neu ton tai
    if checkpoint and os.path.exists(checkpoint):
        print(f"AI_STAGE:CHECKPOINT:Nap Checkpoint {os.path.basename(checkpoint)} tren {device.upper()}...", flush=True)
        pipe = StableDiffusionPipeline.from_single_file(
            checkpoint,
            torch_dtype=torch_dtype,
            safety_checker=None,
        ).to(device)
    else:
        print(f"AI_STAGE:CHECKPOINT:Khoi tao Stable Diffusion 1.5 tren {device.upper()} tu Runway...", flush=True)
        pipe = StableDiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch_dtype,
            safety_checker=None,
        ).to(device)

    # Su dung DPMSolver de sinh anh nhanh va chat luong cao
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

    print(f"AI_STAGE:LORA:Nap trong so LoRA tu {os.path.basename(lora_path)} (do manh {lora_scale})...", flush=True)
    pipe.load_lora_weights(lora_path)

    generator = None
    if seed is not None:
        generator = torch.Generator(device).manual_seed(seed)

    print(f"AI_STAGE:DENOISE_START:Bat dau sinh anh ({steps} steps)...", flush=True)
    start_denoise_time = time.time()

    def step_callback(pipe_ref, step_index, timestep, callback_kwargs):
        curr_step = step_index + 1
        elapsed = time.time() - start_denoise_time
        pct = int(round((curr_step / steps) * 100))
        sec_per_step = elapsed / curr_step if curr_step > 0 else 0
        eta = sec_per_step * (steps - curr_step)
        print(f"AI_STEP:{curr_step}:{steps}:{pct}:{elapsed:.1f}:{eta:.1f}", flush=True)
        return callback_kwargs

    cross_attention_kwargs = {"scale": lora_scale} if lora_scale is not None else None
    call_kwargs = {
        "prompt": enriched_prompt,
        "negative_prompt": negative_prompt,
        "num_inference_steps": steps,
        "guidance_scale": guidance_scale,
        "generator": generator,
        "cross_attention_kwargs": cross_attention_kwargs,
    }

    sig_params = inspect.signature(pipe.__call__).parameters
    if "callback_on_step_end" in sig_params:
        call_kwargs["callback_on_step_end"] = step_callback
    elif "callback" in sig_params:
        def legacy_cb(s, t, latents):
            curr_step = s + 1
            elapsed = time.time() - start_denoise_time
            pct = int(round((curr_step / steps) * 100))
            sec_per_step = elapsed / curr_step if curr_step > 0 else 0
            eta = sec_per_step * (steps - curr_step)
            print(f"AI_STEP:{curr_step}:{steps}:{pct}:{elapsed:.1f}:{eta:.1f}", flush=True)
        call_kwargs["callback"] = legacy_cb
        call_kwargs["callback_steps"] = 1

    result = pipe(**call_kwargs)
    raw_img = result.images[0]

    # 1. Luu ban anh goc 512x512
    raw_out = f"{output_prefix}_raw_512.png"
    raw_img.save(raw_out)
    print(f"Da luu anh goc 512x512: {raw_out}", flush=True)

    # 2. Xu ly tach nen neu duoc yeu cau
    processed_img = raw_img
    if remove_bg:
        print("AI_STAGE:REMOVE_BG:Dang tach nen an toan (Safe Flood-fill)...", flush=True)
        processed_img = remove_background_safe(raw_img, tolerance=22)
        trans_out = f"{output_prefix}_transparent_512.png"
        processed_img.save(trans_out)
        print(f"Da luu anh 512x512 nen trong suot: {trans_out}", flush=True)

    # 3. Thu nho ve chuan Pixel Art theo phuong phap chon lua (NEAREST giu net sac, LANCZOS lam muot)
    resample_filter = Image.Resampling.NEAREST if resample_method.upper() == "NEAREST" else Image.Resampling.LANCZOS
    print(f"AI_STAGE:DOWNSCALE:Thu nho ve {target_pixel_size}x{target_pixel_size} voi {resample_method.upper()} downsampling...", flush=True)
    pixel_img = processed_img.resize(
        (target_pixel_size, target_pixel_size),
        resample_filter,
    )

    pixel_out = f"{output_prefix}_pixel_{target_pixel_size}x{target_pixel_size}.png"
    pixel_img.save(pixel_out)
    print(f"AI_STAGE:DONE:Da tao thanh cong anh Pixel Art: {pixel_out}", flush=True)

    return pixel_out

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sinh anh Pixel Art da nang bang LoRA va Checkpoint")
    parser.add_argument("--lora", default="models/lora/pixel_portrait_lora.safetensors", help="Duong dan tep LoRA")
    parser.add_argument("--checkpoint", default="models/checkpoints/AOM3A1B_orangemixs.safetensors", help="Duong dan tep Checkpoint base")
    parser.add_argument("--prompt", default="pixel art, character portrait, 1boy, brown hair, white shirt, smiling, looking at viewer", help="Mo ta buc tranh")
    parser.add_argument("--negative_prompt", default="blurry, photorealistic, 3d, realistic, smooth, noisy, distorted, disfigured, malformed, bad anatomy, artifacts, floating particles", help="Tu khoa loai tru")
    parser.add_argument("--lora_scale", type=float, default=0.55, help="Do manh cua LoRA (0.5 - 0.7 la toi uu)")
    parser.add_argument("--steps", type=int, default=18, help="So buoc lay mau (15-22 buoc)")
    parser.add_argument("--size", type=int, default=64, help="Kich thuoc pixel art xuat ra")
    parser.add_argument("--resample", default="NEAREST", choices=["NEAREST", "LANCZOS"], help="Thuat toan thu nho anh")
    parser.add_argument("--output_prefix", default="storage/outputs/pixel_character", help="Tien to duong dan tep anh dau ra")
    parser.add_argument("--remove_bg", action="store_true", help="Co tach nen trong suot hay khong")
    args = parser.parse_args()

    generate_pixel_art(
        lora_path=args.lora,
        checkpoint=args.checkpoint,
        prompt=args.prompt,
        negative_prompt=args.negative_prompt,
        lora_scale=args.lora_scale,
        steps=args.steps,
        target_pixel_size=args.size,
        resample_method=args.resample,
        output_prefix=args.output_prefix,
        remove_bg=args.remove_bg,
    )
