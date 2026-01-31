# Storage

Persistence abstraction for builder definitions and assets.

## Architecture [exists]

```
StorageProvider (interface)
  │
  ├── FileSystemStorage   [exists]  — reads/writes builders/ directory
  └── S3Storage           [planned] — cloud-compatible storage
```

### Interface

```typescript
interface StorageProvider {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
  exists(key: string): Promise<boolean>
}
```

### What's Stored

Currently: YAML builder files in `builders/` directory.

```
builders/
├── DiningChair.yaml
├── Table.yaml
├── Vase.yaml
├── Gear.yaml
└── ...
```

## DSL Commands [exists]

| Command | Effect |
|---------|--------|
| `storage.list` | List all stored builder files |
| `storage.get <name>` | Read a builder's YAML |
| `storage.save <name> <content>` | Write/update a builder |
| `storage.delete <name>` | Remove a builder |
| `storage.exists <name>` | Check if builder exists |

## Target State Additions

| Capability | Status | Purpose |
|------------|--------|---------|
| Scene description files (.psd.yaml) | Planned [B2] | Store complete scene compositions |
| World metadata store | Planned [B3] | Persistent domain knowledge (separate from builder files) |
| Asset versioning | Planned | Track builder evolution over time |
| Asset tagging/search | Planned | Find builders by domain, quality tier, tags |
