# Where We're Headed

The target state is a platform where **writing new TypeScript is rare**. Agents author 3D content by:

1. Querying accumulated domain knowledge
2. Composing YAML builders from existing geometry components
3. Validating against automated quality gates
4. Iterating through the DSL, not through code

## What "Done" Looks Like

### For an Agent

An agent receives a request: "Create a bookshelf." It:

1. **Queries knowledge** — `world.get furniture.shelving.*` returns standard dimensions, material norms, style attributes
2. **Scaffolds a builder** — `builder.create BookShelf template=shelving` generates a YAML skeleton with domain-appropriate decisions and measurements
3. **Adds geometry** — using existing components (extrude for planks, lathe for decorative elements, sweep for molding) via DSL commands or YAML editing
4. **Validates** — `quality.validate BookShelf tier=2` returns specific pass/fail results
5. **Iterates** — fixes failures, re-validates
6. **Stores learnings** — `world.set furniture.shelving.lessons "..."`

**No TypeScript written.** All authoring happens through the YAML format and DSL commands.

### For the Platform

The platform provides:

| Capability | Components | Status |
|------------|-----------|--------|
| Geometry creation | Extrude, Lathe, Sweep, Subdivision, 2D Booleans, Bevel | Partial → Full |
| Geometry modification | ModifierStack (subdivision, bevel, deformers) | Planned → Built |
| Material assignment | Named slots, PBR-ready, resolver pipeline | Minimal → Full |
| Quality enforcement | Tier-specific gates, decision coverage, sophistication plans | Basic → Automated |
| Agent authoring | Builder creation via DSL, templates, knowledge queries | File-only → DSL-native |
| Scene composition | Placement modes, scene description format, spatial queries | Partial → Full |
| Knowledge persistence | World metadata store, source attribution | None → Persistent |
| Export | glTF with materials, hierarchy, UVs | OBJ only → glTF |

## The Four Tracks

### Track A: Quality & Standards

**Goal:** Agents know what "good" means and can measure it.

| Story | What It Delivers |
|-------|-----------------|
| A1: Quality Declaration | `quality:` YAML section. Builders state target tier and gaps. |
| A2: Quality Gates | Automated Tier 1/2 validation. `quality.validate` returns actionable pass/fail. |
| A3: Decision Coverage | Tests that every decision option changes the mesh. Flags decorative decisions. |
| A4: Sophistication Plans | Format for planning tier upgrades. Reusable across similar builders. |

### Track B: Platform Components

**Goal:** Infrastructure for agent-native authoring.

| Story | What It Delivers |
|-------|-----------------|
| B1: Consolidation | Fix text glyph holes, complete placement primitives, gear demo |
| B2: Scene Description (PSD) | Serializable scene format. Save/load/export complete compositions. |
| B3: World Metadata | Persistent KV store. Agents accumulate and query domain knowledge. |
| B4: Builder Authoring via DSL | Create and edit builders through commands, not file editing. |

### Track C: Foundational Geometry

**Goal:** Platform geometry tools sufficient for Tier 2+ content.

| Story | What It Delivers |
|-------|-----------------|
| C1: 2D Booleans | Union/subtract/intersect polygons. Unblocks text holes, gear profiles. |
| C2: Bevel & Chamfer | Edge treatment. Single biggest visual quality improvement. |
| C3: Material Slots | Named regions instead of vertex colors. Multi-material support. |
| C4: UV Generation | Automatic texture coordinates. Required for texturing and glTF. |
| C5: Deformers | Bend, twist, noise displacement. Organic variation. |
| C6: glTF Export | Standard 3D interchange format with materials and hierarchy. |

### Track D: Domain Demos

**Goal:** Prove the platform works by rebuilding key builders at Tier 2.

| Story | What It Proves |
|-------|---------------|
| D1: DiningChair Tier 2 | Core furniture workflow, quality gates, multi-material |
| D2: Vase Tier 2 | Lathe workflow, surface variation, deformers |
| D3: Gear Tier 2 | 2D boolean workflow, mechanical precision |
| D4: Furnished Room | Full composition: multiple builders + placement + scene export |

## Dependency Map

```
A1 (quality YAML) ─► A2 (gates) ─► A3 (coverage) ─► A4 (plans)
                       │
B1 (consolidation) ─► B2 (PSD) ─► B3 (metadata) ─► B4 (DSL authoring)
                       │
C1 (2D bool) ─► C2 (bevel) ─► C3 (materials) ─► C4 (UVs) ─► C5 (deform) ─► C6 (glTF)
                 │                                              │
                 └──────────► D1 (Chair Tier 2) ◄──────────────┘
                              D2 (Vase Tier 2)
                              D3 (Gear Tier 2)
                              D1+D2+D3 ──► D4 (Furnished Room)
```

## Measuring Progress

Progress is measured by what agents **can do without writing TypeScript**:

| Milestone | Agent Can... | Requires |
|-----------|-------------|----------|
| M1 | Run existing builders, override decisions | [done] |
| M2 | Validate quality against Tier 2 criteria | A1 + A2 |
| M3 | Create new builders via DSL | B4 |
| M4 | Produce Tier 2 geometry (beveled, multi-material) | C2 + C3 |
| M5 | Save/load complete scenes | B2 |
| M6 | Accumulate domain knowledge | B3 |
| M7 | Export production-ready glTF | C4 + C6 |
| M8 | Author full scenes from knowledge without guidance | All tracks |
