# YamlBuilderParser Refactoring Analysis

> **Date:** 2026-02-01
> **Status:** Phase 1-4 COMPLETE (Registry Integrated!)
> **Impact:** Improves maintainability, testability, and separation of concerns

---

## Completed Work

### Phase 1: Extract Types ✅
- Created `YamlBuilderTypes.ts` (358 lines)
- Moved all YAML schema interfaces
- Backwards-compatible re-exports

### Phase 2: Extract Material Resolver ✅
- Created `MaterialResolver.ts` (144 lines)
- Moved color/material resolution functions
- `resolveColor()`, `resolveMaterials()`, `resolveGeometryColor()`, etc.

### Phase 3: Create Command Registry ✅
- Created `GeometryCommandHandler.ts` (103 lines) - base interface and registry
- Created `ProfileResolver.ts` (85 lines) - profile/spline resolution
- Created `commands/` directory with 14 handler files (15 handlers)
- Created `commands/index.ts` - exports and registry factory
- Added 8 unit tests for command handlers

### Phase 4: Extract Commands & Integrate Registry ✅
- **Registry integrated into `processGeometry()`** - commands dispatched via registry
- 15 command handlers extracted and working:
  - Primitives: box, vertex, circle, loop, face, loft, cap
  - Advanced: lathe, sweep, subdivide, bevel, radialArray
  - Control flow: when, if, repeat
- Only `extrude2d` remains inline (~500 lines, very complex)

### Results

| File/Directory | Lines | Purpose |
|----------------|-------|---------|
| YamlBuilderParser.ts | ~1,992 | Main parser with registry integration |
| YamlBuilderTypes.ts | 358 | Type definitions |
| MaterialResolver.ts | 144 | Material/color resolution |
| ProfileResolver.ts | 85 | Profile/spline resolution |
| GeometryCommandHandler.ts | 103 | Base handler + registry |
| commands/ (14 files) | ~650 | 15 command handlers |

### Command Handlers Extracted (Phase 4 in progress)

| Category | Handlers | Status |
|----------|----------|--------|
| **Primitives** | box, vertex, circle, loop, face, loft, cap | ✅ Done |
| **Advanced** | lathe, sweep, subdivide, bevel, radialArray | ✅ Done |
| **Control Flow** | when, if, repeat | ✅ Done |
| **Complex** | extrude2d (~500 lines) | ⬜ Pending |
| **Comment** | comment (trivial skip) | ⬜ Pending (inline) |

**All 414 tests passing** (406 original + 8 handler tests).

---

## Value Delivered

The refactoring has already delivered significant architectural improvements:

### 1. Separation of Concerns
- **Types** are now in their own file (YamlBuilderTypes.ts)
- **Material resolution** is isolated (MaterialResolver.ts)
- **Profile/Spline resolution** is isolated (ProfileResolver.ts)
- **Command handling** follows a clean pattern (GeometryCommandHandler.ts)

### 2. Testability
- Each command handler can be unit tested in isolation
- 8 new tests verify the handler pattern works
- Existing 406 tests validate no regressions

### 3. Extensibility
- Adding new commands is now straightforward: create handler, register in index
- The registry pattern is established and tested

### 4. Code Organization
- 14 command handler files in `commands/` directory
- ~700 lines of command logic extracted (though not yet integrated)
- Clear ownership: each command in its own file

---

## Remaining Work

### Phase 5: Registry Integration (Medium Effort)
Integrate the command registry into `processGeometry()`:
1. Import registry and create context adapter
2. Check registry first, fall back to inline for unextracted commands
3. Migrate extrude2d last (most complex)

### Phase 6: Parser/Executor Split (Optional)
Create separate `YamlBuilderExecutor.ts`:
1. Move 6-phase execution logic from parseAndExecuteBuilder
2. Keep YamlBuilderParser.ts for YAML-to-object conversion only
3. This provides cleaner architecture but is optional

---

## Current File Structure

```
src/generation/builder/
├── YamlBuilderParser.ts         # Main parser + executor (1,985 lines)
├── YamlBuilderTypes.ts          # Type definitions (358 lines)
├── MaterialResolver.ts          # Color/material resolution (144 lines)
├── ProfileResolver.ts           # Profile/spline resolution (85 lines)
├── GeometryCommandHandler.ts    # Base handler + registry (103 lines)
├── commands/
│   ├── index.ts                 # Registry factory + exports
│   ├── BoxCommand.ts            # box primitive
│   ├── VertexCommand.ts         # vertex placement
│   ├── CircleCommand.ts         # circle loop
│   ├── LoopCommand.ts           # rectangular loop
│   ├── FaceCommand.ts           # face creation
│   ├── LoftCommand.ts           # loft between loops
│   ├── CapCommand.ts            # cap loops
│   ├── LatheCommand.ts          # lathe/revolve
│   ├── SweepCommand.ts          # sweep along path
│   ├── SubdivideCommand.ts      # Catmull-Clark subdivision
│   ├── BevelCommand.ts          # edge beveling
│   ├── RadialArrayCommand.ts    # radial duplication
│   └── ControlFlowCommands.ts   # when, if, repeat
├── ExpressionService.ts         # Expression evaluation
├── SharedContext.ts             # Scene-level shared state
├── TracedBuilder.ts             # Core builder implementation
└── PSD.ts                       # Scene description format
│   ├── BevelCommand.ts
│   ├── RadialArrayCommand.ts
│   ├── RepeatCommand.ts
│   ├── ConditionalCommand.ts
│   └── index.ts                 # Exports all commands
├── MaterialResolver.ts          # Material resolution logic (NEW)
├── ProfileResolver.ts           # Profile/spline resolution (NEW)
├── ExpressionService.ts         # Already exists
├── TracedBuilder.ts             # Already exists
└── SharedContext.ts             # Already exists
```

