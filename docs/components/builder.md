# Builder Engine

The core of Procedurable — parses YAML definitions and executes them into traced geometry.

## Components [exists]

| Class | Role |
|-------|------|
| `TracedBuilder` | Execution engine — wraps every decision, measurement, and geometry call with tracing |
| `YamlBuilderParser` | Translates YAML structure to TracedBuilder API calls |
| `ExpressionService` | Unified expression evaluation — bridges MathService with builder context |
| `SharedContext` | Key-value store for cross-builder communication |

## TracedBuilder

The heart of the system. Every builder execution goes through this class.

### Decision Methods

```typescript
// Choice from options with optional weights
decide(name, { options, weights? }) → selected option

// Numeric value in range
decideNumber(name, { min, max }) → number

// Integer count in range
decideCount(name, { min, max }) → integer
```

Every call is:
1. Checked for an active override (agent/human pinned this value)
2. If no override, resolved via SeededRandom (deterministic)
3. Recorded in the trace with: name, type, value, seed, source

### Measurement Methods

```typescript
// Define a dimension with optional variation
defineMeasurement(name, { base, variation? }) → number

// Reference a previously defined measurement
getMeasurement(name) → number
```

### Geometry Methods

```typescript
createBox(width, height, depth) → Mesh
createSphere(radius, segments) → Mesh
createCircleLoop(radius, segments) → EdgeLoop
createRectLoop(width, depth) → EdgeLoop
loftLoops(loops[], options) → Mesh         // connect loop rings into surface
extrude2D(shape, height) → Mesh
lathe(profile, segments) → Mesh
sweep(profile, path, segments) → Mesh
subdivideMesh(mesh, levels) → Mesh
mergeMeshes(meshes[]) → Mesh
transformMesh(mesh, matrix) → Mesh
```

### Composition

```typescript
compose(name, builderName, options) → TracedOutput
// Loads and executes another builder with overrides
// SharedContext passes parent decisions to child
```

### Output

```typescript
build() → TracedOutput {
  mesh: Mesh,
  decisions: TracedDecision[],
  measurements: TracedValue[],
  traces: TraceEntry[],
  validation: ValidationResult,
  metadata: { name, seed, duration, triangleCount }
}
```

## YamlBuilderParser

Translates YAML sections into TracedBuilder calls:

| YAML Section | Maps To |
|-------------|---------|
| `decisions:` | `decide()`, `decideNumber()`, `decideCount()` |
| `measurements:` | `defineMeasurement()` |
| `derived:` | `ExpressionService.evaluateNumeric()` |
| `geometry:` (steps) | Geometry creation methods |
| `compose:` | `compose()` — recursive builder execution |
| `placement:` | Placement engine (around, along, fill) |
| `quality:` | [planned] Quality target declaration |

### YAML Geometry Steps

```yaml
geometry:
  - create_loop:
      name: seat_profile
      type: rectangle
      width: $seat_width
      depth: $seat_depth

  - extrude:
      name: seat
      loop: seat_profile
      height: $seat_thickness
      cap: both

  - transform:
      target: seat
      translate: { y: $seat_height }
```

Each step references named intermediates. The parser resolves `$variable` references to decisions, measurements, or derived values.

## Target State Additions

| Capability | Status | Impact |
|------------|--------|--------|
| Builder creation via DSL [B4] | Planned | Agents create new builders without file editing |
| Builder templates/scaffolding | Planned | Start from proven patterns, not blank YAML |
| Conditional geometry (`if:` blocks in YAML) | Planned | Different decisions → different geometry paths |
| Loop constructs (`repeat:` in YAML) | Planned | Array-based geometry (slats, spindles, teeth) |
| Modifier application in YAML (`modifiers:` section) | Planned | Subdivision, bevel as non-destructive stack |
| Quality declaration in YAML (`quality:` section) [A1] | Planned | Builder states its target tier |
