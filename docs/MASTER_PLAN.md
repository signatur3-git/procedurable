# Master Plan - Procedurable

> **Version:** 2.0 (2026-01-31 revision)
> **Purpose:** Vision, strategy, and philosophy. The "why" and "what".
> **Tactical Work:** See `BACKLOG.md` for work items.
> **Supersedes:** Previous master plan (archived in git history).

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `BACKLOG.md` | Work items, stories, acceptance criteria |
| `FEASIBILITY_STUDY.md` | Honest assessment of what's achievable and when |
| `QUALITY_TIERS.md` | Quality level definitions and automated gates |
| `ARCHITECTURE.md` | System design and technical decisions |
| `PROBLEM_DOMAIN.md` | Target builders and their requirements |
| `SOLUTION_DOMAIN.md` | Geometry tools inventory and status |
| `AUTHORING_PROBLEM_DOMAIN.md` | Builder authoring challenges |
| `AUTHORING_SOLUTION_DOMAIN.md` | Authoring infrastructure inventory |
| `PROCEDURAL_TECHNIQUES.md` | Noise, patterns, layout algorithms |

---

## Vision

**Procedurable is a decision-driven procedural authoring platform.** Authors (human and AI agent) define "builders" -- procedural generators that make decisions the way a 3D artist would. The platform provides the foundational tools, quality standards, and feedback loops that let builders produce professional-quality digital assets.

### Core Principles

1. **Decisions are first-class.** Every style choice, proportion, material selection is a named, traceable, overridable decision. A builder without meaningful decisions is just a script.

2. **Quality has tiers.** Every builder declares its target quality tier and is held to measurable standards. "It renders" is not "it's done." See `QUALITY_TIERS.md`.

3. **Authoring, not rendering.** Procedurable authors decisions and structure. Renderers and engines consume the output. We are not building a 3D engine.

4. **Agents are authors.** The platform must give AI agents the same affordances as human authors: discovery, creation, structured feedback, and iteration.

5. **Deterministic and reproducible.** Same seed produces same result. Always.

---

## What Exists (Completed Infrastructure)

### Phase 1: Infrastructure (Complete)
- MCP server (4 tools, stable protocol)
- Authoring server (DSL commands, hot-reload, WebSocket)
- YAML builder format (decisions, measurements, derived, geometry, composition)
- Real-time dashboard (Three.js preview, seed browsing)
- Storage provider (filesystem, ready for S3)
- 29+ DSL commands, all tested

### Phase 2 Completed Milestones
- **Geometry primitives:** Box, sphere, loft, lathe, sweep, subdivide, extrude
- **Materials:** Vertex colors, named material library, conditional materials, map baking
- **Composition:** Compose, repeat, conditional, placement, instancing
- **World foundations:** Scalar fields, Poisson disk scatter, instancing, chunk contract
- **Authoring infra:** Expressions, error context, unified ExpressionService, webhooks
- **Agent layer:** Introspection, constraints, shared context, scene graph, validation (6/7)
- **2D shapes & extrusion:** Shape2D, Path2D (bezier support)
- **Text basics:** Font parsing, text-to-shape, procedural font

