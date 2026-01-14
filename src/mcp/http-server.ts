/**
 * MCP Server with HTTP/SSE Transport
 *
 * Compatible with SSEClientTransport used by GitHub Copilot.
 *
 * Usage:
 *   npm run mcp:http
 *
 * Then configure Copilot with:
 *   { "url": "http://127.0.0.1:4242/mcp" }
 */

import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from 'fs';

import { buildDiningChair } from "../builder/ChairBuilder.js";
import { TracedOutput } from "../builder/TracedBuilder.js";

const PORT = 4242;
const LOG_FILE = 'D:\\workspaces\\procedurable\\mcp-server.log';

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.error(line.trim());
  fs.appendFileSync(LOG_FILE, line);
}

// Store last run for inspection (shared across all sessions)
let lastRun: TracedOutput | null = null;

// Store active transports by session ID
const transports = new Map<string, SSEServerTransport>();

// Tool definitions
const TOOLS = [
  {
    name: "ping",
    description: "Test if the server is responding",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "execute_commands",
    description: "Execute a batch of DSL commands via the authoring server. Commands are strings like 'builder.open DiningChair', 'builder.run seed=42', etc. Use get_help to see available commands.",
    inputSchema: {
      type: "object" as const,
      properties: {
        commands: {
          type: "array",
          items: { type: "string" },
          description: "Array of DSL command strings to execute in order"
        },
      },
      required: ["commands"],
    },
  },
  {
    name: "get_state",
    description: "Get current authoring server state (active builder, last run info)",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_help",
    description: "Get available DSL commands from the authoring server",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_builders",
    description: "[LEGACY - use execute_commands instead] List all available builder definitions",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "run_builder",
    description: "[LEGACY - use execute_commands instead] Execute a builder with optional parameter overrides.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Builder name (e.g., 'DiningChair')" },
        seed: { type: "number", description: "Random seed for reproducible output. Same seed = identical result." },
        overrides: { type: "object", description: "Optional measurement overrides (e.g., {seat_width: 0.5})" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_measurements",
    description: "[LEGACY - use 'builder.measurements' via execute_commands] Get all measurements from the last builder run",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_validation",
    description: "Get validation results from the last builder run",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_traces",
    description: "[LEGACY - use 'builder.traces' via execute_commands] List all available trace keys from the last run",
    inputSchema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "Optional filter prefix (e.g., 'vertex:', 'loop:', 'measurement:')" },
      },
    },
  },
  {
    name: "get_trace",
    description: "[LEGACY - use 'builder.trace <key>' via execute_commands] Get trace information for a specific part",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Trace key (e.g., 'vertex:seat_bl_b', 'loop:leg_bl_bottom')" },
      },
      required: ["key"],
    },
  },
];

const AUTHORING_SERVER_URL = 'http://127.0.0.1:4200';

// Helper to call authoring server
async function callAuthoringServer(path: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${AUTHORING_SERVER_URL}${path}`, options);
    if (!response.ok) {
      throw new Error(`Authoring server error: ${response.status}`);
    }
    return await response.json();
  } catch (err: any) {
    throw new Error(`Failed to connect to authoring server: ${err.message}. Is it running on port 4200?`);
  }
}

// Tool handler
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  switch (name) {
    case "ping":
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "ok",
            transport: "sse",
            runsInMemory: lastRun ? 1 : 0,
            timestamp: new Date().toISOString()
          }),
        }],
      };

    case "execute_commands": {
      const commands = args.commands as string[];
      if (!commands || !Array.isArray(commands)) {
        return {
          content: [{ type: "text", text: "Missing or invalid 'commands' array" }],
          isError: true,
        };
      }
      try {
        const result = await callAuthoringServer('/api/execute', 'POST', { commands });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message }],
          isError: true,
        };
      }
    }

    case "get_state": {
      try {
        const result = await callAuthoringServer('/api/state');
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message }],
          isError: true,
        };
      }
    }

    case "get_help": {
      try {
        const result = await callAuthoringServer('/api/help');
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err.message }],
          isError: true,
        };
      }
    }

    case "list_builders":
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            builders: [{
              name: "DiningChair",
              description: "Standard dining chair with seat, legs, and back",
              parameters: [
                "seat_width", "seat_depth", "seat_height", "seat_thickness",
                "leg_radius", "leg_inset",
                "back_height", "back_thickness", "back_angle"
              ],
            }],
          }, null, 2),
        }],
      };

    case "run_builder": {
      const builderName = args.name as string;
      if (builderName !== "DiningChair") {
        return {
          content: [{ type: "text", text: `Unknown builder: ${builderName}` }],
          isError: true,
        };
      }

      const startTime = performance.now();
      lastRun = buildDiningChair({
        seed: (args.seed as number) ?? Date.now(),
        overrides: (args.overrides as Record<string, number>) ?? {},
        measurements: args.overrides as any,
      });
      const buildTime = Math.round(performance.now() - startTime);

      const decisions: Record<string, { value: unknown; source: string }> = {};
      for (const [key, decision] of lastRun.decisions) {
        decisions[key] = { value: decision.value, source: decision.source };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            builder: lastRun.builderName,
            seed: lastRun.seed,
            buildTime: `${buildTime}ms`,
            mesh: {
              vertices: lastRun.validation.vertexCount,
              faces: lastRun.validation.faceCount,
            },
            bounds: {
              width: lastRun.validation.bounds.size.x.toFixed(3) + "m",
              height: lastRun.validation.bounds.size.y.toFixed(3) + "m",
              depth: lastRun.validation.bounds.size.z.toFixed(3) + "m",
            },
            decisions,
            issues: lastRun.validation.issues.length,
            traceCount: lastRun.traces.size,
          }, null, 2),
        }],
      };
    }

    case "get_measurements":
      if (!lastRun) {
        return {
          content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
          isError: true,
        };
      }
      const measurements: Record<string, { value: number; source?: string }> = {};
      for (const [key, m] of lastRun.measurements) {
        measurements[key] = { value: m.value, source: m.source };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(measurements, null, 2) }],
      };

    case "get_validation":
      if (!lastRun) {
        return {
          content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            bounds: lastRun.validation.bounds,
            vertexCount: lastRun.validation.vertexCount,
            faceCount: lastRun.validation.faceCount,
            issues: lastRun.validation.issues,
          }, null, 2),
        }],
      };

    case "list_traces": {
      if (!lastRun) {
        return {
          content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
          isError: true,
        };
      }
      let keys = Array.from(lastRun.traces.keys());
      const filter = args.filter as string | undefined;
      if (filter) {
        keys = keys.filter(k => k.startsWith(filter));
      }
      return {
        content: [{ type: "text", text: JSON.stringify(keys, null, 2) }],
      };
    }

    case "get_trace": {
      if (!lastRun) {
        return {
          content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
          isError: true,
        };
      }
      const key = args.key as string;
      const trace = lastRun.traces.get(key);
      if (!trace) {
        return {
          content: [{ type: "text", text: `Trace not found: ${key}. Use list_traces to see available keys.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(trace, null, 2) }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

