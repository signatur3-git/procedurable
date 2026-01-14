# Deployment & Storage Architecture

> Separating authoring, storage, and rendering for flexibility

## The Problem

Currently we assume:
- Running in dev mode with file system access
- Builders are TypeScript files in the workspace
- Assets stored locally
- Single-user, single-machine

This won't scale to:
- Multiple users collaborating
- Production deployment (no file system access)
- Asset libraries shared across projects
- Separate authoring and rendering deployments

---

## Deployment Modes

### 1. Local Dev Mode (Current)
```
┌─────────────────────────────────────────────────────────────┐
│  Developer Machine                                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ MCP Server  │  │ Authoring   │  │ Dashboard           │ │
│  │ (4242)      │──│ Server      │──│ (browser)           │ │
│  └─────────────┘  │ (4200)      │  └─────────────────────┘ │
│                   └──────┬──────┘                          │
│                          │                                  │
│                   ┌──────▼──────┐                          │
│                   │ File System │                          │
│                   │ ./builders/ │                          │
│                   │ ./assets/   │                          │
│                   └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

- Files stored in workspace
- Hot-reload via `tsx watch`
- Full authoring capabilities
- Agent has file system access

### 2. Production Authoring Mode
```
┌─────────────────────────────────────────────────────────────┐
│  Cloud / Server                                             │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ MCP Server  │  │ Authoring   │  │ Dashboard           │ │
│  │ (public)    │──│ Server      │──│ (CDN-hosted SPA)    │ │
│  └─────────────┘  │ (API)       │  └─────────────────────┘ │
│                   └──────┬──────┘                          │
│                          │                                  │
│                   ┌──────▼──────┐                          │
│                   │ S3-Compatible│                          │
│                   │ Storage      │                          │
│                   │ - builders/  │                          │
│                   │ - assets/    │                          │
│                   │ - baked/     │                          │
│                   └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

- Builders stored as JSON/YAML definitions (not TypeScript)
- Assets in S3-compatible storage (MinIO, AWS S3, Cloudflare R2)
- Baked textures cached in storage
- Multiple users can connect
- Agent connects via MCP over HTTPS

### 3. Renderer-Only Mode (Future)
```
┌─────────────────────────────────────────────────────────────┐
│  Game / App Runtime                                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Renderer (no authoring)                                 ││
│  │ - Loads builder definitions from URL/bundle             ││
│  │ - Executes builders with seeds                          ││
│  │ - Renders meshes + materials                            ││
│  │ - No MCP, no dashboard, no editing                      ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│                   ┌──────▼──────┐                           │
│                   │ CDN / Bundle│                           │
│                   │ - builders/ │                           │
│                   │ - assets/   │                           │
│                   └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

- No authoring server, no MCP
- Builders loaded from CDN or bundled
- Minimal runtime footprint
- For games, demos, embedded apps

---

## Storage Abstraction

### Interface

```typescript
interface StorageProvider {
  // Builder definitions
  listBuilders(): Promise<BuilderInfo[]>;
  getBuilder(name: string): Promise<BuilderDefinition>;
  saveBuilder(name: string, def: BuilderDefinition): Promise<void>;
  deleteBuilder(name: string): Promise<void>;
  
  // Assets (textures, grunge maps, etc.)
  listAssets(prefix: string): Promise<AssetInfo[]>;
  getAssetUrl(path: string): Promise<string>;  // Signed URL for S3
  uploadAsset(path: string, data: Buffer): Promise<void>;
  deleteAsset(path: string): Promise<void>;
  
  // Baked outputs (cached textures, mesh maps)
  getBaked(builderName: string, seed: number, type: string): Promise<Buffer | null>;
  saveBaked(builderName: string, seed: number, type: string, data: Buffer): Promise<void>;
  invalidateBaked(builderName: string): Promise<void>;  // When builder changes
}
```

### Implementations

```typescript
// Local file system (dev mode)
class FileSystemStorage implements StorageProvider {
  constructor(private basePath: string) {}
  // Read/write to ./builders/, ./assets/, ./baked/
}

