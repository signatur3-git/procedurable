# Procedurable

**A procedural 3D authoring system where AI agents and humans co-author YAML builders that generate 3D models.**

## What Is This?

Procedurable is a platform for creating procedural 3D content through declarative YAML definitions. Instead of editing meshes directly, you write **builders** — parameterized recipes that generate geometry. Each builder defines decisions (style choices), measurements, materials, and geometry commands. Every run with a different seed produces a unique variation.

AI agents interact via MCP tools, humans use a visual dashboard — both see the same state in real-time.

```yaml
# A builder is a recipe, not a model
name: DiningChair
decisions:
  back_style:
    type: choice
    options: [solid, slat, ladder, spindle]
  leg_style:
    type: choice
    options: [round, tapered, square]
materials:
  wood:
    color: wood_oak
    roughness: 0.8
    metalness: 0.0
geometry:
  - box:
      name: seat
      center: { x: 0, y: "$seat_height", z: 0 }
      size: { x: "$seat_width", y: 0.03, z: "$seat_depth" }
      color: $wood    # references named material slot
  # ... 200+ more lines of conditional geometry
```

## Current State

**Phase 2 is complete.** The project has a production-ready authoring platform with quality enforcement, scene description, metadata, and comprehensive geometry tools. Phase 3 (rigging, knowledge system, complex scenes) is now underway.

### What Works

| Area | Status | Details |
|------|--------|---------|
| YAML Builder Engine | Production | Decisions, measurements, expressions, conditionals, composition |
| Geometry Operations | Complete | Box, loft, cap, extrude2D, lathe, sweep, subdivision, bevel, boolean2D, noise/bend/twist/taper deformers, mirror/radial array |
| Material System | Complete | Named PBR-ready material slots (color, roughness, metalness) with per-face assignment |
| Quality Gates | Complete | Automated Tier 0/1/2 validation, decision coverage testing, sophistication plans, plan-to-gate comparison |
| Text-to-3D | Working | TrueType font parsing, glyph holes, extruded 3D text |
| Scene Composition | Complete | Sub-builders, instancing, spatial placement, builder negotiation (ports, request/offer, blend zones) |
| PSD Scene Format | Complete | Serialize/deserialize scene graphs, spatial queries, tag aggregation, overview/drill-down |
| Metadata Store | Complete | Persistent store with furniture dimensions, style palettes, material properties |
| Builder Authoring DSL | Complete | Template generation, section editing, sophistication-guided creation |
| Dashboard | Working | Real-time 3D preview with WebSocket hot-reload |
| MCP Server | Working | AI agents can author builders via tool calls |
| glTF Export | Complete | Geometry, materials, UVs, scenes, instances |
| DSL Commands | 50+ | builder, decision, measurement, math, scene, psd, geometry, quality |

### Quality Tiers

Builders are assessed on a 3-tier quality scale:

- **Tier 0** — Bounding volumes only (boxes approximating shapes)
- **Tier 1** — Silhouette correct (recognizable form, single material)
- **Tier 2** — Form resolved (decisions produce different geometry, multi-material, closed meshes)

The DiningChair builder is the flagship Tier 2 example: 4 back styles, 3 leg styles, 2 materials, 100% decision coverage, 0 topology issues.

### Track Progress

**Phase 2 (Complete):**

| Track | Description | Status |
|-------|-------------|--------|
| A: Quality & Standards | Quality declarations, gates, decision coverage, sophistication plans | ✅ 10/10 stories |
| B: Platform Components | Foundation, PSD scene format, metadata store, builder authoring DSL, builder negotiation | ✅ 14/14 stories |
| C: Geometry Tools | Topology fixes, 2D booleans, bevel, material slots, UVs, deformers, glTF, symmetry | ✅ 22/22 stories |
| D: Domain Demos | Tier 2 proof builders (chair, vase, gear, room) | 🟡 2/4 complete |

**Phase 3 (Active):**

| Track | Description | Status |
|-------|-------------|--------|
| E: Rigging & Animation | Skeleton declaration, vertex weights, morph targets, glTF skeleton export | ⬜ 0/8 stories |
| F: Knowledge & Style | Executable constraints, style definitions, role-based composition | ⬜ 0/10 stories |
| G: World & Scenes | Height field mesh, LOD system, procedural textures, billboards | ⬜ 0/7 stories |
| H: Phase 3 Demos | Rigged creature, styled room, chess board, village on terrain | ⬜ 0/4 stories |

See [BACKLOG.md](docs/BACKLOG.md) for detailed story status and [MASTER_PLAN.md](docs/MASTER_PLAN.md) for strategy.

---

## Quick Start

```bash
npm install

# Terminal 1: Authoring server (DSL commands)
npm run authoring

# Terminal 2: MCP server (for AI agents)
npm run mcp:http

# Terminal 3: Dashboard (visual preview)
npm run dev
```

Open `http://localhost:3000` for the 3D dashboard.

### MCP Configuration

