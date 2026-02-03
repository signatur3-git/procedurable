# Changelog

All notable changes to the Procedurable MCP API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-14

### 🎉 Initial Stable Release

First stable release of the Procedurable MCP API.

### Added

#### Core Infrastructure
- **MCP Server** (`npm run mcp:http`) - HTTP/SSE transport for Copilot integration
- **Authoring Server** (`npm run authoring`) - DSL command execution engine
- **Dashboard** (`npm run dev`) - Visual builder preview with 3D rendering

#### DSL Command Namespaces

| Namespace | Commands | Description |
|-----------|----------|-------------|
| `system` | version, ping, help, status | System info and health checks |
| `builder` | list, open, run, mesh, measurements, decisions, traces, trace | Builder management |
| `measurement` | list, get, set, reset, reset-all | Measurement inspection/override |
| `decision` | list, get, override, reset, reset-all | Decision inspection/override |
| `storage` | list, get, save, delete, exists | YAML builder storage |
| `math` | eval, validate, functions, constants | Expression evaluation |

#### YAML Builder System
- Full YAML builder definition format
- Expression engine with MathService (sin, cos, pi, etc.)
- Control flow: `repeat` and `if/else` constructs
- Composition: Sub-builder nesting with overrides
- Pre-loading cache for nested composition

#### Migrated Builders (TypeScript → YAML)
- `Table.yaml` - Rectangular and round dining tables
- `DiningChair.yaml` - Full-featured dining chair
- `DiningScene.yaml` - Table with 4 chairs composition
- `Leg.yaml` - Reusable furniture leg component

### Documentation
- `docs/DSL_COMMANDS.md` - Complete command reference
- `docs/DEPRECATION_POLICY.md` - API stability guarantees
- `docs/YAML_BUILDER_FORMAT.md` - YAML schema specification
- `docs/MCP_SETUP.md` - Integration setup guide

### Testing
- 29 integration tests covering all DSL commands
- Run with: `npm run test:integration`

---

## [Unreleased] - Phase 3 Progress

### Fixed

#### Texture Baking & Preview (2026-02-23)
- **Multi-material normals**: `bakeTexturesPerMaterial` no longer overwrites smooth-group-aware normals with flat per-face normals — `analyzeMesh` now called with `writeNormalsToMesh: false` in the per-material path
- **`extrude2DWithBevel` UVs**: Beveled extrusions now generate UV coordinates (perimeter-based U for sides, planar for caps) and smooth group assignments (sides=1, front cap=2, back cap=3), matching the behaviour of `extrude2DWithHoles`
- **`Extrude2DCommand` vertex conversion**: Main extrude path now propagates `uvs` and `smoothGroups` from `ExtrudedGeometry` to `Mesh` vertices (were silently dropped before)
- **UV atlas overflow for radial arrays**: `repackExistingUVs` detects and deduplicates near-identical UV islands (within 1% bounds tolerance) before packing — prevents repeated instances (e.g. gear teeth) from stacking at origin and rendering black in texture preview
- **Dashboard multi-material UV normalisation**: Per-slot UV bounds sidecar (`.json`) written alongside baked textures; dashboard loads and applies per-slot normalisation so each material's atlas region maps correctly to its baked texture
- **Dashboard multi-material normals**: Renderer now uses the builder's smooth-group-aware normals from `meshData.normals` instead of falling back to `computeVertexNormals()`, which produced flat faceted shading on non-indexed triangle soup

### Added

#### Track E: Rigging & Animation (Complete)
- **E1**: Skeleton declaration in YAML builders - joint hierarchies with rest poses
- **E2**: Vertex weight system with proximity, region, and gradient rules
- **E3**: Morph target support with named vertex offset sets
- **E4**: glTF skeleton export with skins, joints, and morph targets

#### Track F: Knowledge & Style System (In Progress)
- **F1-001**: Constraint schema system - expression, unique, range, reference rules
- **F1-002**: Constraint integration with builders - validation during execution
- **F1-003**: Built-in constraint libraries (COMPLETE):
  - `constraints/mechanical/gear_mesh` - gear meshing validation
  - `constraints/spatial/no_overlap` - AABB non-intersection
  - `constraints/spatial/clearance` - minimum distance validation
  - `constraints/music/time_signature` - musical time signature rules
  - `constraints/chess/valid_position` - chess position legality