// S3-compatible (production)
class S3Storage implements StorageProvider {
  constructor(private config: S3Config) {}
  // Use AWS SDK or MinIO client
}

// In-memory (testing)
class MemoryStorage implements StorageProvider {
  private builders = new Map<string, BuilderDefinition>();
  private assets = new Map<string, Buffer>();
}

// Hybrid (read from S3, write locally for dev)
class HybridStorage implements StorageProvider {
  constructor(
    private remote: StorageProvider,
    private local: StorageProvider
  ) {}
}
```

---

## Builder Definition Format

For production storage, builders must be **data, not code**:

```yaml
# builders/DiningChair.yaml
name: DiningChair
version: "1.0.0"
description: "Standard dining chair with seat, legs, and back"

measurements:
  seat_width:
    default: 0.45
    min: 0.35
    max: 0.55
    unit: meters
    description: "Width of the seat"
  seat_depth:
    default: 0.40
    min: 0.35
    max: 0.45
    unit: meters
  # ... more measurements

decisions:
  leg_style:
    options: [straight, tapered, turned]
    weights: [1, 2, 1]
    description: "Style of chair legs"
  back_style:
    options: [slat, solid, spindle]
    weights: [1, 1, 1]
  # ... more decisions

materials:
  seat: WornWood
  legs: WornWood
  back: WornWood

steps:
  # Geometry generation steps
  - loop.create seat_top rect width=$seat_width depth=$seat_depth
  - loop.extrude seat_top distance=-$seat_thickness cap=true
  - vertex.create leg_bl at=$seat_inset_bl
  # ... more steps
```

### Migration: TypeScript → YAML

Current TypeScript builders (like `ChairBuilder.ts`) would be:
1. Kept for complex logic during development
2. "Exported" to YAML for production storage
3. YAML builders executed by a generic interpreter

```typescript
// Development: TypeScript builder
export function buildDiningChair(options: BuildOptions): TracedOutput {
  const builder = new TracedBuilder('DiningChair', options.seed);
  // ... imperative code
}

// Production: YAML executed by interpreter
const output = executeBuilderDefinition(yamlDef, seed, overrides);
```

---

## Asset Organization

```
storage/
├── builders/
│   ├── furniture/
│   │   ├── DiningChair.yaml
│   │   ├── DiningTable.yaml
│   │   └── Bookshelf.yaml
│   ├── people/
│   │   ├── Person.yaml
│   │   ├── Head.yaml
│   │   └── Body.yaml
│   └── props/
│       ├── Plant.yaml
│       └── Vase.yaml
│
├── assets/
│   ├── grunge/
│   │   ├── dirt_01.png
│   │   └── scratches_01.png
│   ├── patterns/
│   │   ├── wood_grain_oak.png
│   │   └── wood_grain_walnut.png
│   ├── normals/
│   │   ├── wood_grain_normal.png
│   │   └── fabric_normal.png
│   └── materials/
│       ├── WornWood.yaml
│       └── RustyMetal.yaml
│
└── baked/
    ├── DiningChair/
    │   ├── seed_42/
    │   │   ├── mesh.glb
    │   │   ├── albedo.png
    │   │   ├── roughness.png
    │   │   └── normal.png
    │   └── seed_43/
    │       └── ...
    └── ...
```

---

## Configuration

```yaml
# config/storage.yaml

# Local development
dev:
  provider: filesystem
  basePath: ./storage
  watch: true  # Hot-reload on file changes

# Production
prod:
  provider: s3
  endpoint: https://s3.example.com
  bucket: procedurable-assets
  region: us-east-1
  credentials:
    accessKeyId: ${S3_ACCESS_KEY}
    secretAccessKey: ${S3_SECRET_KEY}

# Testing
test:
  provider: memory
