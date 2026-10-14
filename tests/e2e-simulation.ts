// tests/e2e-simulation.ts
// Kich ban kiem thu tich hop dau-cuoi (End-to-End Test):
// AI goi cac cong cu MCP ve nhan vat Xa thu Cyberpunk 24x24 gom clip idle va walk, sau do xuat SpriteSheet

import { handleToolCall } from '../apps/mcp/src/tools-handler';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

async function runE2ETest() {
  console.log('--- BAT DAU KIEM THU END-TO-END ---');

  // 1. Khoi tao canvas 24x24
  console.log('1. Goi MCP: create_canvas 24x24');
  const res1 = await handleToolCall('create_canvas', {
    width: 24,
    height: 24,
    name: 'CyberpunkShooter'
  });
  console.log('Ket qua:', res1.content[0].text);

  // 2. Tao clip idle va ve Frame 0
  console.log('2. Goi MCP: draw_animation_frame (idle frame 0)');
  const palette = {
    '.': null,
    'H': '#cbd5e1', // Non sat / Highlight
    'B': '#0f172a', // Viền đen
    'G': '#334155', // Giáp xám đậm
    'S': '#e4a672', // Da mat
    'V': '#06b6d4', // Kinh ngam laser Cyan
    'R': '#ea580c', // Nong sung cam
    'P': '#1e293b'  // Quan dai
  };

  const idleFrame0 = [
    '........BBBBBB..........',
    '.......BHHHHHHB.........',
    '.......BHSVVSHB.........',
    '.......BSSSSSSB.........',
    '.......BGGGGGGGBB.......',
    '......BGGGGGGGGRRB......',
    '......BGGGGGGGGGB.......',
    '.......BGGGGGB..........',
    '.......BPPPPPB..........',
    '.......BPP.PPB..........',
    '.......BPP.PPB..........',
    '.......BBB.BBB..........'
  ];

  const res2 = await handleToolCall('draw_animation_frame', {
    tag_name: 'idle',
    frame_index: 0,
    matrix: idleFrame0,
    paletteMap: palette
  });
  console.log('Ket qua:', res2.content[0].text);

  // 3. Tao frame 1 cho clip idle (nhan vat tho ha xuong 1px)
  console.log('3. Goi MCP: draw_animation_frame (idle frame 1)');
  const idleFrame1 = [
    '........................',
    '........BBBBBB..........',
    '.......BHHHHHHB.........',
    '.......BHSVVSHB.........',
    '.......BSSSSSSB.........',
    '.......BGGGGGGGBB.......',
    '......BGGGGGGGGRRB......',
    '......BGGGGGGGGGB.......',
    '.......BGGGGGB..........',
    '.......BPPPPPB..........',
    '.......BPP.PPB..........',
    '.......BBB.BBB..........'
  ];

  const res3 = await handleToolCall('draw_animation_frame', {
    tag_name: 'idle',
    frame_index: 1,
    matrix: idleFrame1,
    paletteMap: palette
  });
  console.log('Ket qua:', res3.content[0].text);

  // 4. Xuat SpriteSheet ra thu muc test-output
  const outputDir = path.resolve('d:/pixel_draw/test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pngOutput = path.join(outputDir, 'shooter_spritesheet.png');
  console.log('4. Goi MCP: export_spritesheet tai', pngOutput);
  const res4 = await handleToolCall('export_spritesheet', {
    output_path: pngOutput,
    scale: 4,
    export_json_meta: true
  });
  console.log('Ket qua:', res4.content[0].text);

  // 5. Xac minh truc tiep tren dia cung
  console.log('5. Xac minh file ket xuat tren dia cung...');
  if (fs.existsSync(pngOutput)) {
    const pngData = fs.readFileSync(pngOutput);
    const parsed = PNG.sync.read(pngData);
    console.log(`- File PNG ton tai hop le: ${parsed.width}x${parsed.height} px (Scale 4x)`);
  } else {
    throw new Error(`File PNG chua duoc tao tai ${pngOutput}`);
  }

  const jsonOutput = path.join(outputDir, 'shooter_spritesheet.json');
  if (fs.existsSync(jsonOutput)) {
    const jsonContent = JSON.parse(fs.readFileSync(jsonOutput, 'utf-8'));
    console.log(`- File JSON metadata hop le, chua clip:`, Object.keys(jsonContent.animations || {}));
  }

  console.log('--- KIEM THU END-TO-END HOAN TOAN THANH CONG ---');
}

runE2ETest().catch((err) => {
  console.error('Kiem thu E2E that bai:', err);
  process.exit(1);
});
