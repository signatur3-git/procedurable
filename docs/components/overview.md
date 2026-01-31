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
| Math primitives | `src/platform/math/` | [exists] | [Math & Spatial](./math-spatial) |
| Spatial algorithms | `src/platform/spatial/` | [exists] | [Math & Spatial](./math-spatial) |
| Geometry engines | `src/platform/geometry/` | [exists] | [Geometry](./geometry) |
| Text-to-shape | `src/generation/text/` | [partial] | [Text](./text) |
| Builder engine | `src/generation/builder/` | [exists] | [Builder Engine](./builder) |
| Scene & Composition | `src/platform/scene/` | [partial] | [Scene](./scene) |
| Materials | `src/platform/materials/` | [minimal] | [Materials & Modifiers](./materials-modifiers) |
| Modifiers | — | [planned] | [Materials & Modifiers](./materials-modifiers) |
| Validation | `src/generation/validation/` | [partial] | [Validation](./validation) |
| Authoring server | `src/servers/authoring/` | [exists] | [Authoring](./authoring) |
| MCP server | `src/servers/mcp/` | [exists] | [MCP](./mcp) |
| Storage | `src/storage/` | [exists] | [Storage](./storage) |
| Dashboard | `src/servers/dashboard/` | [exists] | [Dashboard](./dashboard) |
| Export | — | [planned] | [Export](./export) |

## Current Folder Structure

Restructured 2026-01-31 into domain-based organization:

```
src/
├── platform/       Core infrastructure
│   ├── math/           Pure math: Vec3, Mat4, Transform, AABB, Spline, MathService
│   ├── spatial/        Algorithms: Scatter, PoissonDisk, ScalarField, Instance
│   ├── geometry/       Mesh, Extrude, Sweep, Lathe, Subdivision, Path2D, Shape2D
│   ├── scene/          SceneNode, SceneGraph, Placement, SharedContext
│   └── materials/      MaterialLibrary + future PBR pipeline
├── generation/     Content pipeline
│   ├── builder/        TracedBuilder, YamlBuilderParser, ExpressionService
│   ├── text/           Font parsing + text-to-geometry
│   └── validation/     Quality gates + mesh checks
├── servers/        External interfaces
│   ├── authoring/      DSL command server + handlers
│   ├── mcp/            MCP protocol servers
│   └── dashboard/      Three.js preview UI
├── storage/        Persistence abstraction
├── demos/          Example builders (Chair, Table, Person, etc.)
└── tests/          Test suites
```
