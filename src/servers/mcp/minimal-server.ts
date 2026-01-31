/**
 * Minimal MCP Server for testing connectivity
 * This is a standalone version that doesn't require complex imports
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create server instance
const server = new McpServer({
  name: "procedurable",
  version: "0.1.0",
});

// Simple test tool
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
          text: JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        },
      ],
    };
  }
);

// List available builders (hardcoded for now)
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
              { name: "DiningChair", description: "Standard dining chair" },
              { name: "IndoorScene", description: "Indoor room scene" },
              { name: "ForestScene", description: "Forest with trees" },
            ],
          }, null, 2),
        },
      ],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  console.error("[procedurable] Starting minimal MCP server...");
  await server.connect(transport);
  console.error("[procedurable] MCP server connected");
}

main().catch((error) => {
  console.error("[procedurable] Fatal error:", error);
  process.exit(1);
});

