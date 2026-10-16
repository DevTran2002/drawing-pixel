// apps/server/src/gemini-helper.ts
// Module tich hop Google Gemini 1.5 Flash de chuyen doi mo ta tu nhien thanh Danbooru / Pixel Art tags

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tim thu muc goc cua du an (d:\pixel_draw)
function getProjectRoot(): string {
  let cur = __dirname;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'package.json')) && fs.existsSync(path.join(cur, 'apps'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return process.cwd();
}

// Nap tu dien tag tu docs/pixel_art_tags_dictionary.json
function loadTagDictionary(): string {
  try {
    const projectRoot = getProjectRoot();
    const dictPath = path.join(projectRoot, 'docs', 'pixel_art_tags_dictionary.json');
    if (fs.existsSync(dictPath)) {
      const content = fs.readFileSync(dictPath, 'utf-8');
      const json = JSON.parse(content);
      const categorySummaries: string[] = [];
      if (json.categories) {
        for (const [key, cat] of Object.entries<any>(json.categories)) {
          if (cat.tags && Array.isArray(cat.tags)) {
            categorySummaries.push(`- ${cat.name || key}: ${cat.tags.join(', ')}`);
          }
        }
      }
      return categorySummaries.join('\n');
    }
  } catch (err) {
    console.error('[Gemini Helper] Khong the nap tu dien tags tu file:', err);
  }

  // Fallback danh muc co ban neu file khong ton tai
  return `
- Đối tượng: 1girl, 1boy, solo, old man, old woman, knight, warrior, mage, wizard, rogue, archer, blacksmith, merchant, farmer
- Mái tóc: brown hair, blonde hair, black hair, red hair, purple hair, blue hair, white hair, short hair, long hair, ponytail, twin braids
- Màu mắt: blue eyes, green eyes, brown eyes, red eyes
- Biểu cảm: smiling, smile, happy, neutral expression, serious, angry, sad, surprised, blushing, smirk
- Trang phục: armor, plate armor, chainmail, cloak, robe, tunic, white shirt, dress, apron, boots, gloves
- Vũ khí: holding sword, holding shield, holding staff, holding bow, holding dagger, holding wand, holding potion
- Khung hình: character portrait, bust shot, upper body, full body, standing, looking at viewer
- Bối cảnh: simple white background, flat background
`;
}

export interface GeminiPromptResult {
  prompt: string;
  tags: string[];
}

// Doc GEMINI_API_KEY tu process.env hoac tu file .env trong thu muc goc du an
function getStoredGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const projectRoot = getProjectRoot();
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GEMINI_API_KEY=')) {
          const val = trimmed.substring('GEMINI_API_KEY='.length).trim();
          return val.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (err) {
    console.error('[Gemini Helper] Khong the doc file .env:', err);
  }
  return '';
}

/**
 * Goi Google Gemini REST API de phan tich mo ta tu nhien thanh chuoi tags chuan Danbooru / Pixel Art
 */
