"""
Script tien xu ly du lieu va tao bo huan luyen LoRA / Diffusion cho Pixel Art
"""
import os
import sys
import glob

def create_lora_dataset_structure(base_dir, output_dir):
    categories = ['portraits_64x64', 'characters_16x32', 'crops_items_16x16', 'tilesets_16x16']
    for cat in categories:
        os.makedirs(os.path.join(output_dir, cat), exist_ok=True)
    print(f"Đã khởi tạo cấu trúc thư mục dataset tại: {output_dir}")

def generate_caption_text(category, sprite_name):
    clean_name = os.path.splitext(sprite_name)[0].replace('_', ' ')
    if category == 'portraits_64x64':
        return f"pixel art, character portrait, 64x64, 16-bit RPG dialogue portrait, {clean_name}, clean cluster shading"
    elif category == 'characters_16x32':
        return f"pixel art, 16x32 character sprite, walking animation frame, chibi proportion, top-down 3/4 perspective, {clean_name}"
    elif category == 'crops_items_16x16':
        return f"pixel art, 16x16 item icon, game asset, vibrant colors, {clean_name}"
    else:
        return f"pixel art, 16x16 tileset texture, retro game terrain, {clean_name}"

if __name__ == '__main__':
    print("Bộ công cụ trích xuất và chuẩn bị dữ liệu LoRA Pixel Art đa dụng.")
    print("Sử dụng để chuẩn bị dataset huấn luyện Stable Diffusion / LoRA.")
