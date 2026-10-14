"""
Script tiền xử lý dữ liệu và tạo bộ huấn luyện LoRA / Diffusion từ kho ảnh Stardew
Tuân thủ quy tắc tiền tố th_
"""
import os
import sys
import glob

def th_create_lora_dataset_structure(base_dir, output_dir):
    categories = ['portraits_64x64', 'characters_16x32', 'crops_items_16x16', 'tilesets_16x16']
    for cat in categories:
        os.makedirs(os.path.join(output_dir, cat), exist_ok=True)
    print(f"Đã khởi tạo cấu trúc thư mục dataset tại: {output_dir}")

def th_generate_caption_text(category, sprite_name):
    clean_name = os.path.splitext(sprite_name)[0].replace('_', ' ')
    if category == 'portraits_64x64':
        return f"stardew valley style, pixel art portrait, 64x64, 16-bit RPG character dialog, {clean_name}, clean cluster shading, organic outline"
    elif category == 'characters_16x32':
        return f"stardew valley style, 16x32 pixel art character sprite, walking animation frame, chibi proportion, top-down 3/4 perspective, {clean_name}"
    elif category == 'crops_items_16x16':
        return f"stardew valley style, 16x16 pixel art item icon, farming crop, vibrant sunlit colors, {clean_name}"
    else:
        return f"stardew valley style, 16x16 tileset texture, cozy farming game terrain, {clean_name}"

if __name__ == '__main__':
    print("Bộ công cụ trích xuất và chuẩn bị dữ liệu LoRA Stardew Pixel Art.")
    print("Sử dụng để chuẩn bị dataset huấn luyện Stable Diffusion XL / Flux.")