export async function expandPromptWithGemini(
  description: string,
  modelName = 'pixel_portrait_lora',
  userApiKey?: string
): Promise<GeminiPromptResult> {
  const trimmedDesc = description.trim();
  if (!trimmedDesc) {
    throw new Error('Vui lòng cung cấp nội dung mô tả nhân vật hoặc khung cảnh');
  }

  // Uu tien API key truyen len tu frontend, neu khong co thi doc tu .env hoac process.env
  const apiKey = (userApiKey && userApiKey.trim()) || getStoredGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình Gemini API Key. Vui lòng nhập API Key trong phần Cài đặt nâng cao của AI Studio hoặc thiết lập GEMINI_API_KEY trong file .env. Bạn có thể lấy key miễn phí tại: https://aistudio.google.com'
    );
  }

  const tagDictionaryText = loadTagDictionary();

  // Xac dinh phong cach va tu khoa khoi dau tuy theo LoRA nguoi dung dang chon
  const isPortraitMode = modelName.toLowerCase().includes('portrait');
  const triggerPrefix = isPortraitMode ? 'pixel art, character portrait' : 'pixel, pixel art, chibi';
  const defaultFraming = isPortraitMode ? 'character portrait, bust shot' : 'full body, standing';

  const systemInstructionText = `
Bạn là chuyên gia chuyển đổi mô tả tiếng Việt hoặc tiếng Anh thành chuỗi tag Danbooru / Pixel Art chuẩn cho mô hình Stable Diffusion.

MÔ HÌNH VÀ PHONG CÁCH:
- Chế độ: ${isPortraitMode ? 'Chân dung hội thoại NPC 64x64' : 'Nhân vật toàn thân RPG / Khung cảnh'}
- Từ khóa kích hoạt bắt buộc ở đầu: "${triggerPrefix}"
- Góc nhìn / Cỡ cảnh: "${defaultFraming}"

DANH MỤC TAG THAM KHẢO HỢP LỆ:
${tagDictionaryText}

HƯỚNG DẪN TRÍCH XUẤT TOÀN DIỆN (THEO THỨ TỰ ƯU TIÊN):
1. Mở đầu: Bắt buộc là "${triggerPrefix}".
2. Bối cảnh nền (ƯU TIÊN HÀNG ĐẦU): Luôn đặt bối cảnh nền lên đầu tiên ngay sau "${triggerPrefix}" (ví dụ: simple white background, white background, flat background).
3. Đối tượng: 1girl hoặc 1boy, solo, nghề nghiệp (knight, warrior, mage, archer, cleric, rogue, villager, ...).
4. Tóc: Màu tóc (blonde hair, brown hair, black hair, red hair, white hair, ...) và kiểu tóc nếu có (long hair, short hair, ponytail, twin braids, bangs, ...).
5. Mắt: Màu mắt (blue eyes, green eyes, brown eyes, red eyes, golden eyes, ...).
6. Biểu cảm: smiling, smile, happy, serious, neutral expression, blushing, smirk, ...
7. Trang phục & Giáp: plate armor, golden armor, silver armor, chainmail, leather armor, cloak, robe, tunic, white shirt, ...
8. Khuôn mặt & Phụ kiện: helmet, hood, glasses, beard, earrings, ...
9. Hành động & Tư thế (NẾU CÓ MÔ TẢ): walking, running, jumping, attacking, slashing, swinging sword, aiming bow, casting spell, sitting, sitting on ground, kneeling, lying down, sleeping, defeated, hurt, standing.
10. Vật phẩm / Vũ khí (nếu mô tả có nhắc): holding sword, holding shield, holding staff, holding bow, holding dagger, ...
11. Góc nhìn: looking at viewer, ${isPortraitMode ? 'bust shot' : 'full body'}.

QUY TẮC ĐỊNH DẠNG:
- Trả về DUY NHẤT một chuỗi các tag tiếng Anh phân tách bằng dấu phẩy.
- Tuyệt đối không thêm lời giải thích, không markdown code block, không dấu ngoặc kép.
- Giữ các tag ngắn gọn, chuẩn Danbooru tag.
`;


  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Hãy trích xuất và chuyển đổi mô tả này thành các tag pixel art chuẩn: "${trimmedDesc}"`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstructionText
        }
      ]
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      topP: 0.95
    }
  };

  const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
  let lastErrorMessage = '';
  let responseData: any = null;

  for (const modelToTry of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Lỗi từ Google Gemini API (${response.status})`;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error && errJson.error.message) {
            errorMessage = errJson.error.message;
          }
        } catch {
          // Giu nguyen errorText
        }
        lastErrorMessage = errorMessage;
        // Neu loi do model khong tim thay (404), thu model tiep theo
        if (response.status === 404 || errorMessage.includes('not found')) {
          continue;
        }
        throw new Error(errorMessage);
      }

      responseData = await response.json();
      break;
    } catch (err: any) {
      lastErrorMessage = err.message;
      if (err.message.includes('not found')) {
        continue;
      }
      throw err;
    }
  }

  if (!responseData) {
    throw new Error(lastErrorMessage || 'Không thể kết nối đến mô hình Gemini');
  }

  const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Lam sach chuoi ket qua
  let cleanedText = rawText
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  // Dam bao co trigger prefix o dau neu Gemini quen
  if (!cleanedText.toLowerCase().includes('pixel')) {
    cleanedText = `${triggerPrefix}, ${cleanedText}`;
  }

  // Tach danh sach cac tag rieng biet
  const rawTags = cleanedText
    .split(',')
    .map((t: string) => t.trim().toLowerCase())
    .filter((t: string) => t.length > 0);

  // Loai bo cac tag bi trung lap
  const uniqueTags: string[] = [];
  for (const t of rawTags) {
    if (!uniqueTags.includes(t)) {
      uniqueTags.push(t);
    }
  }

  // Phan loai de uu tien dua boi canh len dau tien ngay sau trigger phong cach
  const triggerTags: string[] = [];
  const backgroundTags: string[] = [];
  const otherTags: string[] = [];

  const triggerKeywords = ['pixel art', 'pixel', 'chibi', 'character portrait', 'retro game asset'];
  const bgKeywords = ['background', 'white background', 'simple background', 'flat background', 'transparent background'];

  for (const tag of uniqueTags) {
    if (triggerKeywords.includes(tag)) {
      triggerTags.push(tag);
    } else if (bgKeywords.some(bg => tag.includes(bg))) {
      backgroundTags.push(tag);
    } else {
      otherTags.push(tag);
    }
  }

  // Neu chua co tag boi canh nao, mac dinh bo sung simple white background vao nhom boi canh
  if (backgroundTags.length === 0) {
    backgroundTags.push('simple white background');
  }

  // Xep theo thu tu: [Phong cach, Boi canh uu tien nhat, Nhan vat va chi tiet]
  const sortedTags = [...triggerTags, ...backgroundTags, ...otherTags];

  const finalPrompt = sortedTags.join(', ');

  return {
    prompt: finalPrompt,
    tags: sortedTags
  };
}
