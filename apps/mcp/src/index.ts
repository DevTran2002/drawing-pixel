#!/usr/bin/env node
// apps/mcp/src/index.ts
// Diem vao chinh cua Pixel Draw Stdio MCP Server

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS_DEFINITIONS, handleToolCall } from './tools-handler';

async function main() {
  const server = new Server(
    {
      name: 'pixel-draw-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Dang ky danh sach cong cu
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: MCP_TOOLS_DEFINITIONS
    };
  });

  // Xu ly loi goi cong cu tu AI
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return await handleToolCall(name, args || {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Loi khoi dong Pixel Draw MCP Server:', err);
  process.exit(1);
});
