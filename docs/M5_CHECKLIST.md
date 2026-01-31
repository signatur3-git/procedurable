# M5 Checklist: Storage & YAML Builders

> Goal: Move builder definitions from TypeScript to YAML with storage abstraction

## Status: ✅ COMPLETE

**All furniture builders migrated to YAML:**
- ✅ Table.yaml (rectangular + round styles)
- ✅ DiningChair.yaml (full feature parity)
- ✅ DiningScene.yaml (composition with Table + 4 Chairs)
- ✅ Leg.yaml (sub-builder for composition)

**Only Person remains in TypeScript (Phase 2 - requires advanced geometry)**

**Infrastructure Complete:**
- MathService with mathjs for expressions (sin, cos, pi, etc.)
- `math.*` DSL commands for agent calculations
- `repeat` construct with index interpolation
- `if/else` blocks for conditional geometry
- YAML builder caching for composition support
- YAML priority over TypeScript when both exist

---

## Strict Acceptance Criteria

### Must Have (Required to close M5)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Expression engine: `sin`, `cos`, `pi` | ✅ | MathService using mathjs |
| Expression engine: negation `-var` | ✅ | mathjs handles this natively |
| `math.*` DSL commands | ✅ | eval, validate, functions, constants |
| `repeat` construct | ✅ | Working with index variable interpolation |
| `if/else` blocks | ✅ | Implemented for conditional geometry |
| Table: rectangular + round | ✅ | Both styles working in YAML |
| DiningChair: full features | ✅ | All back styles, leg styles, stretchers |
| DiningScene: composition | ✅ | Table + 4 chairs via YAML composition |
| YAML priority over TypeScript | ✅ | builder.open prefers YAML |
| TypeScript builders removable | ✅ | Only Person remains (Phase 2) |

### Deferred to Phase 2

| Criterion | Reason |
|-----------|--------|
| PersonBuilder YAML | Requires subdivision, lathe, advanced geometry |
| Dynamic chair count | DiningScene uses fixed 4 chairs (acceptable for M5) |

---

## YAML Builders in Production

| Builder | File | Features |
|---------|------|----------|
| Table | `builders/Table.yaml` | if/else for rect/round, composition with Leg |
| DiningChair | `builders/DiningChair.yaml` | All back styles, conditional stretchers |
| DiningScene | `builders/DiningScene.yaml` | Composes Table + 4 DiningChairs |
| Leg | `builders/Leg.yaml` | Round, square, tapered styles |

---

## Architecture Changes

1. **MathService** (`src/platform/math/MathService.ts`) - Centralized expression evaluation
2. **YAML Builder Cache** - Pre-loads Table, DiningChair for composition
3. **Source Tracking** - `activeBuilderSource` tracks yaml/typescript
4. **TYPESCRIPT_BUILDERS reduced** - Only Person remains

---

## Exit Criteria - ALL MET ✅

1. ✅ YAML builders can be loaded and executed
2. ✅ Expression engine supports trig functions
3. ✅ `repeat` construct for iterative geometry
4. ✅ `if/else` blocks for conditional geometry
5. ✅ Table works for rectangular AND round styles
6. ✅ DiningScene composes Table + Chairs from YAML
7. ✅ TypeScript DiningChair, Table, DiningScene imports removed from server
8. ✅ Only Person remains in TypeScript (explicitly deferred)
