# Data Flow & Tracing

How data flows through the system and how every output is traceable.

## The Tracing Contract

Every vertex in a Procedurable mesh can answer: **"Why are you here?"**

```
Vertex at (0.21, 0.45, 0.19)
  ├── Created by: extrude step "seat"
  ├── Shape defined by: measurement "seat_width" = 0.42
  ├── Height set by: measurement "seat_height" = 0.45
  ├── Position influenced by: decision "seat_depth_ratio" = 0.9
  └── Seed: 42, fork: "seat"
```

This traceability is the foundation that makes agent-driven refinement possible. An agent can see that a proportion looks wrong, trace it to the responsible decision, and override it.

## TracedDecision

```typescript
interface TracedDecision {
  name: string           // "back_style"
  type: "choice" | "number" | "count"
  value: any             // "slat"
  options?: any[]        // ["solid", "slat", "ladder"]
  source: "random" | "override" | "default"
  seed: number           // RNG seed that produced this value
}
```

`source` tells you whether the value was:
- `random` — selected by SeededRandom
- `override` — pinned by agent or human
- `default` — fallback value

## TracedValue (Measurements)

```typescript
interface TracedValue {
  name: string           // "seat_height"
  value: number          // 0.45
  base: number           // 0.45
  variation?: number     // 0.02
  source: "computed" | "override"
}
```

## TraceEntry (Execution Log)

```typescript
interface TraceEntry {
  timestamp: number
  type: "decision" | "measurement" | "geometry" | "compose" | "placement"
  name: string
  detail: Record<string, any>
}
```

The trace is an ordered log of everything that happened during builder execution. Agents can replay this to understand cause and effect.

## Determinism Guarantee

```
Same YAML + Same Seed + Same Overrides = Identical Output
```

This is enforced by:
1. **SeededRandom** with fork-based hierarchy (no global state leaks)
2. **Deterministic expression evaluation** (no floating-point randomness)
3. **Ordered geometry steps** (YAML array = execution order)
4. **No external state** (builders don't read clocks, network, or filesystem)

Breaking determinism is a bug. Tests verify that re-running a builder produces byte-identical meshes.

## Override Flow

```
Agent: decision.override back_style ladder
  │
  ▼
Override Map (server session state)
  { "back_style": "ladder" }
  │
  ▼
Next builder.run:
  TracedBuilder.decide("back_style", ...)
    → checks override map first
    → finds "ladder"
    → returns "ladder" with source: "override"
    → SeededRandom NOT consumed (preserving RNG state for other decisions)
```

Overrides don't consume random numbers. This means overriding one decision doesn't change the values of other decisions — critical for stable iteration.
