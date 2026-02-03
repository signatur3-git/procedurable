# Deferred Items and TODOs Summary

*Generated: 2026-02-06*

This document summarizes deferred items and TODOs that have been identified but not yet implemented. These are tracked for future development.

## Categories

### 1. UV Unwrapping (Deferred)

| Item | Location | Notes |
|------|----------|-------|
| Boolean UV re-projection | BACKLOG.md:916 | Re-project cut faces with planar projection based on face normal |
| Seam hints | BACKLOG.md:961 | `prefer_seam` and `avoid_seam` edge tags |
| YAML `post_process.unwrap:` section | BACKLOG.md:962 | For future UV control |
| Per-face UV islands or triplanar shaders | SESSION_SUMMARY_2026-02-03.md | Required for proper UV handling |

### 2. Materials and Textures (Deferred)

| Item | Location | Notes |
|------|----------|-------|
| YAML `generator:` section in material layers | BACKLOG.md:1061 | Deferred to G4-003 |
| YAML `materials.X.layers:` section | BACKLOG.md:1092 | Requires builder integration |
| Material layering (even simple 2-layer) | VISION_EXAMPLES.md:622 | Medium priority, currently deferred |

### 3. Decals (Deferred)

| Item | Location | Notes |
|------|----------|-------|
| YAML `decals:` section | BACKLOG.md:1124 | Requires builder integration |
| Decal DSL command | BACKLOG.md:1125 | - |
| Image loading for decals | BACKLOG.md:1126 | Requires asset system |
| World-space size for decals | BACKLOG.md:1153 | Requires projection integration |

### 4. Sophistication Plan (Implemented)

The sophistication plan system supports a `deferred` flag on tier sections:
- Location: `ValidationAPI.ts:465` (type definition)
- Location: `ValidationAPI.ts:555` (implementation - skips deferred tiers)
- Location: `SophisticationPlan.test.ts:197-231` (tests)

This allows builders to mark certain quality tiers as not yet implemented without failing validation.

## Known Gaps from SESSION_FINDINGS_2026-02-05.md

These gaps affect current builder capabilities:

| Gap | Impact | Workaround |
|-----|--------|------------|
| Loop geometry command | Medium | Use repeat with transform or manual placement |
| Auto-process composition | Medium | Manually invoke composed builders |
| String comparison in expressions | Low | Use `eq()` function instead of `==` |
| Inline profiles in lathe/sweep | Low | Define profiles in `profiles:` section |

## Next Steps

1. ~~**High Value**: Implement loop geometry command (unblocks H3-001 chessboard)~~ ✅ DONE (2026-02-06)
2. **Medium Value**: Auto-process composition section
3. **Lower Priority**: UV improvements, decal system, material layering

## Files to Monitor

When working on deferred items, these files are most relevant:
- `src/generation/builder/YamlBuilderParser.ts` - Main parser
- `src/generation/builder/YamlBuilderExecutor.ts` - Execution engine
- `src/generation/validation/ValidationAPI.ts` - Quality gates
- `docs/BACKLOG.md` - Feature tracking
