# How To Run Procedurable

## Quick Start

```bash
npm install

# Start all services
npm run authoring    # Authoring server (port 4200)
npm run mcp:http     # MCP server (port 4242)  
npm run dev          # Dashboard (port 3000)
```

## Services

| Service | Port | Command | Description |
|---------|------|---------|-------------|
| **Authoring Server** | 4200 | `npm run authoring` | DSL command execution, YAML builders |
| **MCP Server** | 4242 | `npm run mcp:http` | MCP protocol for Copilot integration |
| **Dashboard** | 3000 | `npm run dev` | Visual 3D preview with Three.js |

## Usage

### For AI Agents (Copilot)

Configure MCP in your IDE settings to connect to `http://127.0.0.1:4242/mcp`.

Available tools:
- `execute_commands` - Run DSL commands like `builder.open Table`, `builder.run seed=42`
- `get_help` - List available commands
- `get_state` - Get current server state

### For Humans (Dashboard)

Open `http://localhost:3000` to:
- Select builders from dropdown
- Navigate seeds with Prev/Next/Random
- View 3D preview with orbit controls
- See decisions and measurements

### Running Tests

```bash
# Integration tests (requires authoring server running)
npm run test:integration
```

## Development

Hot reload is enabled for both dashboard and authoring server:
- Dashboard: `npm run dev` (Vite)
- Authoring: `npm run authoring` (tsx watch)

YAML builders in `builders/` are reloaded on each run.
