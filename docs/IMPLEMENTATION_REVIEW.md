# Implementation Review (What’s Solid vs Needs Revisit)

> **Purpose:** Evaluate what has been implemented so far and identify milestones that should be revisited because the
> implementation is too crude or misaligned with the overall concept.

---

## Implemented (Current State)

- **P2-M1b Expose Built Tools:** Lathe/Sweep/Subdivide are exposed with integration tests and documentation updates.【F:docs/BACKLOG.md†L68-L109】
- **P2-M2b Authoring Infrastructure:** Marked complete, though the epic status still mentions remaining steps in the
  header (see “Revisit” below).【F:docs/BACKLOG.md†L113-L118】
- **P2-M2c World Foundations:** Listed as complete in Quick Status.【F:docs/BACKLOG.md†L51-L58】
- **P2-M2d Agent Authoring Layer:** 6/7 items done per master plan (one item still pending).【F:docs/MASTER_PLAN.md†L73-L77】
- **P2-M3 2D Shapes & Extrusion:** Marked complete in Quick Status, but with an unfinished demo story (Gear).【F:docs/BACKLOG.md†L55-L58】【F:docs/BACKLOG.md†L1740-L1764】
- **P2-M4 Text & Advanced 2D:** Font integration and text-to-shape completed; Path2D is still in progress.【F:docs/BACKLOG.md†L1847-L1933】【F:docs/BACKLOG.md†L1936-L1967】

---

## Phase 1 Milestones Review (Infrastructure)

**Goal of Phase 1:** MCP server and authoring API stable at v1.0.0.【F:docs/MASTER_PLAN.md†L37-L49】

### What’s Implemented

- **DSL command system + tests:** The plan states 29+ tested commands as part of Phase 1 delivery, which indicates the
  core authoring surface is in place.【F:docs/MASTER_PLAN.md†L37-L49】
- **YAML builder format with expressions/decisions/composition:** Also listed as delivered, establishing the foundation
  for procedural authoring.【F:docs/MASTER_PLAN.md†L37-L49】
- **Real-time dashboard with mesh preview:** Included in Phase 1 deliverables, so the visualization loop exists.【F:docs/MASTER_PLAN.md†L37-L49】
- **Storage provider interface:** Listed as delivered, with filesystem support ready for S3.【F:docs/MASTER_PLAN.md†L37-L49】

### Phase 1 Items to Revisit (Quality / Alignment)

These are not necessarily missing, but worth validating against current Phase 2 needs:

1. **DSL/YAML command consolidation**
   - As Phase 2 expands, ensure command definitions remain centralized and are not duplicated across tools. This aligns
     with P2-M3b’s consolidation goals and should be checked before more authoring surfaces are added.【F:docs/BACKLOG.md†L1767-L1852】

2. **Dashboard vs. authoring flow consistency**
   - The dashboard is part of Phase 1 deliverables; verify that new geometry paths (Path2D, text) flow through the same
     visualization pipeline without bespoke handling. This avoids a split between “authoring” and “preview” paths.【F:docs/MASTER_PLAN.md†L37-L49】【F:docs/SYSTEM_FLOW.md†L8-L49】

3. **Storage provider readiness for new assets**
   - With fonts, materials, and future assets, confirm the storage interface supports loading external files consistently
     (not just filesystem) so Phase 2 text/material work doesn’t introduce one-off loaders.【F:docs/MASTER_PLAN.md†L37-L49】

---

## Milestones to Revisit (Crude or Misaligned)

1. **P2-M3 2D Shapes & Extrusion**
   - The epic is marked complete but the Gear demo story is still in progress; this is a gap in the “full pipeline”
     validation and suggests the milestone closure was premature.【F:docs/BACKLOG.md†L55-L58】【F:docs/BACKLOG.md†L1740-L1764】

2. **P2-M4 Text & Advanced 2D (Quality Gap)**
   - Current text pipeline only uses outer contours and does not subtract holes in glyphs (A, O, P, R, etc.), which is
     explicitly called out as a limitation. This is too crude for the typography goal and blocks high-quality signage
     and engraving workflows.【F:docs/BACKLOG.md†L1898-L1903】
   - Path2D bezier preservation is still in progress; without it, text curves are polygonized and lose fidelity.【F:docs/BACKLOG.md†L1936-L1967】
   - The milestone is explicitly blocked by P2-M3b consolidation, meaning the architecture/flow gaps should be addressed
     before further text sophistication.【F:docs/BACKLOG.md†L1847-L1852】

3. **P2-M2d Agent Authoring Layer (Completeness)**
   - The master plan shows 6/7 completed; the final item should be completed before the milestone is considered stable
     enough to support higher-level authoring workflows.【F:docs/MASTER_PLAN.md†L73-L77】

4. **P2-M2b Authoring Infrastructure (Status Inconsistency)**
   - The epic header still mentions “Steps 3-4 remaining” despite the epic being marked complete, indicating either a
     documentation inconsistency or unfinished work that needs clarification before layering more features.【F:docs/BACKLOG.md†L113-L118】

5. **P2-M3b Architecture & Flow Consolidation (Foundational Alignment)**
   - This is now a prerequisite for P2-M4 to prevent duplicated implementations and clarify ownership, so it must be
     completed before continuing text sophistication work.【F:docs/BACKLOG.md†L1767-L1852】

---

## Recommended Next Review Actions

- Confirm whether P2-M3 should remain “complete” before the Gear demo finishes.
- Decide whether P2-M2b’s remaining steps are real work or outdated status.
- Execute P2-M3b to create a shared flow map and service ownership policy before resuming P2-M4.
