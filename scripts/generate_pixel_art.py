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
import sys
import time
import inspect
import argparse
from collections import deque
import numpy as np
from PIL import Image
import torch
from diffusers import StableDiffusionPipeline, StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler

# Đảm bảo mã hóa UTF-8 cho luồng xuất chuẩn trên hệ điều hành Windows tránh lỗi UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import warnings
warnings.filterwarnings('ignore')
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

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

# Hàm khử hoa văn nền caro giả lập độ trong suốt từ các phôi spritesheet
def remove_checkerboard_artifacts(pil_img):
    img = pil_img.convert("RGBA")
    arr = np.array(img)
    # Kiểm tra màu caro xám (153, 153, 153) và (204, 204, 204)
    is_c1 = (np.abs(arr[:, :, 0].astype(int) - 153) <= 4) & (np.abs(arr[:, :, 1].astype(int) - 153) <= 4) & (np.abs(arr[:, :, 2].astype(int) - 153) <= 4)
    is_c2 = (np.abs(arr[:, :, 0].astype(int) - 204) <= 4) & (np.abs(arr[:, :, 1].astype(int) - 204) <= 4) & (np.abs(arr[:, :, 2].astype(int) - 204) <= 4)
    checker_mask = is_c1 | is_c2
    if np.sum(checker_mask) > 100:
        arr[checker_mask, 3] = 0
        arr[checker_mask, :3] = 0
        return Image.fromarray(arr, "RGBA")
    return img

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

    # Chuẩn hóa tags và ưu tiên tuyệt đối nội dung mô tả nhân vật của người dùng
    user_tags = [t.strip() for t in prompt.split(",") if t.strip()]

    # Tự động phát hiện và ưu tiên LoRA 2D Pixel Toolkit chuyên dụng
    toolkit_lora = "models/lora/2d_pixel_sprites_64.safetensors"
    if animation_mode and os.path.exists(toolkit_lora):
        if not lora_path or "portrait" in lora_path:
            lora_path = toolkit_lora
            lora_scale = 0.85

    # Xây dựng prompt tinh gọn dưới 60 tokens để không bị CLIP cắt cụt mô tả của người dùng
    core_triggers = ["pixel art", "16-bit sprite", "masterpiece"]
    if animation_mode:
        core_triggers.append("character sprite sheet")

    # Giữ nguyên mô tả người dùng ngay sau trigger chính
    combined_tags = core_triggers + user_tags + ["clean outline", "crisp details", "clear legs and feet", "solid white background"]
    
    # Loại bỏ các tag trùng lặp
    seen = set()
    final_tags = []
    for t in combined_tags:
        t_clean = t.strip()
        t_lower = t_clean.lower()
        if t_lower and t_lower not in seen:
            seen.add(t_lower)
            final_tags.append(t_clean)

    enriched_prompt = ", ".join(final_tags)

    # Bổ sung các từ khóa âm tính chặn dính chân, biến dạng chân và nhòe chi tiết
    negative_prompt = f"{negative_prompt}, fused legs, merged legs, deformed feet, missing feet, bad anatomy, blurry, smooth, noisy, 3d, photorealistic, realistic, clutter, messy background, distorted limbs"

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

    # Xu ly Img2Img neu co init_image (ca anh don le lan chuoi SpriteSheet tham chieu)
    if init_image and os.path.exists(init_image):
        print(f"AI_STAGE:REFINE_SINGLE:Bat dau tao anh Img2Img (do manh {strength})...", flush=True)
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
        
        is_grid_mode = False
        grid_cols = 1
        grid_rows = 1
        cell_size = 512

        if animation_mode and frame_count > 1:
            import math
            char_pil = Image.open(init_image)
            if char_pil.mode != "RGBA":
                char_pil = char_pil.convert("RGBA")
            # Tự động loại bỏ bất kỳ tàn dư nền caro giả lập trong suốt
            char_pil = remove_checkerboard_artifacts(char_pil)

            # Tự động tính số cột và số dòng để phân bổ đều các khung hình vào Lưới vuông (Grid Layout)
            grid_cols = math.ceil(math.sqrt(frame_count))
            grid_rows = math.ceil(frame_count / grid_cols)
            is_grid_mode = True

            # Chuẩn hóa kích thước lưới vuông cố định 512x512 (bội số 64) chuẩn cho Stable Diffusion 1.5
            grid_w = 512
            grid_h = 512
            grid_canvas = Image.new("RGB", (grid_w, grid_h), (255, 255, 255))
            cell_w = grid_w / grid_cols
            cell_h = grid_h / grid_rows

            # Trường hợp 1: Ảnh đầu vào là dải strip chứa N tư thế chuyển động LPC
            if char_pil.width >= char_pil.height * 1.5:
                print(f"AI_STAGE:REFINE_ANIM:Bắt đầu sinh nhân vật chuẩn 512x512 trên từng khung hình LPC ({frame_count} frames) với Fixed Seed...", flush=True)
                orig_fw = char_pil.width // frame_count
                orig_fh = char_pil.height
                frame_files = []

                if seed is None or seed <= 0:
                    seed = int(torch.randint(1, 2147483647, (1,)).item())

                # Số bước tối ưu cho DPMSolver: 12 bước, tốc độ cao và độ sắc nét tối đa
                effective_steps = min(steps, 14) if steps else 12
                # Giữ độ mạnh 0.35 để bảo toàn 100% dáng bước chân, tay, đầu của phôi LPC
                actual_strength = strength if (strength is not None and strength <= 0.45) else 0.35

                for i in range(frame_count):
                    print(f"AI_STAGE:REFINE_FRAME:Đang sinh hoạt cảnh khung hình {i + 1}/{frame_count}...", flush=True)
                    f_crop = char_pil.crop((i * orig_fw, 0, (i + 1) * orig_fw, orig_fh))
                    bg_white = Image.new("RGB", (orig_fw, orig_fh), (255, 255, 255))
                    bg_white.paste(f_crop, mask=f_crop.split()[3])

                    # Phóng to khung hình lên 512x512 bằng NEAREST để tận dụng tối đa độ phân giải mô hình
                    init_512 = bg_white.resize((512, 512), Image.Resampling.NEAREST)

                    # DÙNG CÙNG 1 SEED CỐ ĐỊNH CHO TẤT CẢ KHUNG HÌNH ĐỂ ĐỒNG BỘ 100% DIỆN MẠO
                    generator = torch.Generator(device).manual_seed(int(seed))

                    res = pipe(
                        prompt=enriched_prompt,
                        negative_prompt=negative_prompt,
                        image=init_512,
                        strength=actual_strength,
                        num_inference_steps=effective_steps,
                        guidance_scale=guidance_scale,
                        generator=generator,
                        cross_attention_kwargs=cross_attention_kwargs,
                    )
                    raw_sub = res.images[0]

                    # Tách nền an toàn
                    processed_sub = raw_sub
                    if remove_bg:
                        processed_sub = remove_background_safe(raw_sub, tolerance=24)

                    sub_pixel = processed_sub.resize((target_pixel_size, target_pixel_size), Image.Resampling.NEAREST)
                    frame_path = f"{output_prefix}_frame_{i}.png"
                    sub_pixel.save(frame_path)
                    frame_files.append(frame_path)
                    print(f"AI_FRAME_PROGRESS:{i + 1}:{frame_count}:{frame_path}", flush=True)

                # Ghép toàn bộ N frame vào dải sprite để lưu trữ và xem trước
                strip_out_w = target_pixel_size * frame_count
                strip_out = Image.new("RGBA", (strip_out_w, target_pixel_size), (0, 0, 0, 0))
                for i, f_p in enumerate(frame_files):
                    f_img = Image.open(f_p)
                    strip_out.paste(f_img, (i * target_pixel_size, 0))
                raw_out = f"{output_prefix}_raw_{strip_out_w}x{target_pixel_size}.png"
                strip_out.save(raw_out)

                meta_data = {
                    "frameCount": frame_count,
                    "action": action,
                    "engine": "ai",
                    "seed": int(seed),
                    "prompt": enriched_prompt,
                    "frameFiles": frame_files,
                    "spriteSheetRaw": raw_out
                }
                meta_path = f"{output_prefix}_anim_meta.json"
                import json
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta_data, f, ensure_ascii=False, indent=2)

                print(f"AI_ANIM_RESULT:{meta_path}", flush=True)
                print(f"AI_STAGE:DONE:Đã tạo thành công {frame_count} frames hoạt ảnh cho hành động {action}!", flush=True)
                return frame_files[0]
            else:
                # Trường hợp 2: Nhân vật mẫu tĩnh đơn lẻ
                print(f"AI_STAGE:REFINE_ANIM:Khởi tạo dải tham chiếu từ nhân vật mẫu ({frame_count} frames)...", flush=True)
                strip_w = 256 * frame_count
                strip_h = 256
                init_strip = Image.new("RGB", (strip_w, strip_h), (255, 255, 255))
                target_char_h = int(strip_h * 0.84)
                target_char_w = int(char_pil.width * (target_char_h / max(1, char_pil.height)))
                char_resized = char_pil.resize((target_char_w, target_char_h), Image.Resampling.NEAREST)

                for i in range(frame_count):
                    x_pos = i * 256 + (256 - target_char_w) // 2
                    y_pos = (256 - target_char_h) // 2
                    init_strip.paste(char_resized, (x_pos, y_pos), mask=char_resized.split()[3])

                input_sd_image = init_strip
                actual_strength = strength if (strength is not None and strength > 0.45) else 0.62

        else:
            init_pil = Image.open(init_image)
            if init_pil.mode != "RGBA":
                init_pil = init_pil.convert("RGBA")
            init_pil = remove_checkerboard_artifacts(init_pil)
            bg_white = Image.new("RGB", init_pil.size, (255, 255, 255))
            bg_white.paste(init_pil, mask=init_pil.split()[3])
            input_sd_image = bg_white.resize((512, 512), Image.Resampling.NEAREST)
            actual_strength = strength if strength is not None else 0.38

        if seed is None or seed <= 0:
            seed = int(torch.randint(1, 2147483647, (1,)).item())
        generator = torch.Generator(device).manual_seed(int(seed))

        res = pipe(
            prompt=enriched_prompt,
            negative_prompt=negative_prompt,
            image=input_sd_image,
            strength=actual_strength,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            generator=generator,
            cross_attention_kwargs=cross_attention_kwargs,
        )
        raw_img = res.images[0]

        # 1. Lưu bản ảnh gốc SpriteSheet hoặc ảnh đơn
        total_w, total_h = raw_img.size
        raw_out = f"{output_prefix}_raw_{total_w}x{total_h}.png"
        raw_img.save(raw_out)

        # 2. Xử lý cắt frame nếu ở chế độ Hoạt cảnh (Animation)
        if animation_mode and frame_count > 1:
            frame_files = []
            import json
            slice_w = total_w // frame_count
            for i in range(frame_count):
                crop_box = (i * slice_w, 0, (i + 1) * slice_w, total_h)
                sub_img = raw_img.crop(crop_box)
                if remove_bg:
                    sub_img = remove_background_safe(sub_img, tolerance=24)
                sub_pixel = sub_img.resize((target_pixel_size, target_pixel_size), Image.Resampling.NEAREST)
                frame_path = f"{output_prefix}_frame_{i}.png"
                sub_pixel.save(frame_path)
                frame_files.append(frame_path)

            meta_data = {
                "frameCount": frame_count,
                "action": action,
                "engine": "ai",
                "frameFiles": frame_files,
                "spriteSheetRaw": raw_out
            }
            meta_path = f"{output_prefix}_anim_meta.json"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta_data, f, ensure_ascii=False, indent=2)

            print(f"AI_ANIM_RESULT:{meta_path}", flush=True)
            print(f"AI_STAGE:DONE:Đã tạo thành công {frame_count} frames hoạt ảnh cho hành động {action}!", flush=True)
            return frame_files[0]

        # 3. Xu ly anh don le
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
