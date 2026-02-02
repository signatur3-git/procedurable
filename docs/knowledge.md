# Knowledge System

How domain knowledge accumulates and is consumed by builders.

## The Problem

Without persistent knowledge, every agent session starts from zero. An agent that learns "dining chairs should have seats at 0.45m" loses that insight when the session ends. The next agent hardcodes 0.45 in the YAML instead of knowing *why*.

## Knowledge Layers

### Layer 1: Builder Definitions [exists]

YAML files are themselves a form of knowledge — they encode what decisions exist, what ranges are valid, and how geometry is constructed.

```yaml
# This IS knowledge: a dining chair seat is 0.40-0.50m high
measurements:
  seat_height:
    base: 0.45
    variation: seat_height_var   # ±0.02
```

### Layer 2: Quality Declarations [exists — A1 complete]

The `quality:` section captures knowledge about what "good" looks like:

```yaml
quality:
  target_tier: 2
  tier_gaps:
    - "legs need rounded cross-section for realism"
```

All 20 production builders now have quality declarations with honest tier assessments, per-part breakdowns, and decision coverage stats. Average coverage is ~55% — a clear signal of where work is needed.

### Layer 3: World Metadata Store [planned — B3]

Persistent key-value store for domain facts that span builders:

```
furniture.dining.chair.seat_height = 0.45
furniture.dining.chair.seat_height.source = "ergonomics standard ISO 5970"
furniture.dining.chair.seat_height.range = [0.40, 0.50]

styles.modern.characteristics = ["clean lines", "minimal ornamentation", "mixed materials"]
styles.modern.materials.primary = ["oak", "walnut", "ash"]
styles.modern.materials.accent = ["steel", "brass", "black_metal"]

domains.furniture.standard_proportions.table_to_chair_ratio = 0.72
```

Agents query this before making decisions:

```
world.get furniture.dining.chair.seat_height
→ 0.45 (source: ergonomics standard ISO 5970)
```

### Layer 4: Sophistication Plans [planned — A4]

Knowledge about *how* to improve builders:

```yaml
# Learned: how to upgrade a chair from Tier 1 to Tier 2
steps:
  - "Replace rectangular legs with lathe of turned profile"
  - "Add bevel modifier to all edges"
  - "Assign separate material slots for frame and cushion"
```

These plans can be reused across similar builders.

### Layer 5: Iteration Memory [planned — extends B3]

Knowledge about what an agent *tried* and what worked, stored per-builder:

```
builders.BookShelf.iterations.1.action = "added slat back geometry"
builders.BookShelf.iterations.1.coverage_before = 60
builders.BookShelf.iterations.1.coverage_after = 85
builders.BookShelf.iterations.1.outcome = "success"

builders.BookShelf.iterations.2.action = "added noise displacement to shelves"
builders.BookShelf.iterations.2.outcome = "reverted — made shelves look warped, not weathered"
```

This lets future agents avoid repeating failed experiments and build on successful ones. Combined with builder snapshots (`builder.snapshot` / `builder.restore`), agents can safely experiment and roll back.

### Layer 6: Style Definitions [planned — extends B3]

Styles as composable knowledge — not just color palettes, but proportions, patterns, and decision defaults:

```yaml
# styles/mid_century_modern.yaml
name: mid_century_modern
characteristics:
  - tapered legs
  - organic curves
  - minimal ornamentation
  - mixed wood and fabric

decision_defaults:
  leg_style: tapered_round
  wood: walnut
  finish: oiled
  back_style: organic_curve

proportion_rules:
  - table_height / chair_seat_height: [1.15, 1.25]
  - leg_taper_ratio: [0.6, 0.8]

material_palette:
  primary: [walnut, teak, oak]
  accent: [linen, leather, wool]
  metal: [brass, copper]
```

When a builder is composed under a style, unset decisions inherit the style's defaults. This extends SharedContext with a style-aware fallback layer. See `VISION_EXAMPLES.md` Scenes #9 and #10 for full motivation.

## Knowledge Flow

```
Agent researches domain
  │ world.get furniture.dining.*
  ▼
Agent creates/edits builder
  │ Uses known measurements, proportions, style rules
  ▼
Builder runs + validates
  │ quality.validate reveals gaps (machine-readable suggestions)
  ▼
Agent fixes issues
  │ Learns what works and what doesn't
  ▼
Agent stores insights
  │ world.set furniture.dining.lessons "..."
  │ Iteration history auto-recorded
  ▼
Next agent benefits
  │ world.get furniture.dining.lessons
  │ Reads iteration history to avoid repeating mistakes
  └── Starts from accumulated knowledge, not zero
```

## Structured Domain Knowledge

Some domains need more than key-value lookups — they need *rules and constraints*:

- **Chess:** "No two pieces on the same square; pawns only on ranks 2-7"
- **Music notation:** "Beam grouping follows time signature; stems flip at the middle staff line"
- **Mechanical assemblies:** "Meshing gears must share tooth pitch; center distance = (r₁ + r₂)"

These are too complex for flat metadata. Options being explored:

1. **Constraint tables** in metadata — structured YAML documents with typed rules that builders can query and evaluate
2. **Domain helper functions** — TypeScript libraries for specific domains (chess position generator, gear parameter calculator) exposed as expression functions
3. **Builder-internal state** — using `derived:` values or collision detection to enforce constraints during geometry generation

The current plan (B3) starts with key-value metadata. Structured domain models will evolve from real builder needs — when a gear builder needs `gear_center_distance(module, teeth_a, teeth_b)`, that function gets added to the expression context and documented in metadata.

## Relationship to Builders

Builders should **reference** knowledge, not **duplicate** it:

```yaml
# Good: references world metadata
measurements:
  seat_height:
    source: world.furniture.dining.chair.seat_height

# Bad: hardcoded without attribution
measurements:
  seat_height:
    base: 0.45    # magic number, no source
```

The `source:` field (planned) in measurements links to world metadata entries, creating a traceable chain from vertex → measurement → domain knowledge → real-world standard.

## Relationship to Negotiation

Knowledge also flows *between* builders at composition time through the negotiation protocol (B5):

```
House builder publishes requirement:
  │ "I need a flat 10×12m pad"
  ▼
Terrain builder reads requirement, processes it:
  │ Flattens area, computes elevation + slope
  ▼
Terrain publishes offer:
  │ "Pad at elevation 42.3m, slope 2.1° east"
  ▼
House builder reads offer, adapts:
  │ Foundation follows the 2.1° slope
  └── All traced: "why is this house at 42.3m?" → terrain's offer
```

This is a different kind of knowledge — ephemeral, per-composition, spatial. But it follows the same principle: builders reference structured data rather than making assumptions.
