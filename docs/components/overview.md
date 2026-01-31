# Component Map

Every component in Procedurable, its responsibility, and its target-state capabilities. Components marked with **[exists]** have working implementations. Components marked with **[planned]** are designed but not yet built.

## Dependency Graph

```
                    ┌─────────┐
                    │   MCP   │  (stable shell)
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │Authoring│  (command routing)
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼───┐
         │Builder │ │Storage │ │Dash- │
         │ Engine │ │        │ │board │
         └───┬────┘ └────────┘ └──────┘
             │
    ┌────────┼────────┬──────────┐
    │        │        │          │
┌───▼──┐ ┌──▼───┐ ┌──▼────┐ ┌──▼──────┐
│Scene │ │Valid-│ │Export │ │Materials│
│      │ │ation│ │[plan] │ │& Mods   │
└───┬──┘ └─────┘ └───────┘ └─────────┘
    │
┌───▼──────────────────────────┐
│        Geometry              │
│  Mesh · Extrude · Sweep ·   │
│  Lathe · Subdivision · Path  │
└───────────┬──────────────────┘
            │
┌───────────▼──────────────────┐
│   Math & Spatial             │
│  Vec3 · Mat4 · Transform ·  │
│  AABB · Spline · RNG ·      │
│  Noise · Scatter · Poisson   │
└──────────────────────────────┘
```

## Component Index

| Component | Location | Status | Page |
|-----------|----------|--------|------|
| Math primitives | `src/core/` | [exists] | [Math & Spatial](./math-spatial) |
| Spatial algorithms | `src/core/` | [exists] | [Math & Spatial](./math-spatial) |
| Geometry engines | `src/geometry/` | [exists] | [Geometry](./geometry) |
| Text-to-shape | `src/text/` | [partial] | [Text](./text) |
| Builder engine | `src/builder/` | [exists] | [Builder Engine](./builder) |
| Scene & Composition | `src/builder/` | [partial] | [Scene](./scene) |
| Materials | `src/builder/` | [minimal] | [Materials & Modifiers](./materials-modifiers) |
| Modifiers | — | [planned] | [Materials & Modifiers](./materials-modifiers) |
| Validation | `src/validation/` | [partial] | [Validation](./validation) |
| Authoring server | `src/authoring/` | [exists] | [Authoring](./authoring) |
| MCP server | `src/mcp/` | [exists] | [MCP](./mcp) |
| Storage | `src/storage/` | [exists] | [Storage](./storage) |
| Dashboard | `src/dashboard/` | [exists] | [Dashboard](./dashboard) |
| Export | — | [planned] | [Export](./export) |

## Target Folder Structure

After the planned restructuring (from CODE_STRUCTURE_EVALUATION):

```
src/
├── math/           Pure math: Vec3, Mat4, Transform, AABB, Spline, MathService
├── spatial/        Algorithms using math: Scatter, PoissonDisk, ScalarField, Instance
├── geometry/       Mesh data + creation: Mesh, Extrude, Sweep, Lathe, Subdivision, Path2D, Shape2D
├── text/           Font parsing + text-to-geometry
├── materials/      MaterialLibrary + future PBR pipeline
├── modifiers/      ModifierStack: Subdivision, Bevel, Deformers
├── scene/          SceneNode, SceneGraph, Placement, SharedContext
├── builder/        TracedBuilder, YamlBuilderParser, ExpressionService
├── validation/     Quality gates + mesh checks
├── export/         OBJ, glTF exporters
├── authoring/      DSL command server + handlers
├── mcp/            MCP protocol servers
├── storage/        Persistence abstraction
├── dashboard/      Three.js preview UI
└── demos/          Example builders (Chair, Table, Person, etc.)
```