### Known Gaps in Completed Work
- P2-M2d-007 (goal-seeking primitives) not started
- ~~P2-M3b (architecture consolidation) not started~~ → **COMPLETED 2026-01-31**
- Text glyph holes (letters A, O, etc. don't subtract inner contours)
- Gear demo unfinished
- Decision coverage in existing builders is poor (decisions declared but don't affect geometry)

### Code Structure Reorganization (Completed 2026-01-31)

The codebase has been restructured from 10+ flat folders to 6 domain-organized groups:

```
src/
├── platform/     Core infrastructure (math, geometry, spatial, scene, materials, modifiers)
├── generation/   Content pipeline (builder, text, validation, export)
├── servers/      External interfaces (authoring, mcp, dashboard, knowledge)
├── storage/      Persistence layer
├── demos/        Example builders (not platform code)
└── tests/        Test suites
```

**Benefits:**
- Clear separation of infrastructure vs. engine vs. interfaces vs. examples
- Reduced cognitive load at top level (6 folders vs. 10+)
- Room for future components (modifiers/, knowledge/, export/)
- Dependencies flow cleanly: platform ← generation ← servers

See `CODE_STRUCTURE_EVALUATION.md` for full details.

---

## Phase 2 Revised: The Authoring Platform

> The old Phase 2 tried to build towards "PersonBuilder as capstone" through 10 sequential milestones (CSG, botanical, cloth, characters, renderer). The feasibility study showed this path is too long and too many layers are incomplete simultaneously.
>
> The revised Phase 2 focuses on making the **authoring platform itself excellent** -- quality enforcement, scene description, metadata, and the foundational geometry tools that make existing builder domains (furniture, vessels, signage, mechanical) produce professional-quality output.

### Track A: Quality & Standards

**Goal:** Agents and humans produce Tier 2+ builders by default, not Tier 1.

| Milestone | Purpose |
|-----------|---------|
| A1: Quality Declaration | Add `quality:` section to YAML format; retrofit existing builders |
| A2: Quality Gates | Automated tier validation in ValidationAPI; machine-readable suggestions for agent loop |
| A3: Decision Coverage | Verify every decision option produces different output |
| A4: Sophistication Plans | First-class format for planning builder quality before coding |

### Track B: Platform Components

**Goal:** New infrastructure that makes the authoring platform more capable, including inter-builder communication and negotiation.

| Milestone | Purpose |
|-----------|---------|
| B1: Foundation Cleanup | ~~Complete M3b consolidation~~✅, fix text holes, finish M2d-007 |
| B2: Scene Description Format | PSD v0.1 -- serializable scene graph with tags (aggregated), bounds, materials, spatial queries, summary views |
| B3: World Metadata Collector | Persistent knowledge store for agents (styles, rules, relationships) |
| B4: Builder Authoring via DSL | Agents create new YAML builders through DSL commands (not just file edits) |
| B5: Builder Negotiation | Attachment points, request/offer protocol, transition zone blending between builders |

### Track C: Foundational Geometry Tools

**Goal:** The missing tools that block Tier 2 quality in existing domains.

| Milestone | Purpose |
|-----------|---------|
| C1: 2D Booleans | Union/subtract/intersect 2D shapes (profiles, mechanical parts) |
| C2: Bevel & Chamfer | Edge treatment for hard-surface finish quality |
| C3: Material Slots | Named material regions (not just vertex colors) |
| C4: Basic UV Generation | Automatic UVs for lathe/sweep/extrude output |
| C5: Deformers | Bend/twist/noise displacement (breaks CG-perfect look) |
| C6: glTF Export | Get geometry into other tools and engines |
| C7: Symmetry Operations | Mirror, radial array, translational symmetry |

### Track D: Domain Demos (Quality Proof)

**Goal:** Rebuild key builders at Tier 2 quality to prove the platform works.

| Milestone | Purpose |
|-----------|---------|
| D1: DiningChair at Tier 2 | Back styles produce real geometry; edge treatment; multi-material |
| D2: Vase at Tier 2 | Profile variety; lip/foot detail; material variation |
| D3: Gear at Tier 2 | 2D boolean profiles; tooth geometry; mechanical precision |
| D4: Furnished Room at Tier 2 | Scene composition with quality-gated components |

### Track Dependencies

```
A1 ──→ A2 ──→ A3 ──→ A4
B1 ──→ B2 ──→ B3 ──→ B4
              B2 ──→ B5 (independent of B3/B4)
C1 ──→ C2 ──→ C3 ──→ C4 ──→ C5 ──→ C6
                                       C7 (independent, can start any time)

A2 + C2 ──→ D1 (need quality gates + bevel for Tier 2 chair)
A2 + C5 ──→ D2 (need quality gates + deformers for Tier 2 vase)
A2 + C1 ──→ D3 (need quality gates + 2D booleans for Tier 2 gear)
D1 + D2 ──→ D4 (composed scene needs quality components)
```

**Recommended execution order:**
1. A1 → B1 (quality declaration + cleanup -- immediate, no new code for A1)
2. A2 + C1 in parallel (quality gates + 2D booleans)
3. B2 + C2 in parallel (scene description + bevel)
4. D1 (prove chair at Tier 2)
5. Continue tracks as capacity allows

---

## Deferred Work (Not Forgotten)

These remain valid goals but are explicitly deferred until the authoring platform and foundational tools are solid.

| Area | Why Deferred | Prerequisite |
|------|-------------|--------------|
| 3D Boolean CSG | Complex, error-prone; only needed for architecture domain | C1 (2D booleans) proves the approach first |
| Botanical / L-Systems | Only needed for vegetation domain | C5 (deformers), scatter already works |
| Advanced Materials | Layer stacks, PBR, procedural textures | C3 (material slots), C4 (UVs) |
| Cloth & Soft Bodies | Only needed for characters | Deformers + patterns |
| Characters (PersonBuilder) | Capstone that needs everything | Nearly all of the above |
| Renderer Package | Deployment concern, not authoring | C6 (glTF export) |
| Animation & Physics | Phase 3 | Rigging foundations (vertex weights) |
| Style System | Composable styles (modifiers, role-based builder resolution, proportion rules) need B3 + B4 first | B3 (metadata), B4 (DSL authoring), B5 (negotiation for proportion constraints) |
| Morph Targets / Blend Shapes | Useful for characters and LOD blending but Phase 3 | C5 (deformers) as lightweight precursor |
| LOD / View-Dependent Generation | Scene-level tier selection based on camera distance | Track A (quality tiers), Track D (proves tiers work) |

---

## Agent Authoring Vision (Revised)

AI agents should be able to:

1. **Discover** -- List builders, query interfaces, understand variation axes
   - *Status: Built (system.list_builders, builder.get_interface)*

2. **Plan** -- Create sophistication plans before writing geometry; understand what quality tier is achievable with available tools
   - *Status: Not built (needs A4)*

3. **Create** -- Author new YAML builders through DSL commands or file edits; compose builders into scenes
   - *Status: Partially built (file edits work; DSL creation needs B4)*

4. **Evaluate** -- Run quality gates, check decision coverage, compare against sophistication plan
   - *Status: Not built (needs A2, A3)*

5. **Iterate** -- Fix quality gate failures, upgrade tier, accumulate domain knowledge
   - *Status: Not built (needs A2 + B3)*

6. **Accumulate** -- Store world metadata, style guides, builder relationships across sessions
   - *Status: Not built (needs B3)*

7. **Negotiate** -- Compose builders that adapt to each other: publish spatial requirements, receive offers from environment builders, declare attachment points and blend zones
   - *Status: Not built (needs B5)*

8. **Reason about scenes** -- Query large scenes hierarchically (overview → drill-down), compute spatial relationships, understand semantic roles without reading builder source
   - *Status: Not built (needs B2 enhancements: tag aggregation, summary queries, spatial queries)*

---

## Quality Rules (New)

These supplement the existing development rules:

1. **Every builder declares `quality.target_tier` and `quality.current_tier`.** No exceptions.
2. **Every decision must affect output.** Decision coverage testing enforces this.
3. **Tier 1 is not acceptable for committed builders.** Tier 0 is for prototyping only.
4. **Quality gates run automatically.** Failed gates block completion.
5. **Sophistication plans precede geometry.** Plan what each tier looks like before building.
6. **Agents must fix quality failures before declaring done.** Structured failure output is a TODO list, not a warning.

---

## Development Rules

1. **Follow the plan.** Don't add features not in the current tracks.
2. **Quality over features.** A Tier 2 chair is more valuable than Tier 1 everything.
3. **Fix bugs immediately.** But don't pivot the architecture.
4. **One milestone at a time per track.** Finish before starting the next.
5. **All DSL commands require tests.** No shipping untested commands.
6. **Expose before building.** DSL-expose built tools before writing new ones.
7. **Domain-driven tools.** Build tools by upgrading real builders, not in isolation.
8. **Document what's deferred.** Explicitly say what's not being built and why.

---

## Success Criteria (Phase 2 Revised)

Phase 2 is complete when:

1. All committed builders declare and meet Tier 2 quality
2. Quality gates run automatically and catch regressions
3. Decision coverage is >= 90% across all builders
4. PSD v0.1 format is defined and builders serialize to it
5. An agent can create a new builder from description and have it pass Tier 2 gates
6. glTF export works for at least furniture and vessel domains
7. At least one composed scene (furnished room) passes Tier 2 quality
