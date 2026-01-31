/**
 * MCP Server for Procedurable Builder Authoring
 *
 * This allows AI agents to:
 * - List and inspect builders
 * - Run builders with parameters
 * - Inspect traced output
 * - Modify builder definitions (future)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { buildDiningChair } from "../../demos/ChairBuilder.js";
import { TracedOutput } from "../../generation/builder/TracedBuilder.js";

// Store last run for inspection
let lastRun: TracedOutput | null = null;

/**
 * Helper to retry fetch requests with exponential backoff
 * Useful for handling brief unavailability during hot reloads
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<Response> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error: any) {
      lastError = error;

      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        console.error(`[mcp] Fetch failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw lastError;
}

// Create server instance using the new McpServer API
const server = new McpServer({
  name: "procedurable",
  version: "0.1.0",
});

// Register tools using registerTool() API with Zod schemas

// Tool: ping (for connectivity testing)
server.registerTool(
  "ping",
  {
    description: "Test if the server is responding",
    inputSchema: {},
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "ok",
            runsInMemory: lastRun ? 1 : 0,
            timestamp: new Date().toISOString()
          }),
        },
      ],
    };
  }
);

// Tool: restart (graceful server restart to pick up code changes)
server.registerTool(
  "restart",
  {
    description: "Restart the MCP server to pick up code changes. Call this after modifying builder code.",
    inputSchema: {},
  },
  async () => {
    console.error("[procedurable] Restart requested by client. Exiting for restart...");
    // Schedule exit after response is sent
    setTimeout(() => {
      process.exit(0);
    }, 100);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "restarting",
            message: "Server is restarting. Please retry your next tool call in a moment.",
          }),
        },
      ],
    };
  }
);

// Tool: list_builders
server.registerTool(
  "list_builders",
  {
    description: "List all available builder definitions",
    inputSchema: {},
  },
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            builders: [
              {
                name: "DiningChair",
                description: "Standard dining chair with seat, legs, and back",
                parameters: [
                  "seat_width", "seat_depth", "seat_height", "seat_thickness",
                  "leg_radius", "leg_inset",
                  "back_height", "back_thickness", "back_angle"
                ],
              },
            ],
          }, null, 2),
        },
      ],
    };
  }
);

// Tool: run_builder
server.registerTool(
  "run_builder",
  {
    description: "Execute a builder with optional parameter overrides. Returns summary of built mesh.",
    inputSchema: {
      name: z.string().describe("Builder name (e.g., 'DiningChair')"),
      seed: z.number().optional().describe("Random seed for reproducible output. Same seed = identical result."),
      overrides: z.record(z.string(), z.number()).optional().describe("Optional measurement overrides (e.g., {seat_width: 0.5})"),
    },
  },
  async ({ name, seed, overrides }) => {
    if (name !== "DiningChair") {
      return {
        content: [{ type: "text", text: `Unknown builder: ${name}` }],
        isError: true,
      };
    }

    lastRun = buildDiningChair({
      seed,
      overrides: overrides as Record<string, any>,
      measurements: overrides as any
    });

    // Collect decisions summary
    const decisions: Record<string, any> = {};
    for (const [key, decision] of lastRun.decisions) {
      decisions[key] = {
        value: decision.value,
        source: decision.source
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            builder: lastRun.builderName,
            seed: lastRun.seed,
            buildTime: `${lastRun.buildTime}ms`,
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
        },
      ],
    };
  }
);

// Tool: get_measurements
server.registerTool(
  "get_measurements",
  {
    description: "Get all measurements from the last builder run with their sources",
    inputSchema: {},
  },
  async () => {
    if (!lastRun) {
      return {
        content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
        isError: true,
      };
    }

    const measurements: Record<string, { value: number; source?: string }> = {};
    for (const [key, data] of lastRun.measurements) {
      measurements[key] = data;
    }

    return {
      content: [{ type: "text", text: JSON.stringify(measurements, null, 2) }],
    };
  }
);

// Tool: get_trace
server.registerTool(
  "get_trace",
  {
    description: "Get trace information for a specific part (vertex, loop, face, etc.)",
    inputSchema: {
      key: z.string().describe("Trace key (e.g., 'vertex:seat_bl_b', 'loop:leg_bl_bottom', 'measurement:seat_width')"),
    },
  },
  async ({ key }) => {
    if (!lastRun) {
      return {
        content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
        isError: true,
      };
    }

    const trace = lastRun.traces.get(key);

    if (!trace) {
      return {
        content: [{ type: "text", text: `Trace not found: ${key}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(trace, null, 2) }],
    };
  }
);

// Tool: get_validation
server.registerTool(
  "get_validation",
  {
    description: "Get validation results from the last builder run",
    inputSchema: {},
  },
  async () => {
    if (!lastRun) {
      return {
        content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            bounds: {
              min: lastRun.validation.bounds.min,
              max: lastRun.validation.bounds.max,
              size: lastRun.validation.bounds.size,
            },
            vertexCount: lastRun.validation.vertexCount,
            faceCount: lastRun.validation.faceCount,
            issues: lastRun.validation.issues,
          }, null, 2),
        },
      ],
    };
  }
);

// Tool: list_traces
server.registerTool(
  "list_traces",
  {
    description: "List all available trace keys from the last run",
    inputSchema: {
      filter: z.string().optional().describe("Optional filter prefix (e.g., 'vertex:', 'loop:', 'measurement:')"),
    },
  },
  async ({ filter }) => {
    if (!lastRun) {
      return {
        content: [{ type: "text", text: "No builder has been run yet. Use run_builder first." }],
        isError: true,
      };
    }

    let keys = Array.from(lastRun.traces.keys());

    if (filter) {
      keys = keys.filter(k => k.startsWith(filter));
    }

    return {
      content: [{ type: "text", text: JSON.stringify(keys, null, 2) }],
    };
  }
);

// Tool: execute_commands - Proxy DSL commands to the authoring server
server.registerTool(
  "execute_commands",
  {
    description: "Execute a batch of DSL commands via the authoring server. Commands are strings like 'builder.open DiningChair', 'builder.run seed=42', etc. Use get_help to see available commands.",
    inputSchema: {
      commands: z.array(z.string()).describe("Array of DSL command strings to execute in order"),
    },
  },
  async ({ commands }) => {
    const AUTHORING_SERVER_URL = "http://127.0.0.1:4200/api/execute";

    try {
      const response = await fetchWithRetry(AUTHORING_SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands }),
      });

      if (!response.ok) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Authoring server returned ${response.status}: ${response.statusText}`,
              hint: "Make sure the authoring server is running on port 4200",
            }),
          }],
        };
      }

      const result = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Failed to connect to authoring server: ${error.message}`,
            hint: "Start the authoring server with: npx tsx src/authoring/server.ts",
          }),
        }],
      };
    }
  }
);

// Tool: get_help - Get available DSL commands from the authoring server
server.registerTool(
  "get_help",
  {
    description: "Get available DSL commands from the authoring server",
    inputSchema: {},
  },
  async () => {
    const AUTHORING_SERVER_URL = "http://127.0.0.1:4200/api/help";

    try {
      const response = await fetchWithRetry(AUTHORING_SERVER_URL, { method: "GET" });
      if (!response.ok) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: `Server returned ${response.status}` }),
          }],
        };
      }
      const result = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Failed to connect to authoring server: ${error.message}`,
            hint: "Start the authoring server with: npx tsx src/authoring/server.ts",
          }),
        }],
      };
    }
  }
);

// Tool: get_state - Get current authoring server state
server.registerTool(
  "get_state",
  {
    description: "Get current authoring server state (active builder, last run info)",
    inputSchema: {},
  },
  async () => {
    const AUTHORING_SERVER_URL = "http://127.0.0.1:4200/api/state";

    try {
      const response = await fetchWithRetry(AUTHORING_SERVER_URL, { method: "GET" });
      if (!response.ok) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: `Server returned ${response.status}` }),
          }],
        };
      }
      const result = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Failed to connect to authoring server: ${error.message}`,
          }),
        }],
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();

  // Debug: log when server is connecting (stderr is safe for MCP)
  console.error("[procedurable] Starting MCP server v0.1.0...");
  console.error("[procedurable] Tools registered: ping, restart, list_builders, run_builder, get_measurements, get_trace, get_validation, list_traces, execute_commands, get_help, get_state");

  // Handle process signals gracefully
  process.on('SIGINT', () => {
    console.error("[procedurable] Received SIGINT, shutting down...");
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error("[procedurable] Received SIGTERM, shutting down...");
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error("[procedurable] Uncaught exception:", error);
  });

  await server.connect(transport);
  console.error("[procedurable] MCP server connected and running on stdio");
}

main().catch((error) => {
  console.error("[procedurable] Fatal error:", error);
  process.exit(1);
});
