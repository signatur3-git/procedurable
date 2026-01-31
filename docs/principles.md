# Design Principles

These principles guide every architectural decision in Procedurable. When in doubt, refer back here.

## 1. Decisions Are First-Class

Every meaningful choice in a builder — shape, proportion, count, style — is an explicit `decision`. Decisions are:

- **Named** — `back_style`, `leg_count`, not anonymous random calls
- **Typed** — `choice`, `number`, `count`, each with constraints
- **Traceable** — output records which decision produced which geometry
- **Overridable** — agents and humans can pin any decision without editing the builder
- **Deterministic** — given the same seed, produce the same result

This is the core contract. Code that makes geometric choices outside of `decide()` is a bug.

## 2. YAML Over Code

Builders are YAML, not TypeScript. This means:

- Agents can author and modify builders through the DSL without writing code
- Builder definitions are data, parseable and transformable
- The set of available geometry operations is fixed at the platform level
- New capabilities come from new **platform components**, not new builder code

When an agent needs something the platform doesn't support, the answer is "extend the platform" (a component PR), not "write custom TypeScript in the builder."

## 3. Quality Is Measurable

Each builder declares its target quality tier. Automated gates validate:

- Mesh integrity (no degenerate faces, no NaN vertices)
- Minimum geometric complexity per tier
- Decision coverage (every option produces distinct geometry)
- Material assignment completeness

An agent can ask "is this builder Tier 2?" and get a yes/no with specific failures listed.

## 4. Composition Over Complexity

A dining scene is not one giant builder. It's:

- `DiningTable` builder
- `DiningChair` builder (composed N times via placement)
- `DiningScene` builder that composes both with SharedContext for style coordination

Each builder stays simple. Scene-level intelligence lives in composition and placement.

## 5. Knowledge Accumulates

Domain knowledge — standard furniture dimensions, style palettes, material properties — lives in a persistent metadata store, not hardcoded in builders. Agents query knowledge, builders reference it via expressions.

## 6. Thin Stable Shell, Rich Hot-Reloadable Core

The MCP server exposes 4 tools and rarely changes. The Authoring Server has 30+ commands and grows with every platform capability. This means agents always have a stable entry point, while the platform can evolve rapidly underneath.
