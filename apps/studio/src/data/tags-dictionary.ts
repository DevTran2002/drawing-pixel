// apps/studio/src/data/tags-dictionary.ts
// Tu dien tag Danbooru va Pixel Art chuan hoa phuc vu giao dien Tag Picker va Tro ly AI

export interface TagCategory {
  id: string;
  name: string;
  tags: string[];
}

export const TAG_CATEGORIES: TagCategory[] = [
  {
    id: 'style_core',
    name: 'Phong cách cốt lõi',
    tags: [
      'pixel art',
      '16-bit',
      'pixel',
      'chibi',
      'retro game asset',
      'clean cluster shading',
      'organic outline',
      'dither',
      'sprite sheet'
    ]
  },
  {
    id: 'characters',
    name: 'Đối tượng & Nghề nghiệp',
    tags: [
      '1girl',
      '1boy',
      'solo',
      'knight',
      'warrior',
      'mage',
      'wizard',
      'rogue',
      'assassin',
      'archer',
      'cleric',
      'healer',
      'blacksmith',
      'merchant',
      'farmer',
      'king',
      'princess',
      'villager',
      'old man',
      'old woman'
    ]
  },
  {
    id: 'hair_colors',
    name: 'Màu tóc',
    tags: [
      'brown hair',
      'blonde hair',
      'black hair',
      'red hair',
      'purple hair',
      'blue hair',
      'white hair',
      'silver hair',
      'green hair',
      'pink hair'
    ]
  },
  {
    id: 'hair_styles',
    name: 'Kiểu tóc',
    tags: [
      'short hair',
      'long hair',
      'medium hair',
      'ponytail',
      'twin braids',
      'braid',
      'messy hair',
      'curly hair',
      'spiky hair',
      'bob cut',
      'bald',
      'bangs'
    ]
  },
  {
    id: 'eyes',
    name: 'Mắt',
    tags: [
      'blue eyes',
      'green eyes',
      'brown eyes',
      'red eyes',
      'purple eyes',
      'golden eyes',
      'closed eyes'
    ]
  },
  {
    id: 'expressions',
    name: 'Biểu cảm',
    tags: [
      'smiling',
      'smile',
      'neutral expression',
      'happy',
      'laughing',
      'angry',
      'frowning',
      'sad',
      'serious',
      'surprised',
      'open mouth',
      'blushing',
      'smirk',
      'wink'
    ]
  },
  {
    id: 'facial_features',
    name: 'Khuôn mặt & Mũ / Phụ kiện',
    tags: [
      'beard',
      'mustache',
      'stubble',
      'glasses',
      'sunglasses',
      'eye patch',
      'earrings',
      'scar on face',
      'helmet',
      'hood',
      'wizard hat',
      'crown',
      'straw hat',
      'bandana',
      'beret',
      'flower in hair'
    ]
  },
  {
    id: 'clothing_and_armor',
    name: 'Trang phục & Giáp trụ',
    tags: [
      'armor',
      'plate armor',
      'golden armor',
      'silver armor',
      'chainmail',
      'leather armor',
      'cloak',
      'cape',
      'robe',
      'tunic',
      'white shirt',
      'blue shirt',
      'brown vest',
      'dress',
      'apron',
      'boots',
      'gloves',
      'gauntlets',
      'scarf',
      'belt'
    ]
  },
  {
    id: 'weapons_and_items',
    name: 'Vũ khí & Vật phẩm',
    tags: [
      'holding sword',
      'holding shield',
      'holding staff',
      'holding bow',
      'holding axe',
      'holding dagger',
      'holding wand',
      'holding potion',
      'holding book',
      'holding torch',
      'sword at hip',
      'quiver on back'
    ]
  },
  {
    id: 'framing_and_view',
    name: 'Khung hình & Góc nhìn',
    tags: [
      'portrait',
      'character portrait',
      'bust shot',
      'upper body',
      'headshot',
      'full body',
      'looking at viewer',
      'looking away',
      'profile',
      'top-down 3/4 view'
    ]
  },
  {
    id: 'actions_and_poses',
    name: 'Hành động & Tư thế',
    tags: [
      'walking',
      'running',
      'jumping',
      'standing',
      'attacking',
      'slashing',
      'swinging sword',
      'aiming bow',
      'casting spell',
      'holding shield',
      'sitting',
      'sitting on ground',
      'kneeling',
      'crouching',
      'lying down',
      'sleeping',
      'defeated',
      'hurt'
    ]
  },
  {
    id: 'backgrounds',
    name: 'Bối cảnh nền',
    tags: [
      'simple background',
      'white background',
      'flat background',
      'transparent background',
      'lush green forest background',
      'tavern background',
      'dungeon background'
    ]
  }
];
