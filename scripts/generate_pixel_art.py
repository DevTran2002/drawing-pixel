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
from diffusers import StableDiffusionPipeline, StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler

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
    animation_mode=False,
    frame_count=4,
    action="walk",
    init_image=None,
    refine_meta=None,
    strength=0.38,
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

    # Neu o che do sinh hoat anh SpriteSheet, bo sung cac tag dan huong chuyen dong
    if animation_mode:
        action_clean = action.lower().strip()
        tags.insert(1, "(horizontal sprite sheet sequence:1.3)")
        if "walk" in action_clean:
            tags.insert(2, f"({action_clean} in place cycle:1.2)")
        elif "attack" in action_clean or "slash" in action_clean:
            tags.insert(2, "(slashing sword attack with bright slash arc motion trail:1.3)")
        elif "jump" in action_clean:
            tags.insert(2, "(jumping sequence, preparation crouch, airborne pose, landing:1.3)")
        else:
            tags.insert(2, f"({action_clean} animation:1.2)")
        tags.insert(3, f"{frame_count} side by side sub-frames")
        tags.insert(4, "full body centered in each frame")

    # Phan loai va dua tag boi canh len dau ngay sau trigger pixel art
    bg_keywords = ["background", "white background", "simple background", "flat background", "transparent background"]
    bg_tags = [t for t in tags if any(k in t.lower() for k in bg_keywords)]
    other_tags = [t for t in tags if not any(k in t.lower() for k in bg_keywords)]

    # Xep lai: [pixel art triggers, boi canh uu tien nhat, cac tag con lai]
    trigger_tags = [t for t in other_tags if "pixel" in t.lower() or "portrait" in t.lower() or "chibi" in t.lower() or "sprite" in t.lower()]
    detail_tags = [t for t in other_tags if t not in trigger_tags]

    sorted_tags = trigger_tags + bg_tags + detail_tags
    enriched_prompt = ", ".join(sorted_tags)

    # Neu co yeu cau nen don gian hoac animation mode, loai bo cay coi dao bay moc da
    has_simple_bg = any("simple" in t.lower() or "white" in t.lower() or "flat" in t.lower() for t in bg_tags)
    if (has_simple_bg or animation_mode) and "tree" not in negative_prompt.lower():
        negative_prompt = f"{negative_prompt}, tree, trees, floating island, rock, rocks, ground, grass, scenery, nature, outdoors, mountains, clouds, merged frames, cut off body, displaced, blurry, distorted, bad anatomy"

    # Xu ly che do Hybrid AI Refinement: Khau lien vet rach va lam muot chuyen dong khung xuong
    if refine_meta and os.path.exists(refine_meta):
        import json
        with open(refine_meta, "r", encoding="utf-8") as f:
            meta_info = json.load(f)

        frame_files = meta_info.get("frameFiles", [])
        action_name = meta_info.get("action", action)
        total_frames = len(frame_files)

        print(f"AI_STAGE:REFINE_START:Bat dau dung Model AI khau lien va ve bu {total_frames} frames cho hanh dong {action_name}...", flush=True)

        if checkpoint and os.path.exists(checkpoint):
            print(f"AI_STAGE:CHECKPOINT:Nap Checkpoint {os.path.basename(checkpoint)} tren {device.upper()} (Img2Img Refiner)...", flush=True)
            pipe = StableDiffusionImg2ImgPipeline.from_single_file(
                checkpoint,
                torch_dtype=torch_dtype,
                safety_checker=None,
            ).to(device)
        else:
            print(f"AI_STAGE:CHECKPOINT:Khoi tao Stable Diffusion 1.5 Img2Img tren {device.upper()}...", flush=True)
            pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                torch_dtype=torch_dtype,
                safety_checker=None,
            ).to(device)

        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

        if lora_path and os.path.exists(lora_path):
            print(f"AI_STAGE:LORA:Nap trong so LoRA tu {os.path.basename(lora_path)} (do manh {lora_scale})...", flush=True)
            pipe.load_lora_weights(lora_path)

        cross_attention_kwargs = {"scale": lora_scale} if lora_scale is not None else None
        refined_frame_files = []

        if seed is None or seed <= 0:
            seed = int(torch.randint(1, 2147483647, (1,)).item())

        effective_steps = min(steps, 16) if steps else 14

        for idx, f_path in enumerate(frame_files):
            print(f"AI_STAGE:REFINE_FRAME:Dang khau lien va ve bu khung hinh {idx + 1}/{total_frames}...", flush=True)
            if not os.path.exists(f_path):
                print(f"Canh bao: Khong tim thay tep frame {f_path}, bo qua", flush=True)
                continue

            frame_raw = Image.open(f_path)
            if frame_raw.mode != "RGBA":
                frame_raw = frame_raw.convert("RGBA")

            # Dat len nen trang dong nhat de mo hinh nhan dien ro outline
            bg_white = Image.new("RGB", frame_raw.size, (255, 255, 255))
            bg_white.paste(frame_raw, mask=frame_raw.split()[3])

            # Phong to 512x512 bang NEAREST de giu nguyen dac tinh pixel sac net
            init_img_512 = bg_white.resize((512, 512), Image.Resampling.NEAREST)

            # Generator giu dong nhat phong cach giua cac frame
            generator = torch.Generator(device).manual_seed(int(seed + idx))

            res = pipe(
                prompt=enriched_prompt,
                negative_prompt=negative_prompt,
                image=init_img_512,
                strength=strength,
                num_inference_steps=effective_steps,
                guidance_scale=guidance_scale,
                generator=generator,
                cross_attention_kwargs=cross_attention_kwargs,
            )
            refined_raw = res.images[0]

            processed = refined_raw
            if remove_bg:
                processed = remove_background_safe(refined_raw, tolerance=24)

            refined_pixel = processed.resize((target_pixel_size, target_pixel_size), Image.Resampling.NEAREST)
            out_frame_path = f"{output_prefix}_frame_{idx}.png"
            refined_pixel.save(out_frame_path)
            refined_frame_files.append(out_frame_path)
            print(f"AI_FRAME_PROGRESS:{idx + 1}:{total_frames}:{out_frame_path}", flush=True)

        meta_info["frameFiles"] = refined_frame_files
        meta_info["engine"] = "hybrid"
        meta_info["refinedWithAi"] = True
        meta_info["strength"] = strength
        meta_path = f"{output_prefix}_anim_meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_info, f, ensure_ascii=False, indent=2)

        print(f"AI_ANIM_RESULT:{meta_path}", flush=True)
        print(f"AI_STAGE:DONE:Hoan tat ve bu {total_frames} frames hoat anh bang Hybrid AI!", flush=True)
        return refined_frame_files[0] if refined_frame_files else ""

    # Xu ly anh don le Img2Img neu co init_image
    if init_image and os.path.exists(init_image):
        print(f"AI_STAGE:REFINE_SINGLE:Bat dau tinh chinh anh bang Img2Img (do manh {strength})...", flush=True)
        if checkpoint and os.path.exists(checkpoint):
            pipe = StableDiffusionImg2ImgPipeline.from_single_file(
                checkpoint,
                torch_dtype=torch_dtype,
                safety_checker=None,
            ).to(device)
        else:
            pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                torch_dtype=torch_dtype,
                safety_checker=None,
            ).to(device)

        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        if lora_path and os.path.exists(lora_path):
            pipe.load_lora_weights(lora_path)

        cross_attention_kwargs = {"scale": lora_scale} if lora_scale is not None else None
        init_pil = Image.open(init_image)
        if init_pil.mode != "RGBA":
            init_pil = init_pil.convert("RGBA")
        bg_white = Image.new("RGB", init_pil.size, (255, 255, 255))
        bg_white.paste(init_pil, mask=init_pil.split()[3])
        init_img_512 = bg_white.resize((512, 512), Image.Resampling.NEAREST)

        if seed is None or seed <= 0:
            seed = int(torch.randint(1, 2147483647, (1,)).item())
        generator = torch.Generator(device).manual_seed(int(seed))

        res = pipe(
            prompt=enriched_prompt,
            negative_prompt=negative_prompt,
            image=init_img_512,
            strength=strength,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            generator=generator,
            cross_attention_kwargs=cross_attention_kwargs,
        )
        raw_img = res.images[0]

        processed_img = raw_img
        if remove_bg:
            processed_img = remove_background_safe(raw_img, tolerance=24)

        resample_filter = Image.Resampling.NEAREST if resample_method.upper() == "NEAREST" else Image.Resampling.LANCZOS
        pixel_img = processed_img.resize((target_pixel_size, target_pixel_size), resample_filter)
        pixel_out = f"{output_prefix}_pixel_{target_pixel_size}x{target_pixel_size}.png"
        pixel_img.save(pixel_out)
        print(f"AI_STAGE:DONE:Da tao thanh cong anh Pixel Art tu init_image: {pixel_out}", flush=True)
        return pixel_out

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

    if seed is None or seed <= 0:
        seed = int(torch.randint(1, 2147483647, (1,)).item())
    print(f"AI_STAGE:SEED:Seed duoc chon: {seed}", flush=True)
    generator = torch.Generator(device).manual_seed(int(seed))

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

    # Thiet lap kich thuoc: neu o che do animation, sinh dai anh ngang de moi frame la o vuong 256x256
    sub_frame_size = 256
    if animation_mode and frame_count > 1:
        call_kwargs["width"] = sub_frame_size * frame_count
        call_kwargs["height"] = sub_frame_size
        print(f"AI_STAGE:DIMENSIONS:Kich thuoc dai anh ngang: {call_kwargs['width']}x{call_kwargs['height']} ({frame_count} frames {sub_frame_size}x{sub_frame_size})...", flush=True)
    else:
        call_kwargs["width"] = 512
        call_kwargs["height"] = 512

    result = pipe(**call_kwargs)
    raw_img = result.images[0]

    # 1. Luu ban anh goc SpriteSheet
    total_w, total_h = raw_img.size
    raw_out = f"{output_prefix}_raw_{total_w}x{total_h}.png"
    raw_img.save(raw_out)
    print(f"Da luu anh goc: {raw_out}", flush=True)

    # 2. Xu ly neu o che do sinh hoat anh SpriteSheet (Animation Mode)
    if animation_mode and frame_count > 1:
        print(f"AI_STAGE:SLICE:Dang tu dong cat {frame_count} frames chuyen dong tu SpriteSheet...", flush=True)
        total_w, total_h = raw_img.size
        slice_w = total_w // frame_count

        frame_files = []
        import json

        for i in range(frame_count):
            crop_box = (i * slice_w, 0, (i + 1) * slice_w, total_h)
            sub_img = raw_img.crop(crop_box)

            if remove_bg:
                sub_img = remove_background_safe(sub_img, tolerance=22)

            # Thu nho ve target_pixel_size
            sub_pixel = sub_img.resize((target_pixel_size, target_pixel_size), Image.Resampling.NEAREST)
            frame_path = f"{output_prefix}_frame_{i}.png"
            sub_pixel.save(frame_path)
            frame_files.append(frame_path)

        # Ghi file metadata JSON
        meta_data = {
            "frameCount": frame_count,
            "action": action,
            "frameFiles": frame_files,
            "spriteSheetRaw": raw_out
        }
        meta_path = f"{output_prefix}_anim_meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, ensure_ascii=False, indent=2)

        print(f"AI_ANIM_RESULT:{meta_path}", flush=True)
        print(f"AI_STAGE:DONE:Da tao thanh cong {frame_count} frames hoat anh cho hanh dong {action}!", flush=True)
        return frame_files[0]

    # 3. Xu ly anh don le binh thuong
    processed_img = raw_img
    if remove_bg:
        print("AI_STAGE:REMOVE_BG:Dang tach nen an toan (Safe Flood-fill)...", flush=True)
        processed_img = remove_background_safe(raw_img, tolerance=22)
        trans_out = f"{output_prefix}_transparent_512.png"
        processed_img.save(trans_out)
        print(f"Da luu anh 512x512 nen trong suot: {trans_out}", flush=True)

    # Thu nho ve chuan Pixel Art
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
    parser.add_argument("--animation_mode", action="store_true", help="Co bat che do cat frames hoat anh SpriteSheet khong")
    parser.add_argument("--frame_count", type=int, default=4, help="So luong khung hinh trong hoat anh (2, 3, 4, 6, 8)")
    parser.add_argument("--action", default="walk", help="Loai hanh dong (walk, attack, idle, sit, defeated, run, jump)")
    parser.add_argument("--seed", type=int, default=None, help="Khoa seed ngau nhien co dinh de dong nhat nhan vat")
    parser.add_argument("--init_image", default=None, help="Duong dan anh dau vao de tinh chinh Img2Img")
    parser.add_argument("--refine_meta", default=None, help="Duong dan file anim_meta.json de khau lien va ve bu cac frames")
    parser.add_argument("--strength", type=float, default=0.38, help="Do manh khuay dong cua Img2Img (0.20 - 0.60)")
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
        animation_mode=args.animation_mode,
        frame_count=args.frame_count,
        action=args.action,
        seed=args.seed,
        init_image=args.init_image,
        refine_meta=args.refine_meta,
        strength=args.strength,
    )