### Separation of Concerns

| Module | Responsibility |
|--------|----------------|
| **YamlBuilderTypes.ts** | Type definitions only - no logic |
| **YamlBuilderParser.ts** | Parse YAML string → YamlBuilderDefinition |
| **YamlBuilderExecutor.ts** | Execute phases (decisions, measurements, derived, geometry, compose) |
| **GeometryCommandHandler.ts** | Base class + command registry |
| **commands/*.ts** | One file per command type, ~50-100 lines each |
| **MaterialResolver.ts** | Color/material resolution helpers |
| **ProfileResolver.ts** | Profile and spline resolution |

### Command Handler Pattern

```typescript
// GeometryCommandHandler.ts
export interface GeometryCommandContext {
  builder: TracedBuilder;
  decisionValues: Map<string, any>;
  materials: Map<string, RGBColor>;
  ctx: ParsingContext;
  processGeometry: ProcessGeometryFn; // For recursive calls
}

export interface GeometryCommandHandler {
  handles(cmd: YamlGeometryCommand): boolean;
  execute(cmd: YamlGeometryCommand, context: GeometryCommandContext): Promise<void>;
}

// Usage in Executor
const handlers: GeometryCommandHandler[] = [
  new BoxCommandHandler(),
  new BevelCommandHandler(),
  new LatheCommandHandler(),
  // ... etc
];

for (const cmd of commands) {
  const handler = handlers.find(h => h.handles(cmd));
  if (handler) {
    await handler.execute(cmd, context);
  }
}
```

### Benefits

1. **Testability** - Each command handler can be unit tested in isolation
2. **Maintainability** - Changes to one command don't risk breaking others
3. **Extensibility** - Adding new commands is trivial (just add a new handler)
4. **Clarity** - File names clearly indicate what code does
5. **Cognitive load** - No 1000+ line functions to understand

---

## Execution Plan

### Phase 1: Extract Types (Low Risk)
1. Create `YamlBuilderTypes.ts`
2. Move all interface/type definitions
3. Update imports in YamlBuilderParser.ts
4. Run tests to verify

### Phase 2: Extract Resolvers (Low Risk)
1. Create `MaterialResolver.ts`
2. Create `ProfileResolver.ts`
3. Move resolution functions
4. Update imports
5. Run tests to verify

### Phase 3: Create Command Registry (Medium Risk)
1. Create `GeometryCommandHandler.ts` base pattern
2. Create `commands/` directory
3. Extract one simple command (e.g., BoxCommand)
4. Verify pattern works
5. Run tests

### Phase 4: Extract All Commands (Medium Risk)
1. Extract remaining commands one by one
2. Each extraction followed by test run
3. Update processGeometry to use registry

### Phase 5: Split Parser/Executor (Medium Risk)
1. Create `YamlBuilderExecutor.ts`
2. Move execution logic from parseAndExecuteBuilder
3. Keep YamlBuilderParser.ts focused on parsing
4. Update all imports/callers
5. Full test suite

### Phase 6: Documentation & Cleanup
1. Update ARCHITECTURE.md
2. Update any affected docs
3. Final code review
4. Add refactoring to BACKLOG.md as completed

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing tests | Medium | High | Run tests after each small change |
| Missing edge cases | Low | Medium | Comprehensive test suite exists (400+ tests) |
| Import cycle issues | Medium | Medium | Careful dependency ordering |
| Time overrun | Medium | Low | Can stop at any phase - each is valuable |

---

## Estimated Effort

| Phase | Estimated Time | Value Delivered |
|-------|---------------|-----------------|
| Phase 1: Types | 30 min | Clean type separation |
| Phase 2: Resolvers | 30 min | Better organization |
| Phase 3: Command Pattern | 1 hour | Foundation for extensibility |
| Phase 4: Extract Commands | 2-3 hours | Main benefit - testable commands |
| Phase 5: Parser/Executor | 1 hour | Clear naming, proper SoC |
| Phase 6: Docs | 30 min | Up-to-date documentation |

**Total: ~5-6 hours of work**

---

## Recommendation

**Proceed with refactoring.** The benefits far outweigh the risks:
- 1,012-line function is a significant maintainability problem
- The command handler pattern is industry standard
- Good test coverage (400+ tests) provides safety net
- Each phase delivers incremental value

**Add to BACKLOG.md as B1-00x: YamlBuilderParser Refactoring** under Foundation Cleanup.
