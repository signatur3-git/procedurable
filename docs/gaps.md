# Gaps & Open Questions

Honest accounting of what's missing and what we're unsure about.

## Critical Gaps

These block the core vision of "agents author content without writing code."

### Gap 1: No Quality Gates

**Impact:** Agents produce Tier 1 output and don't know it's insufficient. There's no automated signal that says "this isn't done yet."

**Blocks:** Quality-driven iteration loop. Without gates, agents can't self-assess.

**Fix:** A2 (automated tier validation). Depends on A1 (quality YAML section).

### Gap 2: No 2D Booleans

**Impact:** Can't do polygon subtraction. Text with holes (A, O, P, etc.) renders incorrectly. Gear profiles can't be cut. Architectural openings impossible.

**Blocks:** Text domain, mechanical domain, architectural domain.

**Fix:** C1 (2D boolean implementation). This is the highest-priority geometry capability.

### Gap 3: No Bevel

**Impact:** Everything looks like a programmer made it. Sharp edges everywhere. Single biggest visual quality gap.

**Blocks:** Tier 2 quality for any builder.

**Fix:** C2 (bevel & chamfer). Depends on robust edge detection.

### Gap 4: No Builder Authoring via DSL

**Impact:** Agents must edit YAML files directly (via `storage.save`) instead of using structured commands. Error-prone, no validation during authoring.

**Blocks:** Fluid agent authoring loop.

**Fix:** B4 (builder authoring commands). Agents should be able to `builder.add_decision`, `builder.add_geometry_step`, etc.

### Gap 5: No Knowledge Persistence

**Impact:** Every agent session starts from zero. Domain insights are lost.

**Blocks:** Knowledge accumulation, consistent quality across sessions.

**Fix:** B3 (world metadata store).

## Significant Gaps

These affect quality and completeness but don't block the core workflow.

### Gap 6: No Material Slots

Vertex colors only. Can't assign proper materials, can't export with PBR, can't meet Tier 2 multi-material requirement.

**Fix:** C3. Moderate effort.

### Gap 7: No UV Coordinates

No texture mapping. Required for glTF export with textures.

**Fix:** C4. Depends on C3.

### Gap 8: No Scene Description Format

Can't save/load/export complete scenes. Composition is runtime-only.

**Fix:** B2. Moderate effort.

### Gap 9: No glTF Export

Only OBJ export (no materials, no hierarchy). Can't get results into other tools.

**Fix:** C6. Depends on C3, C4.

### Gap 10: No Deformers

No organic variation. Everything is mathematically perfect, which reads as fake.

**Fix:** C5. Significant effort.

## Open Questions

### Q1: How much YAML complexity is too much?

The YAML format keeps growing: decisions, measurements, derived, geometry, compose, placement, quality, modifiers, materials. At what point does YAML become harder to work with than TypeScript?

**Consideration:** The target audience is AI agents, not humans. Agents handle verbose structured formats well. But complex YAML is also harder to validate and harder to give good error messages for.

### Q2: Should the modifier stack be in YAML or in code?

Modifiers (subdivision, bevel, deformers) could be:
- YAML sections (consistent with everything-is-data philosophy)
- TypeScript modifier classes (more flexible, harder for agents)
- Both (YAML for declaration, code for implementation)

Current plan: YAML for declaration, platform provides implementations. But complex modifiers (lattice deformation) may need parameters that are awkward in YAML.

### Q3: How granular should world metadata be?

Should the knowledge store be flat keys (`furniture.chair.seat_height = 0.45`) or structured documents? Flat keys are simpler but can't represent complex relationships. Documents are more expressive but harder to query.

### Q4: When is a builder "done"?

Tier 2 is the Phase 2 target, but builders could always be better. Need clear criteria for "good enough to move on" that prevent both premature stopping and infinite polishing.

**Current answer:** A builder is done at its target tier when:
- All automated quality gates pass
- All decisions produce distinct geometry (100% coverage)
- At least 3 seeds produce acceptable output
- The quality declaration has no remaining `tier_gaps`

### Q5: Should composition be in the builder or in a separate scene file?

Currently, `compose:` lives inside builder YAML. But scene composition (place 4 chairs around a table) is conceptually different from object creation (build one chair). The planned PSD format (B2) separates these, but there's overlap.

### Q6: What's the right abstraction for placement?

Current: prescriptive (`place 4 chairs around this rectangle`).
Planned: goal-seeking (`seat everyone comfortably`).

Goal-seeking is more powerful but much harder to implement and debug. Is prescriptive placement sufficient for Phase 2?

**Tentative answer:** Yes. Prescriptive placement covers 80% of use cases. Goal-seeking is Phase 3.

### Q7: How do we handle builders that need fundamentally different geometry approaches?

A gear (profile extrusion) and a vase (lathe) and a room (architectural walls) use different geometry strategies. The YAML geometry steps currently treat all approaches equally, but some builders need capabilities others don't.

Is the current approach (all geometry types available to all builders) correct, or should there be builder "archetypes" that constrain available operations?

**Current answer:** Keep it flat. All operations available. Archetypes add complexity without clear benefit — agents already choose appropriate operations based on the object type.