For GitHub Copilot, add to your MCP config:
```json
{ "servers": { "procedurable": { "url": "http://127.0.0.1:4242/mcp" } } }
```

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  AI Agent       │     │  Human          │
│  (MCP client)   │     │  (Dashboard)    │
└────────┬────────┘     └────────┬────────┘
         │ MCP (4242)            │ WebSocket (4200)
         ▼                       ▼
┌─────────────────────────────────────────┐
│           Authoring Server (4200)       │
│  50+ DSL commands across 8 namespaces   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  YAML Builder Engine                    │
│  ┌────────────┐  ┌──────────────────┐   │
│  │ Executor   │  │ Command Registry │   │
│  │ (7 phases) │  │ (22 handlers)    │   │
│  └────────────┘  └──────────────────┘   │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌──────────┐
│ Mesh   │  │ PSD    │  │ Quality  │
│ Output │  │ Scene  │  │ Gates    │
└────────┘  └────────┘  └──────────┘
```

### Execution Phases

The builder executor processes YAML in 7 phases:

1. **Decisions** — Resolve style choices from seed
2. **Measurements** — Evaluate dimensions with variation
3. **Materials** — Resolve named material slots (PBR-ready)
4. **Profiles/Splines/Shapes** — Prepare 2D definitions
5. **Derived** — Compute expressions
6. **Geometry** — Execute commands via registry (box, loft, extrude2D, bevel, etc.)
7. **Compositions** — Include sub-builders, placements, quality gates

---

## Project Structure

```
procedurable/
├── builders/
│   ├── catalog/              4 production builders + 3 components
│   │   ├── DiningChair.yaml  Tier 2: 4 back styles, 3 leg styles
│   │   ├── Table.yaml        Dining table with composed legs
│   │   ├── Vase.yaml         Lathed vase
│   │   ├── TextSign.yaml     3D text signage
│   │   └── components/       Leg, Cushion, Tree
│   ├── scenes/               Multi-object assemblies
│   ├── reference/            Quality tier reference examples
│   └── test-fixtures/        Capability demos (gear, booleans, etc.)
├── src/
│   ├── platform/             Core infrastructure
│   │   ├── math/             Vec3, Mat4, AABB, MathService
│   │   ├── geometry/         Mesh, Face, Vertex, Extrude, Sweep, Shape2D, Booleans
│   │   ├── materials/        MaterialLibrary, named colors, MaterialSlot
│   │   ├── spatial/          Scatter, placement algorithms
│   │   └── scene/            SharedContext, Placement
│   ├── generation/           Content pipeline
│   │   ├── builder/          YamlBuilderParser, Executor, TracedBuilder
│   │   │   └── commands/     22 geometry command handlers
│   │   ├── text/             Font parsing, text-to-shape
│   │   └── validation/       Quality gates, topology checks, decision coverage
│   ├── servers/              External interfaces
│   │   ├── authoring/        DSL command server + 50+ commands
│   │   ├── mcp/              MCP HTTP server
│   │   └── dashboard/        Visual preview server
│   ├── storage/              File-based persistence
│   └── tests/                500+ passing tests
├── docs/                     Architecture docs, format specs, backlog
└── dashboard.html            3D preview UI
```

---

## Geometry Capabilities

| Operation | Description | Example Use |
|-----------|-------------|-------------|
| Box | Axis-aligned box primitive | Seats, tabletops, panels |
| Loft | Connect two edge loops | Table legs, vase bodies |
| Cap | Close an edge loop | Top/bottom of cylinders |
| Extrude2D | 2D shape to 3D with caps | Gear bodies, plates, text |
| Lathe | Revolve profile around axis | Vases, glasses, knobs |
| Sweep | Profile along spline path | Pipes, rails, curved forms |
| Boolean2D | Union, subtract, intersect | Gear teeth, holes, cutouts |
| Bevel | Edge chamfer/rounding | Hard-surface finish quality |
| Subdivision | Catmull-Clark smoothing | Organic forms, cushions |
| Noise Displacement | Perlin-based vertex offset | Weathering, organic surfaces |
| Radial Array | Duplicate around axis | Gear teeth, spokes |

---

## Documentation

- [YAML Builder Format](docs/YAML_BUILDER_FORMAT.md) — Builder definition schema
- [DSL Commands](docs/DSL_COMMANDS.md) — Complete command reference
- [Master Plan](docs/MASTER_PLAN.md) — Roadmap, tracks, and priorities
- [Backlog](docs/BACKLOG.md) — Detailed story status
- [Quality Tiers](docs/QUALITY_TIERS.md) — Tier definitions and gate criteria
- [PSD Format](docs/PSD_FORMAT.md) — Scene description format
- [Architecture](docs/ARCHITECTURE.md) — System design

### VitePress Docs

Run `npm run docs:dev` to browse the full documentation site locally, covering data flow, component details, quality tiers, and integration guides.

---

## Running Tests

```bash
npm test              # Run all 500+ tests
npm test -- --grep MaterialSlots   # Run specific suite
```

---

## License

MIT