```

```typescript
// Load config based on NODE_ENV
const storage = createStorage(config[process.env.NODE_ENV || 'dev']);
```

---

## Authoring vs Rendering Split

### Why Split?

| Authoring Server | Renderer |
|------------------|----------|
| Full DSL interpreter | Builder executor only |
| MCP integration | No MCP |
| WebSocket for live updates | No real-time updates |
| Dashboard UI | Minimal or no UI |
| Storage write access | Storage read-only |
| Heavy dependencies | Lightweight |

### Package Structure

```
packages/
├── @procedurable/core
│   ├── TracedBuilder.ts      # Core builder infrastructure
│   ├── BuilderDefinition.ts  # YAML/JSON schema
│   └── BuilderExecutor.ts    # Execute definitions
│
├── @procedurable/storage
│   ├── StorageProvider.ts    # Interface
│   ├── FileSystemStorage.ts
│   ├── S3Storage.ts
│   └── MemoryStorage.ts
│
├── @procedurable/authoring
│   ├── server.ts             # Authoring server
│   ├── command-parser.ts     # DSL parser
│   ├── commands/             # DSL handlers
│   └── mcp/                  # MCP integration
│
├── @procedurable/renderer
│   ├── SceneRenderer.ts      # Three.js rendering
│   ├── MaterialBaker.ts      # Texture baking
│   └── MeshConverter.ts      # Geometry conversion
│
└── @procedurable/dashboard
    ├── App.vue               # Dashboard SPA
    └── components/
```

### Deployment Configurations

```yaml
# Authoring deployment (full)
services:
  authoring:
    packages:
      - @procedurable/core
      - @procedurable/storage
      - @procedurable/authoring
      - @procedurable/renderer
      - @procedurable/dashboard
    env:
      STORAGE_PROVIDER: s3
      MCP_ENABLED: true

# Renderer-only deployment (lightweight)
services:
  renderer:
    packages:
      - @procedurable/core
      - @procedurable/storage  # Read-only
      - @procedurable/renderer
    env:
      STORAGE_PROVIDER: s3
      STORAGE_READ_ONLY: true
      MCP_ENABLED: false
```

---

## Multi-Environment Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Local Dev      │     │  Staging        │     │  Production     │
│  (filesystem)   │────►│  (S3 bucket A)  │────►│  (S3 bucket B)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │ Author builders       │ Test with real        │ Serve to
        │ with agent            │ storage               │ end users
        │                       │                       │
        ▼                       ▼                       ▼
   Full authoring          Full authoring         Renderer-only
   + hot reload            (deployed)             (lightweight)
```

### Sync Commands

```bash
# Push local builders to staging
procedurable sync push --env staging

# Pull production builders to local for debugging
procedurable sync pull --env production

# Compare local vs staging
procedurable sync diff --env staging
```

---

## DSL Commands for Storage

```bash
# Storage operations
storage.list builders/furniture
storage.get builders/DiningChair.yaml
storage.put builders/DiningChair.yaml
storage.delete builders/OldChair.yaml

# Asset operations
asset.upload grunge/new_dirt.png from=/local/path/dirt.png
asset.list grunge/
asset.url grunge/dirt_01.png  # Get signed URL

# Environment operations
env.current                   # Show current storage provider
env.switch staging            # Switch to staging storage
env.sync push                 # Push local to current env
```

---

## Implementation Priority

### Phase 1 (M1-M2): Keep it simple
- File system storage only
- Builders as TypeScript (current)
- Single dev environment

### Phase 2 (M3): Storage abstraction
- Implement StorageProvider interface
- FileSystemStorage implementation
- Start using YAML builder definitions

### Phase 3 (M4): S3 support
- S3Storage implementation
- Asset upload/download
- Baked texture caching

### Phase 4 (M5+): Multi-environment
- Environment configuration
- Sync commands
- Renderer-only package

---

## Questions to Decide Later

1. **Versioning**: Should builders have version history? Git-like or database?
2. **Access Control**: Multi-user with permissions? Or single-user per deployment?
3. **Collaboration**: Real-time collaborative editing? Or lock-based?
4. **CDN**: Should baked assets be served via CDN? Cache invalidation?
5. **Offline**: Should renderer work offline with bundled builders?