/**
 * Create a new MCP server instance with all tools registered.
 */
function createServer(): Server {
  const server = new Server(
    { name: "procedurable", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log(`Tool call: ${name}`);
    return handleToolCall(name, args ?? {});
  });

  return server;
}

// Create Express app
const app = express();
app.use(express.json());

// Handle direct JSON-RPC POST to /mcp (Streamable HTTP transport)
// This is what GitHub Copilot uses
app.post('/mcp', async (req, res) => {
  const body = req.body;
  log(`POST /mcp: ${JSON.stringify(body)}`);

  // Handle JSON-RPC request directly
  if (body.method === 'initialize') {
    res.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'procedurable', version: '0.1.0' },
        capabilities: { tools: {} }
      }
    });
    return;
  }

  if (body.method === 'notifications/initialized') {
    // Acknowledge notification with empty response (some clients don't like 204)
    res.status(200).json({ jsonrpc: '2.0', id: body.id, result: {} });
    return;
  }

  if (body.method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      id: body.id,
      result: { tools: TOOLS }
    });
    return;
  }

  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params;
    log(`Tool call via POST: ${name}`);
    try {
      const result = await handleToolCall(name, args ?? {});
      res.json({
        jsonrpc: '2.0',
        id: body.id,
        result
      });
    } catch (err: any) {
      log(`Tool call error: ${err.message}`);
      res.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32000, message: err.message || 'Tool execution failed' }
      });
    }
    return;
  }

  // Unknown method
  log(`Unknown method: ${body.method}`);
  res.json({
    jsonrpc: '2.0',
    id: body.id,
    error: { code: -32601, message: `Method not found: ${body.method}` }
  });
});

// SSE endpoint - clients connect here to establish the event stream (legacy)
app.get('/mcp', async (req, res) => {
  log(`SSE connection request from ${req.ip}`);

  // Create SSE transport
  const transport = new SSEServerTransport('/mcp/message', res);
  transports.set(transport.sessionId, transport);
  log(`New SSE session: ${transport.sessionId}`);

  // Clean up on close
  res.on('close', () => {
    transports.delete(transport.sessionId);
    log(`Client disconnected: ${transport.sessionId}`);
  });

  // Create and connect server
  const server = createServer();
  await server.connect(transport);
  log(`Server connected for session: ${transport.sessionId}`);
});

// Message endpoint - clients POST JSON-RPC messages here (legacy SSE)
app.post('/mcp/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  log(`Message for session: ${sessionId}`);

  const transport = transports.get(sessionId);
  if (!transport) {
    log(`Session not found: ${sessionId}`);
    res.status(404).json({ error: 'Session not found', sessionId });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sessions: transports.size,
    sessionIds: Array.from(transports.keys()),
    transport: 'sse'
  });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
  log(`HTTP MCP server running at http://127.0.0.1:${PORT}`);
  log(`SSE endpoint: http://127.0.0.1:${PORT}/mcp`);
  log(`Message endpoint: http://127.0.0.1:${PORT}/mcp/message`);
  log(`Health check: http://127.0.0.1:${PORT}/health`);
  log(`Tools: ${TOOLS.map(t => t.name).join(', ')}`);
});
