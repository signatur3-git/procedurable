# Dashboard

Real-time 3D preview and inspection UI.

## Current State [exists]

- **Three.js** renderer with orbit controls
- **WebSocket** connection to Authoring Server for live updates
- **Seed grid** — render same builder with multiple seeds side-by-side
- **Trace inspector** — view decisions, measurements, and execution trace
- **Material preview** — visualize assigned vertex colors

Entry point: `dashboard.html` served by Vite dev server on port 3000.

## How It Connects

```
Authoring Server (4200)
  │
  ├── HTTP API (for commands)
  │
  └── WebSocket (for broadcasts)
       │
       ▼
Dashboard (3000)
  ├── Receives TracedOutput on every builder.run
  ├── Converts Mesh → Three.js BufferGeometry
  ├── Renders with orbit camera
  └── Shows trace/decision/measurement panels
```

The dashboard is a **consumer**, not a controller. It displays whatever the authoring server broadcasts. Agents and humans drive changes through the DSL; the dashboard reflects them.

## Target State Additions

| Capability | Status | Purpose |
|------------|--------|---------|
| Quality tier badge | Planned | Show current vs target tier visually |
| Decision coverage heatmap | Planned | Highlight which parts of mesh are affected by which decisions |
| Scene hierarchy view | Planned | Tree view of composed builders |
| Material slot editor | Planned | Override material slots interactively |
| Export button (glTF) | Planned | One-click export from dashboard |
| Side-by-side comparison | Planned | Compare two seeds or two override sets |
