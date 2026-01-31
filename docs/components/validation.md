# Validation & Quality

Automated assessment of builder output against quality standards.

## Current State [partial]

| Class | Purpose | Status |
|-------|---------|--------|
| `ValidationAPI` | Run all checks, produce assessment | [exists] — basic checks only |
| `MeshChecks` | Geometric validity (NaN, degenerate, bounds) | [exists] |
| `MeshValidation` | Proportionality, symmetry | [exists] — basic |

### What Works Today

```
builder.quality DiningChair
→ {
    checks: [
      { name: "no_nan_vertices", status: "pass" },
      { name: "no_degenerate_faces", status: "pass" },
      { name: "reasonable_bounds", status: "pass" },
      { name: "minimum_faces", status: "warning", detail: "only 48 faces" }
    ],
    overall: "pass"
  }
```

## Target State: Quality Tiers [planned — A2]

### YAML Quality Declaration [planned — A1]

Every builder declares its quality target:

```yaml
quality:
  target_tier: 2
  current_tier: 1
  tier_gaps:
    - "legs are rectangular prisms (need rounded cross-section)"
    - "no edge bevels"
    - "single material (need wood + fabric)"
```

This makes quality **explicit and trackable**. An agent can read the gaps and work toward closing them.

### Automated Quality Gates [planned — A2]

Tier-specific validation rules:

| Check | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Min faces per part | 4 | 6 | 12 |
| Min total triangles | 100 | 1,000 | 10,000 |
| Min distinct materials | 1 | 2 | 3 |
| Closed meshes | — | Required | Required |
| Edge bevels present | — | — | Required |
| UV coordinates | — | — | Required |
| Decision coverage | — | Required | Required |

### Decision Coverage Testing [planned — A3]

Verifies that each decision option produces **geometrically different** output:

```
Test: back_style decision
  - Run with back_style="solid"  → mesh hash A
  - Run with back_style="slat"   → mesh hash B
  - Run with back_style="ladder" → mesh hash C
  → All different ✓ (coverage: 100%)

Test: leg_count decision
  - Run with leg_count=3 → mesh hash D
  - Run with leg_count=4 → mesh hash E
  → All different ✓ (coverage: 100%)
```

If a decision exists but all options produce the same mesh, it's a **decorative decision** — flagged as a quality gap.

### Sophistication Plans [planned — A4]

A format for planning how to upgrade a builder from one tier to the next:

```yaml
# DiningChair_sophistication_plan.yaml
builder: DiningChair
current_tier: 1
target_tier: 2

steps:
  - action: "Replace rectangular leg extrusion with lathe of turned profile"
    decisions_affected: [leg_style]
    geometry_change: "legs gain 3D volume and round cross-section"

  - action: "Add seat cushion as separate mesh with subdivision"
    decisions_affected: [has_cushion, cushion_material]
    geometry_change: "new soft-body part on seat"

  - action: "Apply bevel modifier to all hard edges"
    decisions_affected: []
    geometry_change: "edges become rounded, realistic"

  - action: "Assign material slots: wood_frame, cushion_fabric"
    materials_change: "2 distinct materials minimum"
```

Agents use these plans to execute upgrades step-by-step.
