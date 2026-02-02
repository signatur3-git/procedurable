# Gaps & Open Questions

Honest accounting of what's missing and what we're unsure about.

> **Updated:** 2026-02-03 (Phase 2 complete)

## Critical Gaps — Resolved in Phase 2 ✅

These gaps previously blocked the core vision. All were resolved in Phase 2.

### Gap 1: ~~No Quality Gates~~ — Resolved ✅

**Impact:** ~~Agents produce Tier 1 output and don't know it's insufficient.~~

**Resolution:** A2 complete. `evaluateQualityTier()` checks Tier 0/1/2 gates, returns machine-readable `QualityGateSuggestion` objects. Decision coverage testing (A3) and sophistication plans (A4) also complete.

### Gap 2: ~~No 2D Booleans~~ — Resolved ✅

**Impact:** ~~Can't do polygon subtraction. Text with holes renders incorrectly.~~

**Resolution:** C1 complete. Union/subtract/intersect polygons work. Text holes, gear profiles, and architectural openings all supported.

### Gap 3: ~~No Bevel~~ — Resolved ✅

**Impact:** ~~Everything looks like a programmer made it. Sharp edges everywhere.~~

**Resolution:** C2 complete. Bevel and chamfer operations available on all geometry.

### Gap 4: ~~No Builder Authoring via DSL~~ — Resolved ✅

**Impact:** ~~Agents must edit YAML files directly.~~

**Resolution:** B4 complete. Template generation, section editing, and sophistication-guided creation all via DSL commands.

### Gap 5: ~~No Knowledge Persistence~~ — Resolved ✅

**Impact:** ~~Every agent session starts from zero.~~

**Resolution:** B3 complete. MetadataStore with domain knowledge (furniture dimensions, style palettes, material properties).

## Significant Gaps — Resolved in Phase 2 ✅

### Gap 6: ~~No Material Slots~~ — Resolved ✅

**Resolution:** C3 complete. Named PBR-ready material slots with per-face assignment.

### Gap 7: ~~No UV Coordinates~~ — Resolved ✅

**Resolution:** C4 complete. Automatic UV generation (box, lathe, sweep, extrude).

### Gap 8: ~~No Scene Description Format~~ — Resolved ✅

**Resolution:** B2 complete. PSD v0.1 with serialization, tag aggregation, spatial queries, overview/drill-down.

### Gap 9: ~~No glTF Export~~ — Resolved ✅

**Resolution:** C6 complete. glTF 2.0 with geometry, materials, UVs, scenes, and instances.

### Gap 10: ~~No Deformers~~ — Resolved ✅

**Resolution:** C5 complete. Noise, bend, twist, and taper deformers.

### Gap 11: ~~No Symmetry Operations~~ — Resolved ✅

**Resolution:** C7 complete. Mirror and radial array operations.

### Gap 12: ~~No Builder Negotiation~~ — Resolved ✅

**Resolution:** B5 complete. Attachment points (ports), request/offer protocol, transition zone blending via loft.

## Remaining Gaps — Phase 3 Targets

## Remaining Gaps — Phase 3 Targets

### Gap 13: No Style System

Styles (Art Deco, Mid-Century Modern, Industrial) can't be applied as composable concerns. No mechanism for style-conditional decision defaults, role-based builder resolution, or cross-builder proportion rules.

**Phase 3 Fix:** Track F (F1 executable constraints, F2 style definitions, F3 role-based composition). See `VISION_EXAMPLES.md` Scenes #9 and #10.

### Gap 14: No Rigging / Animation Data

Exported models are static geometry only. No skeleton, weights, or morph targets for animation.

**Phase 3 Fix:** Track E (E1 skeleton declaration, E2 vertex weights, E3 morph targets, E4 glTF skeleton export).

### Gap 15: No Terrain Generation

No height field mesh generation. Terrain must be authored as flat geometry.

**Phase 3 Fix:** G1 (height field mesh with chunk-aligned tiling, pad flattening via B5 negotiation).

### Gap 16: No LOD System

No view-dependent generation or level-of-detail selection. All geometry is full resolution.

