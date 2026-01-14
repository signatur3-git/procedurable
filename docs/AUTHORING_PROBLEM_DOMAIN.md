# Authoring Problem Domain

> What a builder author (programmer) needs to accomplish when creating procedural content generators.

This document complements `PROBLEM_DOMAIN.md` (artist perspective) by focusing on the **programmer's perspective** - the challenges and requirements of authoring builders that generate content procedurally.

---

## Core Authoring Challenges

### 1. Expressing Variability

**Problem:** How do we define what can vary and by how much?

| Challenge | Description | Example |
|-----------|-------------|---------|
| **Discrete choices** | Select from finite options | Wood type: oak, walnut, cherry |
| **Continuous ranges** | Values within bounds | Height: 0.7m - 0.9m |
| **Conditional variation** | Vary based on other decisions | Stretchers only if legs are round |
| **Correlated variation** | Multiple values that should vary together | Taller chair → deeper seat |
| **Weighted randomness** | Some options more likely than others | 70% rectangular, 30% round tables |
| **Hierarchical decisions** | Parent decisions affect child options | Chair style → available back styles |

---

### 2. Maintaining Constraints

**Problem:** How do we ensure generated content is valid/plausible?

| Challenge | Description | Example |
|-----------|-------------|---------|
| **Structural integrity** | Parts connect properly | Legs reach the floor |
| **Spatial constraints** | Objects don't overlap | Chairs around table |
| **Proportional relationships** | Parts scale together | Arm height relative to seat |
| **Domain rules** | Domain-specific validity | Doors must be passable height |
| **Physical plausibility** | Looks like it could exist | Center of mass over base |
| **Style consistency** | Parts match aesthetically | Same wood type throughout |

---

### 3. Composition & Reuse

**Problem:** How do we build complex things from simple parts?

| Challenge | Description | Example |
|-----------|-------------|---------|
| **Part libraries** | Reusable component builders | Leg builder used by chair, table, stool |
| **Parameter passing** | Parent controls child behavior | Scene passes style to furniture |
| **Override inheritance** | Child can override parent defaults | Chair overrides default leg height |
| **Placement/arrangement** | Position parts relative to each other | Legs at corners of seat |
| **Instance variation** | Same part with different params | 4 legs, each slightly different |
| **Recursive composition** | Builders that use themselves | Tree branches → smaller branches |

---

### 4. Debugging & Inspection

**Problem:** How do we understand what a builder did and why?

| Challenge | Description | Example |
|-----------|-------------|---------|
| **Decision tracing** | See what was decided and why | "leg_style = round (random, seed 42)" |
| **Measurement tracing** | See computed values | "seat_height = 0.45m (ergonomic standard)" |
| **Geometry tracing** | Link mesh parts to source | "vertex 42 from seat_corner_bl" |
| **Validation errors** | Identify problems | "Non-manifold edge at vertices 12-15" |
| **Reproducibility** | Same seed → same output | Deterministic RNG |
| **Diff/comparison** | See what changed between seeds | Seed 1 vs Seed 2 differences |

---

### 5. Iteration & Refinement

**Problem:** How do we evolve builders over time?

| Challenge | Description | Example |
|-----------|-------------|---------|
| **Hot reload** | See changes without restart | Edit YAML → instant preview |
| **Version control** | Track builder history | Git-friendly format |
| **Migration** | Update old builders to new format | Schema v1 → v2 |
| **A/B testing** | Compare builder versions | Old chair vs new chair |
| **Regression detection** | Catch unintended changes | "Seat height changed unexpectedly" |

---

### 6. Performance & Scale

**Problem:** How do we generate content efficiently?

| Challenge | Description | Example |
|-----------|-------------|---------|
| **Batch generation** | Many instances quickly | 1000 chairs for crowd scene |
| **LOD generation** | Multiple detail levels | High/medium/low poly versions |
| **Caching** | Reuse computed results | Same leg geometry shared |
| **Lazy evaluation** | Compute only what's needed | Skip invisible parts |
| **Parallelization** | Multiple cores | Generate trees in parallel |

---

### 7. Integration & Export

**Problem:** How do we use generated content in other tools?

| Challenge | Description | Example |
|-----------|-------------|---------|
| **Format export** | Standard 3D formats | glTF, FBX, OBJ |
| **Metadata export** | Semantic information | Socket positions, collision shapes |
| **Material mapping** | Map to target renderer | Procedural → PBR textures |
| **Animation data** | Rigging, keyframes | Skeleton for character |
| **Runtime generation** | Generate in game/app | Procedural city in Unity |

---

## Missing-but-Critical for “Artist-like” and “Nature-like” Generation

### A. Generate → Evaluate → Revise (Artist iteration loop)
Artists rarely produce a final mesh in one shot. They iterate:

1. Generate a draft
2. Evaluate against goals (style, plausibility, composition)
3. Revise (tweak parameters, change structure, retry)

This implies we need authoring support for:
- **Scoring** (objective functions; soft constraints)
- **Search** (multi-run optimization: hill-climb, genetic algorithms, simulated annealing)
- **Comparisons** (side-by-side, diff across seeds/overrides)

### B. Multi-pass / multi-resolution workflows
Nature and artists both work in layers:

- **Structure pass:** coarse layout (terrain ridges, city blocks, room graph)
- **Realization pass:** concrete geometry and materials
- **Decoration pass:** props, details, wear
- **Simulation/history pass:** erosion, growth, settling, damage

This strongly suggests that for larger domains we will generate intermediate representations
(layout graphs, fields, heightmaps), not only meshes.

