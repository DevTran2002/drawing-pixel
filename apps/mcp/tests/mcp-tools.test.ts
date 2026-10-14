import { describe, it, expect } from 'vitest';
import { MCP_TOOLS_DEFINITIONS, handleToolCall } from '../src/tools-handler';

describe('MCP Server Tools Definition', () => {
  it('cung cap du 10 cong cu ve pixel va hoat anh', () => {
    const toolNames = MCP_TOOLS_DEFINITIONS.map(t => t.name);
    expect(toolNames).toContain('create_canvas');
    expect(toolNames).toContain('get_canvas_state');
    expect(toolNames).toContain('draw_matrix');
    expect(toolNames).toContain('draw_pixels');
    expect(toolNames).toContain('draw_shape');
    expect(toolNames).toContain('flood_fill');
    expect(toolNames).toContain('create_animation_clip');
    expect(toolNames).toContain('draw_animation_frame');
    expect(toolNames).toContain('copy_frame_with_offset');
    expect(toolNames).toContain('export_spritesheet');
  });

  it('xu ly hop le cong cu draw_matrix', async () => {
    const result = await handleToolCall('draw_matrix', {
      matrix: ['XX', 'XX'],
      paletteMap: { 'X': '#ff0000' }
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('Ve ma tran pixel thanh cong');
  });
});
