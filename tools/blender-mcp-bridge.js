import net from 'node:net';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const host = process.env.BLENDER_MCP_HOST || '127.0.0.1';
const port = Number(process.env.BLENDER_MCP_PORT || 9876);

function executeInBlender(code) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.end(`${JSON.stringify({ type: 'execute', code, strict_json: true })}\0`));
    socket.on('data', (chunk) => {
      response += chunk;
      if (response.includes('\0')) {
        socket.destroy();
        try { resolve(JSON.parse(response.slice(0, response.indexOf('\0')))); }
        catch (error) { reject(error); }
      }
    });
    socket.on('error', reject);
  });
}

const server = new Server(
  { name: 'historical-personalities-blender', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'execute_blender_python',
    description: 'Execute Python in the currently running Blender MCP add-on session. Use bpy and set result to a JSON-serializable dict.',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Python code to execute inside Blender.' } },
      required: ['code'],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'execute_blender_python') {
    return { content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }], isError: true };
  }
  try {
    const result = await executeInBlender(String(request.params.arguments?.code || ''));
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: result.status === 'error' };
  } catch (error) {
    return { content: [{ type: 'text', text: `Blender connection failed: ${error.message}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
