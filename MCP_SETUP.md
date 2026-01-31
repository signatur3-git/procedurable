# MCP Server Setup for GitHub Copilot

> Procedurable MCP Server v1.0.0

## Architecture

The system has two servers:

1. **Authoring Server** (port 4200) - Handles DSL commands, executes builders
2. **MCP HTTP Server** (port 4242) - Bridges MCP protocol to authoring server

```
GitHub Copilot → MCP HTTP Server (4242) → Authoring Server (4200)
                         ↓
                   Dashboard (3000) ← WebSocket
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Both Servers

**Terminal 1 - Authoring Server:**
```bash
npx tsx src/servers/authoring/server.ts
```

**Terminal 2 - MCP HTTP Server:**
```bash
npx tsx src/servers/mcp/http-server.ts
```

### 3. Configure GitHub Copilot

**For HTTP mode (recommended):**

Add to your Copilot MCP settings (`mcp.json`):
```json
{
  "servers": {
    "procedurable": {
      "url": "http://127.0.0.1:4242/mcp"
    }
  }
}
```

**For stdio mode (alternative):**
```json
{
  "servers": {
    "procedurable": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "src/servers/mcp/server.ts"],
      "cwd": "D:\\workspaces\\procedurable"
    }
  }
}
```

### Configuration File Locations

- **IntelliJ:** `C:\Users\<user>\AppData\Local\github-copilot\intellij\mcp.json`

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `execute_commands` | Execute DSL commands (primary tool) |
| `get_state` | Get current server state |
| `get_help` | Get available DSL commands |
| `ping` | Test connectivity |
| `list_builders` | [Legacy] List builders |
| `run_builder` | [Legacy] Run a builder |

## DSL Commands

See [docs/DSL_COMMANDS.md](docs/DSL_COMMANDS.md) for complete reference.

### Quick Examples

```bash
version                     # API version (1.0.0)
builder.list                # List all builders
builder.open DiningChair    # Open a builder
builder.run seed=42         # Run with deterministic seed
builder.measurements        # Get measurements from last run
storage.list                # List YAML builders
```

## Troubleshooting

### MCP tools not appearing

1. Both servers must be running (ports 4200 and 4242)
2. Restart the IDE after config changes
3. Check `mcp-server.log` for errors

### "Unknown builder" error

- Check builder name spelling
- Use `builder.list` to see available builders

## Ports Summary

| Port | Service |
|------|---------|
| 3000 | Dashboard UI (Vite) |
| 4200 | Authoring Server |
| 4242 | MCP HTTP Server |
