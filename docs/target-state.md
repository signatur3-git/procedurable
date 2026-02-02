# Where We're Headed

The target state is a platform where **writing new TypeScript is rare**. Agents author 3D content by:

1. Querying accumulated domain knowledge
2. Composing YAML builders from existing geometry components
3. Validating against automated quality gates
4. Iterating through the DSL, not through code
5. Negotiating with environment builders for context-aware placement
6. Reasoning about scenes through semantic queries

## What "Done" Looks Like

### For an Agent

An agent receives a request: "Create a bookshelf." It:

1. **Queries knowledge** — `world.get furniture.shelving.*` returns standard dimensions, material norms, style attributes
2. **Scaffolds a builder** — `builder.create BookShelf template=shelving` generates a YAML skeleton with domain-appropriate decisions and measurements
3. **Adds geometry** — using existing components (extrude for planks, lathe for decorative elements, sweep for molding) via DSL commands or YAML editing
4. **Validates** — `quality.validate BookShelf tier=2` returns specific, machine-readable pass/fail results
5. **Iterates** — reads failure suggestions programmatically, fixes issues, re-validates
6. **Stores learnings** — `world.set furniture.shelving.lessons "..."` — iteration history auto-recorded

**No TypeScript written.** All authoring happens through the YAML format and DSL commands.

### For a Scene Composer

An agent receives a request: "Create a village on hilly terrain." It:

1. **Plans the scene** — queries knowledge for building types, terrain rules, spacing standards
2. **Creates individual builders** — house, road, bridge, tree — each with ports and requirements
3. **Composes with negotiation** — houses publish "I need flat ground"; terrain adapts; roads publish "I need a cut"; terrain carves road beds
4. **Blends boundaries** — where road meets terrain, blend zones generate smooth transitions
5. **Queries the result** — `scene.overview` gives a summary; `scene.distance house_1 river` checks proximity
6. **Validates holistically** — all builders pass Tier 2 gates; no overlapping geometry; style cascades consistently

### For the Platform

The platform provides:

| Capability | Components | Status |
|------------|-----------|--------|
| Geometry creation | Extrude, Lathe, Sweep, Subdivision, 2D Booleans, Bevel | Partial → Full |
| Geometry modification | Deformers, Symmetry (mirror, radial array) | Planned → Built |
| Material assignment | Named slots, PBR-ready, resolver pipeline | Minimal → Full |
| Quality enforcement | Tier-specific gates (machine-readable), decision coverage, sophistication plans | Basic → Automated |
| Agent authoring | Builder creation via DSL, templates, knowledge queries | File-only → DSL-native |
| Scene composition | Placement, PSD format, spatial queries, tag aggregation | Partial → Full |
| Builder negotiation | Attachment points, request/offer protocol, blend zones | None → Protocol |
| Knowledge persistence | World metadata, style definitions, iteration memory, source attribution | None → Persistent |
| Export | glTF with materials, hierarchy, UVs | OBJ only → glTF |

## The Four Tracks (+ new additions)

### Track A: Quality & Standards

**Goal:** Agents know what "good" means and can measure it.

| Story | What It Delivers |
|-------|-----------------|
| A1: Quality Declaration | `quality:` YAML section. Builders state target tier and gaps. **✅ Complete.** |
| A2: Quality Gates | Automated Tier 1/2 validation. Machine-readable suggestions agents can act on programmatically. **🟡 A2-001 done** (`evaluateQualityTier()`, `builder.quality` command, 11 tests). |
| A3: Decision Coverage | Tests that every decision option changes the mesh. Flags decorative decisions. |
| A4: Sophistication Plans | Format for planning tier upgrades. Reusable across similar builders. |

### Track B: Platform Components

**Goal:** Infrastructure for agent-native authoring and inter-builder communication.

| Story | What It Delivers |
|-------|-----------------|
| B1: Consolidation | ~~Fix text glyph holes, complete placement primitives~~ **✅ Complete.** Gear demo remains. |
| B2: Scene Description (PSD) | Serializable scene format with tag aggregation, summary/drill-down queries, spatial relationship queries. |
| B3: World Metadata | Persistent KV store. Style definitions. Iteration memory. Domain knowledge. |
| B4: Builder Authoring via DSL | Create and edit builders through commands, not file editing. |
| B5: Builder Negotiation | Attachment points (ports), request/offer protocol, transition zone blending. |

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
| C7: Symmetry Operations | Mirror and radial array. Essential for mechanical parts, styles, and natural forms. |

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
A1 ✅ ─► A2 🟡 (gates) ─► A3 (coverage) ─► A4 (plans)
                │
B1 ✅ ──► B2 (PSD) ─► B3 (metadata) ─► B4 (DSL authoring)
                │
                └──► B5 (negotiation)  [independent of B3/B4]
                │
C1 (2D bool) ─► C2 (bevel) ─► C3 (materials) ─► C4 (UVs) ─► C5 (deform) ─► C6 (glTF)
                 │                                              │
                 └──────────► D1 (Chair Tier 2) ◄──────────────┘
                              D2 (Vase Tier 2)
                              D3 (Gear Tier 2)
                              D1+D2+D3 ──► D4 (Furnished Room)

C7 (symmetry) — independent, can start any time
```

## Measuring Progress

Progress is measured by what agents **can do without writing TypeScript**:

| Milestone | Agent Can... | Requires |
|-----------|-------------|----------|
| M1 | Run existing builders, override decisions | **[done]** |
| M2 | Validate quality against Tier 2 criteria | A1 ✅ + A2 |
| M3 | Create new builders via DSL | B4 |
| M4 | Produce Tier 2 geometry (beveled, multi-material) | C2 + C3 |
| M5 | Save/load complete scenes, query them semantically | B2 |
| M6 | Accumulate domain knowledge and styles | B3 |
| M7 | Export production-ready glTF | C4 + C6 |
| M8 | Compose builders that negotiate with their environment | B5 |
| M9 | Apply symmetry, mirror, and radial patterns | C7 |
| M10 | Author full scenes from knowledge without guidance | All tracks |

## Deferred but Not Forgotten

These remain valid goals, explicitly deferred until foundations are solid:

| Area | Prerequisite | Vision Example |
|------|-------------|----------------|
| Style System (composable styles) | B3, B4, B5 | Scenes #9, #10 |
| LOD / View-Dependent Generation | Track A, Track D | Scenes #6, #7 |
| Morph Targets / Blend Shapes | C5 | Scene #4 |
| Procedural Textures | C3, C4 | Scene #5 |
| Characters (PersonBuilder) | Nearly everything | Scene #4 |
| 3D Boolean CSG | C1 | — |
| Botanical / L-Systems | C5 | — |
| Animation & Physics | Phase 3 | Scene #3 |

See `VISION_EXAMPLES.md` for the full set of 13 stress-test scenarios and 25 identified gaps.