### C. Fields as a universal abstraction
World-scale generation needs values “everywhere” in space:

- Height field (terrain)
- Moisture/temperature (biomes)
- Density masks (forest vs meadow)
- Flow fields (wind, rivers, hair direction)

A builder author needs to create and combine **scalar** and **vector fields**, then sample them
to drive generation.

### D. Determinism by coordinate (not just by seed)
To generate whole worlds from a single seed, authors need deterministic functions of space:

- `height(x,z)`
- `biome(x,z)`
- `spawnPoints(bounds)`

This is different from “run builder with seed once.” It requires queryable, coordinate-based generation.

---

## Builder Complexity Levels

### Level 1: Single Object, Fixed Structure
- One mesh output
- Decisions affect dimensions/style only
- No composition
- Example: Simple vase

### Level 2: Single Object, Variable Structure  
- One mesh output
- Decisions affect topology/part count
- Conditional geometry
- Example: Chair with optional stretchers

### Level 3: Composed Object
- Multiple sub-builders
- Parent passes parameters to children
- Deterministic arrangement
- Example: Table with 4 legs

### Level 4: Scene/Arrangement
- Multiple independent objects
- Spatial constraints
- Variable count
- Example: Dining scene

### Level 5: Recursive/Generative
- Self-referential builders
- L-systems, fractals
- Depth limits
- Example: Tree with branches

### Level 6: Simulation-Driven
- Physics/behavior simulation
- Baked results
- Example: Cloth drape, crowd layout

### Level 7: Streaming/World Generation (Queryable)
- World divided into regions/chunks
- Deterministic coordinate-based seeding
- Generate-on-demand and cache/evict
- Multiple LODs
- Example: Infinite terrain + roads + towns

### Level 8: The Agent Author (NEW)

> **The Problem:** An AI agent, unlike a human, is "blind." It cannot see the dashboard or intuitively grasp the purpose of a builder. It operates purely on the structured data it receives. If the system only provides a final mesh, the agent has no way to understand what it created, whether it's "good," or how to improve it.

### The Agent's Core Questions

For an agent to become an effective author, it must be able to answer these fundamental questions programmatically:

1.  **"What can I build?"** (Discoverability)
    - What builders are available (`DiningChair`, `Table`)?
    - What are the parameters and valid ranges for a given builder? (`style: [modern, rustic]`, `height: range(0.4, 0.6)`)

2.  **"What did I just build?"** (Introspection & Semantics)
    - Is this a single object or a scene with multiple parts?
    - What are the functional components of what I made? (e.g., this is a `leg`, this is a `seat`).
    - Where are these components located in space?

3.  **"Is it any good?"** (Validation & Quality)
    - Does the object meet its functional requirements? (e.g., Is the chair stable? Is the table flat?)
    - Does the scene composition make sense? (e.g., Are the chairs correctly placed around the table without intersecting?)
    - Does it adhere to aesthetic or style guidelines?

4.  **"How do I achieve a goal?"** (Intent & Goal-Seeking)
    - How do I place chairs *around* a table, not just at `(x,y,z)` coordinates?
    - How do I add clutter *onto* a surface?
    - How do I make a "more modern" version of this chair?

### The Gap
The current system is excellent at executing low-level geometry commands. However, it lacks the high-level semantic layer that an agent needs to bridge the gap between "make a box" and "author a high-quality, functional, and aesthetically pleasing dining scene." This level defines the problem of creating that semantic bridge.

---

## Builder Author Personas

### Persona A: Technical Artist
- Comfortable with YAML/JSON
- Understands 3D math basics
- Wants visual feedback
- Prefers declarative over imperative

### Persona B: Tool Programmer
- Writes TypeScript builders
- Implements new geometry operations
- Extends the authoring system
- Needs good APIs and docs

### Persona C: AI Agent
- Generates builders from descriptions
- Needs simple, predictable DSL
- Benefits from bulk operations
- Requires clear error messages

---

## Success Metrics for Authoring

| Metric | Description | Target |
|--------|-------------|--------|
| **Time to first builder** | How long to create a working builder | < 30 minutes |
| **Lines per feature** | Code/YAML needed for a decision | < 5 lines |
| **Debug time** | Time to find why output is wrong | < 5 minutes |
| **Reuse rate** | % of code shared between builders | > 50% |
| **Error clarity** | Can author fix error from message alone | > 80% |
| **World determinism** | Same seed + coords → same outputs | 100% |
| **Locality** | Generating a chunk doesn’t require whole world | Yes |

---

## Current Gaps (What We're Missing)

| Gap | Impact | Priority |
|-----|--------|----------|
| No visual builder editor | Authors work in text only | Medium |
| Limited constraint system | Only placement, no general constraints | High |
| No builder versioning | Can't track/compare versions | Low |
| No batch generation API | One-at-a-time only | Medium |
| No builder templates | Start from scratch each time | Medium |
| Limited error context | Errors don't point to YAML line | High |
| No builder testing framework | No automated validation | Medium |
| No field system | Hard to do terrain/biomes/scatter coherently | High |
| No search/optimization loop | Hard to simulate “artist iteration” | Medium |
| No streaming world contract | Hard to scale beyond scenes | High |

---

## Related Documents

- `PROBLEM_DOMAIN.md` - Artist perspective (what to build)
- `SOLUTION_DOMAIN.md` - Artist tools (how to build geometry)
- `AUTHORING_SOLUTION_DOMAIN.md` - Programmer tools (how to author builders)
- `AUTHORING_ALIGNMENT_MATRIX.md` - Feature prioritization

