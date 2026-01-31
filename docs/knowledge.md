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

### Layer 2: Quality Declarations [planned — A1]

The `quality:` section captures knowledge about what "good" looks like:

```yaml
quality:
  target_tier: 2
  tier_gaps:
    - "legs need rounded cross-section for realism"
```

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

## Knowledge Flow

```
Agent researches domain
  │ world.get furniture.dining.*
  ▼
Agent creates/edits builder
  │ Uses known measurements, proportions, style rules
  ▼
Builder runs + validates
  │ quality.validate reveals gaps
  ▼
Agent fixes issues
  │ Learns what works and what doesn't
  ▼
Agent stores insights
  │ world.set furniture.dining.lessons "..."
  ▼
Next agent benefits
  │ world.get furniture.dining.lessons
  └── Starts from accumulated knowledge, not zero
```

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