**Phase 3 Fix:** G2 (LOD-conditional composition, distance-based tier selection).

### Gap 17: No Procedural Textures

Materials are flat colors only. No wood grain, stone variation, or patina patterns.

**Phase 3 Fix:** G3 (UV-space noise evaluation, material layering with blend modes and masks).

## Gaps Identified from Vision Examples

`VISION_EXAMPLES.md` contains 13 stress-test scenarios that revealed 25 specific gaps. Many were resolved in Phase 2:

| Gap | Status | Resolution |
|-----|--------|------------|
| Tag aggregation in PSD | ✅ Resolved | B2-003 complete |
| Summary/paginated scene queries | ✅ Resolved | B2-003 complete |
| Spatial relationship queries | ✅ Resolved | B2-003 complete |
| Machine-readable gate suggestions | ✅ Resolved | A2 complete |
| Structured domain models | ⬜ Phase 3 | F1 executable constraints |
| Morph targets / blend shapes | ⬜ Phase 3 | E3 morph target system |
| Procedural textures | ⬜ Phase 3 | G3 procedural textures |

See `VISION_EXAMPLES.md` Gap Inventory for the complete list of 25 gaps with severity ratings and priority recommendations.

## Open Questions

### Q1: How much YAML complexity is too much?

The YAML format keeps growing: decisions, measurements, derived, geometry, compose, placement, quality, ports, requirements, offers, blend_zones. At what point does YAML become harder to work with than TypeScript?

**Consideration:** The target audience is AI agents, not humans. Agents handle verbose structured formats well. But complex YAML is also harder to validate and harder to give good error messages for.

### Q2: Should the modifier stack be in YAML or in code?

Modifiers (subdivision, bevel, deformers) could be:
- YAML sections (consistent with everything-is-data philosophy)
- TypeScript modifier classes (more flexible, harder for agents)
- Both (YAML for declaration, code for implementation)

Current plan: YAML for declaration, platform provides implementations. But complex modifiers (lattice deformation) may need parameters that are awkward in YAML.

### Q3: How granular should world metadata be?

Should the knowledge store be flat keys (`furniture.chair.seat_height = 0.45`) or structured documents? Flat keys are simpler but can't represent complex relationships. Documents are more expressive but harder to query.

**Evolving answer:** Start with flat keys (B3). Add structured domain models when real builders need them — e.g., gear parameter calculators, chess position generators. Let demand drive complexity.

### Q4: When is a builder "done"?

Tier 2 is the Phase 2 target, but builders could always be better. Need clear criteria for "good enough to move on" that prevent both premature stopping and infinite polishing.

**Current answer:** A builder is done at its target tier when:
- All automated quality gates pass
- All decisions produce distinct geometry (100% coverage)
- At least 3 seeds produce acceptable output
- The quality declaration has no remaining `tier_gaps`

### Q5: Should composition be in the builder or in a separate scene file?

Currently, `compose:` lives inside builder YAML. But scene composition (place 4 chairs around a table) is conceptually different from object creation (build one chair). The planned PSD format (B2) separates these, but there's overlap.

### Q6: How should builder negotiation ordering work?

The negotiation protocol (B5) needs builders to execute in phases: publish requirements → resolve → generate. The simplest approach uses explicit composition ordering (compose terrain last so it sees all requirements). But this puts ordering burden on the scene author.

**Options being explored:**
- Explicit ordering (simple, transparent, scene author decides)
- `role: environment` tag that auto-defers generation (more magic, less burden)
- True multi-pass execution (most flexible, biggest architecture change)

Current plan: start with explicit ordering, evolve if it becomes limiting.

### Q7: How do we handle builders that need fundamentally different geometry approaches?

A gear (profile extrusion) and a vase (lathe) and a room (architectural walls) use different geometry strategies. The YAML geometry steps currently treat all approaches equally, but some builders need capabilities others don't.

Is the current approach (all geometry types available to all builders) correct, or should there be builder "archetypes" that constrain available operations?

**Current answer:** Keep it flat. All operations available. Archetypes add complexity without clear benefit — agents already choose appropriate operations based on the object type.
