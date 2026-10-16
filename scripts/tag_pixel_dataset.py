# /// script
# dependencies = [
#     "onnxruntime",
#     "huggingface_hub",
#     "pillow",
#     "pandas",
#     "numpy",
#     "tqdm",
# ]
# ///

import os
import glob
import time
import zipfile
import numpy as np
import pandas as pd
from PIL import Image
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from tqdm.auto import tqdm

# Ham khoi tao mo hinh WD14 Tagger
def load_tagger_model():
    repo_id = "SmilingWolf/wd-v1-4-convnext-tagger-v2"
    print("Dang tai mo hinh WD14 ConvNeXt V2 tu Hugging Face...")
    model_path = hf_hub_download(repo_id=repo_id, filename="model.onnx")
    tags_path = hf_hub_download(repo_id=repo_id, filename="selected_tags.csv")

    df_tags = pd.read_csv(tags_path)
    tag_names = df_tags["name"].tolist()
    general_indices = [idx for idx, cat in enumerate(df_tags["category"]) if cat == 0]

    # Uu tien chay bang GPU neu co, nguoc lai chay CPU da luong
    available_providers = ort.get_available_providers()
    selected_providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if "CUDAExecutionProvider" in available_providers else ["CPUExecutionProvider"]
    
    session_options = ort.SessionOptions()
    session_options.intra_op_num_threads = os.cpu_count() or 4
    session = ort.InferenceSession(model_path, sess_options=session_options, providers=selected_providers)

    return session, tag_names, general_indices

# Ham tien xu ly 1 anh cho model WD14
def preprocess_single_image(path, target_size=448):
    try:
        img = Image.open(path).convert("RGBA")
        canvas = Image.new("RGBA", img.size, (255, 255, 255, 255))
        canvas.paste(img, (0, 0), img)
        img_rgb = canvas.convert("RGB")
        
        # Thay doi kich thuoc ve 448x448
        img_resized = img_rgb.resize((target_size, target_size), Image.Resampling.BICUBIC)
        arr = np.array(img_resized, dtype=np.float32)
        arr = arr[:, :, ::-1] # Chuyen RGB sang BGR
        arr = np.expand_dims(arr, axis=0) # Shape: (1, 448, 448, 3)
        return arr
    except Exception as err:
        print(f"Loi khi doc anh {path}: {err}")
        return None

# Ham dong goi toan bo anh va nhan vao file zip
def create_tagged_zip(image_dir, output_zip="assets/datasets/pixel_portraits_tagged.zip"):
    print(f"Dang dong goi toan bo anh va nhan vao {output_zip}...")
    zip_dir = os.path.dirname(output_zip)
    if zip_dir:
        os.makedirs(zip_dir, exist_ok=True)

    zip_start = time.time()
    all_files = glob.glob(os.path.join(image_dir, "**", "*.*"), recursive=True)
    target_files = [f for f in all_files if f.endswith(".png") or f.endswith(".txt")]
    
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in tqdm(target_files, desc="Nen zip"):
            rel_path = os.path.relpath(f, os.path.dirname(image_dir))
            zf.write(f, rel_path)
            
    print(f"Da tao thanh cong {output_zip} ({len(target_files)} tep) trong {time.time() - zip_start:.2f} giay.")

# Ham gan nhan toan bo danh sach anh
def tag_dataset(image_dir, confidence_threshold=0.35, max_images=None, auto_zip=True):
    session, tag_names, general_indices = load_tagger_model()
    input_name = session.get_inputs()[0].name

    all_images = glob.glob(os.path.join(image_dir, "**", "*.png"), recursive=True)
    if max_images:
        all_images = all_images[:max_images]

    # Loc danh sach cac anh chua co file .txt
    pending_images = [p for p in all_images if not os.path.exists(os.path.splitext(p)[0] + ".txt")]

    print(f"Tong so anh: {len(all_images)} | Da co san nhan: {len(all_images) - len(pending_images)} | Can gan nhan tiep: {len(pending_images)}")

    start_time = time.time()
    processed_count = 0

    for path in pending_images:
        input_data = preprocess_single_image(path)
        if input_data is None:
            continue

        outputs = session.run(None, {input_name: input_data})
        probs = outputs[0][0]

        selected_tags = []
        for idx in general_indices:
            if probs[idx] >= confidence_threshold:
                clean_tag = tag_names[idx].replace("_", " ")
                selected_tags.append(clean_tag)

        # Trich xuat ten nhan vat tu ten file neu co (vi du: Hero_Battle -> Hero)
        filename = os.path.basename(path)
        char_prefix = filename.split("_")[0]
        
        tags_to_save = ["pixel art", "character portrait"]
        if char_prefix and not char_prefix.isdigit():
            tags_to_save.append(char_prefix.lower())
        tags_to_save.extend(selected_tags)

        tag_content = ", ".join(tags_to_save)
        txt_path = os.path.splitext(path)[0] + ".txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(tag_content)

        processed_count += 1
        if processed_count % 50 == 0 or processed_count == len(pending_images):
            elapsed = time.time() - start_time
            rate = processed_count / elapsed if elapsed > 0 else 0
            remain = (len(pending_images) - processed_count) / rate if rate > 0 else 0
            print(f"Da gan nhan {processed_count}/{len(pending_images)} anh moi ({rate:.1f} anh/giay | Du kien con: {remain/60:.1f} phut)")

    print(f"Hoan thanh xu ly trong {time.time() - start_time:.2f} giay.")

    if auto_zip:
        create_tagged_zip(image_dir)

if __name__ == "__main__":
    import sys
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "pixel_portraits/portraits_64x64"
    max_count = int(sys.argv[2]) if len(sys.argv) > 2 else None
    tag_dataset(target_dir, max_images=max_count)