- New DSL command: `constraint.load <metadata_key>` - load constraints from metadata
- **F2-001**: Style schema and resolution (COMPLETE):
  - `StyleDefinition` interface with decision_defaults, material_palette, proportion_rules
  - `StyleResolver` for loading and caching styles from metadata
  - Style DSL commands: `style.list`, `style.get`, `style.preview`, `style.define`
  - `$style.<property>` expression syntax in ExpressionService
  - Decision resolution order: override > style default > builder default > random
  - TracedBuilder integrated with style defaults for all decision types
  - YamlBuilderExecutor loads style and applies defaults before decision phase
  - Upgraded style metadata (modern, rustic, industrial) to F2-001 format
  - 28 tests covering style loading, TracedBuilder integration, and executor integration
- **F2-002**: Style cascading in composition (COMPLETE):
  - Parent style propagates to children via `__style__` override
  - Child can override parent style with `compose: { style: 'other' }`
  - SharedContext tracks active style for cascading
  - 3 tests for cascading behavior
- **F2-003**: Style-driven material theming (COMPLETE):
  - Materials can use `role: primary_wood` instead of explicit colors
  - Role resolved from style's `material_palette`
  - Fallback to `fallback_color` or explicit `color` when role not in palette
  - PBR properties (roughness, metalness) inherited from style palette
  - Same builder with different styles produces different material colors
  - 11 tests for material theming

#### Track F: Role-Based Composition (In Progress)
- **F3-001**: Builder Role Registry (COMPLETE):
  - `BuilderRoleRegistry` maps (role, style?) → builder_name with priority
  - Role definitions stored in `metadata/builders/roles/`
  - Resolution order: exact style match > default candidate
  - YamlComposition supports `role:` as alternative to `builder:`
  - DSL commands: `builder.register_role`, `builder.list_roles`, `builder.resolve_role`, `builder.role_info`
  - 17 tests for registration and resolution
- **F3-002**: Role-based scene templates (COMPLETE):
  - DiningRoom.yaml template using only roles (table, seating x4, decoration)
  - Style at scene level cascades to all role compositions
  - decoration role added to metadata
  - 6 tests for role resolution with different styles

#### Track F: Cross-Builder Constraints (In Progress)
- **F4-001**: Cross-builder proportion rules (COMPLETE):
  - `ProportionRuleEvaluator` evaluates proportion rules spanning siblings
  - Rules reference measurements via `builder_name.measurement` paths
  - Automatic evaluation after composition in YamlBuilderExecutor
  - `psd.check_proportions style=<name>` DSL command
  - Warnings/errors added to validation issues
  - 18 tests for rule evaluation
- **F4-002**: Assembly metadata / connections (COMPLETE):
  - `PSDConnection` interface for non-spatial relationships
  - `connections:` section in YAML builder format
  - TracedBuilder.addConnection() and getConnections()
  - Connections serialized to PSD scene
  - `psd.connections` DSL command
  - 7 tests for assembly connections

### Track G: World & Scene Capabilities (In Progress)

#### G1: Height Field Mesh
- **G1-001**: Terrain mesh generation (COMPLETE):
  - `MeshOperations.createHeightFieldMesh()` generates grid mesh from height function
  - Proper UVs (planar projection), smooth normals, triangulation
  - Building pad flattening with optional falloff blending
  - YAML `terrain:` geometry command with noise parameters
  - FBM-based terrain using ScalarField infrastructure
  - 12 tests for terrain generation

#### Track H: Demos
- **H1-001**: HybridCreature demo - pegasus (horse body + eagle wings) with rigging

### Changed
- `constraint.evaluate` now checks metadata store if schema not in memory
- `constraint.get` checks both in-memory and metadata sources

---

## [1.0.0] - 2026-01-14 (Phase 1)

### 🎉 Initial Stable Release

First stable release of the Procedurable MCP API.

### Planned for Future
- Track F2-F4: Style definitions, role-based composition, cross-builder constraints
- Track G: World capabilities (terrain, LOD, textures)
- Track H2-H5: Additional demos (styled room, chess board, village, textured furniture)

