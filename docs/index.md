---
layout: home
hero:
  name: Procedurable
  text: Decision-Driven Procedural Authoring
  tagline: Target architecture reference for a platform where agents author 3D content through knowledge and builders
  actions:
    - theme: brand
      text: Component Map
      link: /components/overview
    - theme: alt
      text: Agent Workflow
      link: /agent-workflow
    - theme: alt
      text: Target State
      link: /target-state
features:
  - title: Decisions First
    details: Every geometric choice is a traceable, overridable decision. Seeds produce deterministic output. Overrides let agents and humans steer results without editing code.
  - title: YAML Builders
    details: Builders are declarative YAML files that compose decisions, measurements, geometry operations, and sub-builders. No imperative code required for authoring new content.
  - title: Quality Tiers
    details: Four quality tiers (Placeholder → Art-Directed) with automated validation gates. Agents know what "done" means at each level.
  - title: Agent-Native
    details: MCP protocol integration gives AI agents the same affordances as humans — discover, inspect, modify, validate, and accumulate knowledge.
---

# Platform Overview

Procedurable is a **decision-driven procedural authoring platform** for generating 3D content. It targets a workflow where:

1. **Knowledge** accumulates as reusable facts — measurements, style palettes, domain rules
2. **Builders** are declarative YAML definitions that consume knowledge and produce traced geometry
3. **Agents** (AI or human) discover, compose, and refine builders through a DSL — rarely writing code directly

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│         Consumers: AI Agents / Humans           │
├────────────────┬────────────────────────────────┤
│   MCP Server   │        Dashboard               │
│   (port 4242)  │        (port 3000)              │
├────────────────┴────────────────────────────────┤
│           Authoring Server (port 4200)           │
│           Command Parser → Namespaced Handlers   │
├─────────────────────────────────────────────────┤
│           Builder Engine                         │
│  YAML Parser → TracedBuilder → Geometry → Mesh   │
├─────────────────────────────────────────────────┤
│           Foundation                             │
│  Math · Spatial · Geometry · Text · Materials    │
├─────────────────────────────────────────────────┤
│           Infrastructure                         │
│  Storage · Validation · Export                   │
└─────────────────────────────────────────────────┘
```

The layers enforce a dependency rule: each layer may only depend on the layer directly below it. The **MCP server is intentionally thin and stable** — all capability extension happens in the Authoring Server's command handlers, which hot-reload.

## What Makes This Different

| Trait | How |
|-------|-----|
| **Deterministic** | Seeded RNG with fork-based hierarchy. Same seed + same overrides = identical output, always. |
| **Traceable** | Every vertex in the output mesh links back to the decision that created it. |
| **Composable** | Builders compose other builders. SharedContext + SceneGraph enable cross-builder coordination. |
| **Quality-gated** | Automated validation enforces minimum standards per quality tier. |
| **Agent-first** | The DSL is the primary interface. File editing is a fallback, not the norm. |
