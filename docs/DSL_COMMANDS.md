# DSL Command Reference

> Procedurable Authoring API v1.0.0
> 
> This document describes all available DSL commands for the Procedurable authoring system.

## Overview

Commands are sent to the authoring server via HTTP POST to `/api/execute`:

```json
{
  "commands": [
    "builder.open DiningChair",
    "builder.run seed=42",
    "builder.measurements"
  ]
}
```

Response format:
```json
{
  "results": [
    { "command": "...", "status": "ok", "data": {...} },
    { "command": "...", "status": "error", "error": "..." }
  ]
}
```

---

## System Commands

System-level commands for version, health checks, and help.

### `system.version`

Get API version and info.

**Usage:** `system.version`

**Response:**
```json
{
  "version": "1.0.0",
  "apiVersion": "1.0",
  "protocol": "mcp-v1",
  "name": "Procedurable Authoring API",
  "releaseDate": "2026-01-14",
  "features": ["builder.*", "measurement.*", "decision.*", "storage.*", "math.*"]
}
```

### `system.ping`

Health check - returns pong.

**Usage:** `system.ping`

**Response:**
```json
{
  "message": "pong",
  "timestamp": 1768353600446
}
```

### `system.help`

List all available commands.

**Usage:** `system.help`

**Response:**
```json
{
  "namespaces": [
    {
      "name": "builder",
      "description": "Builder management commands",
      "commands": [
        { "usage": "builder.list", "description": "List all builders" },
        ...
      ]
    },
    ...
  ],
  "totalCommands": 25
}
```

### `system.status`

Get current system status.

**Usage:** `system.status`

**Response:**
```json
{
  "version": "1.0.0",
  "activeBuilder": "DiningChair",
  "activeBuilderSource": "yaml",
  "hasLastRun": true,
  "historyCount": 5,
  "measurementOverrides": 2,
  "decisionOverrides": 1
}
```

---

## Builder Commands

Commands for managing and running builders.

### `builder.list`

List all available builders (TypeScript + YAML).

**Usage:** `builder.list`

**Response:**
```json
{
  "builders": [
    {
      "name": "DiningChair",
      "description": "Standard dining chair",
      "measurements": ["seat_width", "seat_depth", ...],
      "decisions": ["leg_style", "back_style", ...],
      "source": "typescript"
    },
    {
      "name": "Leg",
      "description": "Furniture leg",
      "source": "yaml"
    }
  ]
}
```

### `builder.open <name>`

Open a builder for editing/running. This sets the active builder.

**Usage:** `builder.open DiningChair`

**Response:**
```json
{
  "builder": "DiningChair",
  "source": "typescript",
  "message": "Opened builder: DiningChair"
}
```

### `builder.run [seed=<n>]`

Run the active builder with optional seed. Same seed = identical output.

**Usage:** 
- `builder.run` - Random seed
- `builder.run seed=42` - Specific seed
- `builder.run 42` - Shorthand

**Response:**
```json
{
  "builder": "DiningChair",
  "seed": 42,
  "vertices": 124,
  "faces": 67,
  "bounds": { "width": "0.42m", "height": "0.85m", "depth": "0.40m" },
  "decisions": { "leg_style": { "value": "tapered", "source": "random" } },
  "issues": 0,
  "traces": 79
}
```

### `builder.info`

Get info about the active builder.

**Usage:** `builder.info`

### `builder.measurements`

Get all measurements from the last run.

**Usage:** `builder.measurements`

**Response:**
```json
{
  "measurements": {
    "seat_width": { "value": 0.42, "source": "Standard dining chair width" },
    "seat_depth": { "value": 0.38, "source": "Standard depth" }
  }
}
```

### `builder.decisions`

Get all decisions from the last run.

**Usage:** `builder.decisions`

**Response:**
```json
{
  "decisions": {
    "leg_style": { "value": "tapered", "source": "random", "options": ["round", "square", "tapered"] },
    "back_style": { "value": "slat", "source": "override" }
  }
}
```

### `builder.traces [filter=<prefix>]`

List trace keys from the last run. Traces show how geometry was created.

**Usage:**
- `builder.traces` - All traces
- `builder.traces filter=vertex:` - Only vertex traces
- `builder.traces filter=loop:` - Only loop traces

**Response:**
```json
{
  "traces": [
    "vertex:seat_bl_b",
    "vertex:seat_br_b",
    "loop:leg_bl_bottom",
    "face:seat_top",
    "loft:leg_bl_surface"
  ]
}
```

### `builder.trace <key>`

Get detailed trace information for a specific geometry element.

**Usage:** `builder.trace vertex:seat_bl_b`

**Response:**
```json
{
  "key": "vertex:seat_bl_b",
  "trace": {
    "type": "vertex",
    "name": "seat_bl_b",
    "source": { "expression": "(-half_width, seat_height, -half_depth)" },
    "details": { "position": { "x": -0.21, "y": 0.45, "z": -0.19 } }
  }
}
```

### `builder.mesh`

Get serialized mesh geometry for rendering (vertices, faces, normals).

**Usage:** `builder.mesh`

---

## Measurement Commands

Commands for inspecting and modifying builder measurements.

### `measurement.list`

List all measurements for the active builder.

**Usage:** `measurement.list`

### `measurement.get <name>`

Get a specific measurement value.

**Usage:** `measurement.get seat_width`

### `measurement.set <name> <value>`

Override a measurement value. Persists across runs until reset.

**Usage:** `measurement.set seat_width 0.50`

### `measurement.reset <name>`

Remove override for a measurement (restore default).

**Usage:** `measurement.reset seat_width`

### `measurement.reset-all`

Clear all measurement overrides.

**Usage:** `measurement.reset-all`

---

## Decision Commands

Commands for inspecting and overriding builder decisions.

### `decision.list`

List all decisions for the active builder.

**Usage:** `decision.list`

### `decision.get <name>`

Get a specific decision value and its options.

**Usage:** `decision.get leg_style`

### `decision.override <name> <value>`

Force a specific decision value. Persists across runs until reset.

**Usage:** `decision.override leg_style tapered`

### `decision.reset <name>`

Remove override for a decision (restore random selection).

**Usage:** `decision.reset leg_style`

### `decision.reset-all`

Clear all decision overrides.

**Usage:** `decision.reset-all`

---

## Storage Commands

Commands for managing YAML builder definitions in storage.

### `storage.list [prefix=<path>]`

List all YAML builders in storage.

**Usage:**
- `storage.list` - All builders
- `storage.list prefix=furniture/` - Only in furniture folder

**Response:**
```json
{
  "builders": [
    {
      "name": "DiningChairYaml",
      "description": "YAML dining chair",
      "tags": ["furniture", "seating"],
      "modifiedAt": "2026-01-14T12:00:00Z",
      "size": 11089
    }
  ],
  "total": 1
}
```

### `storage.get <name>`

Get a YAML builder definition from storage.

**Usage:** `storage.get DiningChairYaml`

**Response:**
```json
{
  "name": "DiningChairYaml",
  "description": "YAML dining chair",
  "modifiedAt": "2026-01-14T12:00:00Z",
  "content": "version: \"1.0\"\nname: DiningChairYaml\n..."
}
```

### `storage.save <name> content=<yaml>`

Save a YAML builder definition to storage.

**Usage:** `storage.save MyBuilder content="version: 1.0\nname: MyBuilder\n..."`

### `storage.delete <name>`

Delete a YAML builder from storage.

**Usage:** `storage.delete MyBuilder`

### `storage.exists <name>`

Check if a builder exists in storage.

**Usage:** `storage.exists DiningChairYaml`

**Response:**
```json
{
  "name": "DiningChairYaml",
  "exists": true
}
```

---

## Command Syntax

### Positional Arguments
```
builder.open DiningChair
builder.trace vertex:seat_bl_b
```

### Key=Value Options
```
builder.run seed=42
storage.list prefix=furniture/
```

### Quoted Strings
Use quotes for values with spaces:
```
storage.save MyBuilder content="multi\nline\nyaml"
```

---

## Error Handling

Failed commands return:
```json
{
  "command": "builder.run",
  "status": "error",
  "error": "No builder is open. Use builder.open <name> first."
}
```

Common errors:
- `No builder is open` - Call `builder.open` first
- `Unknown builder: X` - Builder doesn't exist
- `Missing required argument` - Check command usage

---

## YAML Geometry Commands (P2-M1b)

These geometry commands are used in YAML builder definitions, not as DSL commands.
They are processed by the YAML parser when a builder runs.

### Profile Definitions

Define 2D cross-sections for lathe and sweep operations.

```yaml
profiles:
  vase_profile:
    type: polygon          # polygon, circle, ellipse, rect
    closed: false          # true for closed profiles
    points:
      - { x: 0, y: 0 }
      - { x: "base_radius", y: "h1" }  # Expressions supported
      - { x: "body_radius", y: "h2" }

  pipe_profile:
    type: circle
    radius: 0.02
    segments: 8
```

### Spline Definitions

Define 3D paths for sweep operations.

```yaml
splines:
  handle_path:
    type: catmull-rom      # catmull-rom or linear
    tension: 0.5           # 0-1, controls curve tightness
    points:
      - { x: "r", y: "h1", z: 0 }
      - { x: "r + offset", y: "h2", z: 0 }
      - { x: "r", y: "h3", z: 0 }
```

### `lathe:` - Rotational Solid

Spin a 2D profile around the Y axis.

```yaml
geometry:
  - lathe: vase_body
    profile: vase_profile   # Reference to defined profile
    segments: 24            # Number of segments around axis
    angle: 6.28318          # Optional: arc angle (default 2π)
    color: $ceramic         # Optional: material color
```

**Use cases:** Vases, bottles, bowls, cups, balusters, table legs

### `sweep:` - Extrude Along Path

Sweep a 2D profile along a 3D spline path.

```yaml
geometry:
  - sweep: handle
    profile: handle_profile  # 2D cross-section
    path: handle_path        # 3D spline path
    segments: 12             # Segments along path
    twist: 0                 # Optional: rotation along path (radians)
    scaleStart: 1.0          # Optional: scale at start
    scaleEnd: 1.0            # Optional: scale at end
    color: $ceramic          # Optional: material color
```

**Use cases:** Handles, pipes, cables, organic tubes, handrails

### `subdivide:` - Catmull-Clark Subdivision

Smooth a low-poly control cage into an organic surface.

```yaml
geometry:
  # First create a control cage (e.g., box)
  - vertex: v0
    position: { x: -0.2, y: -0.05, z: -0.2 }
  # ... more vertices and faces ...

  # Then subdivide
  - subdivide: smooth
    iterations: 2           # 1-3 iterations typical
```

**Use cases:** Cushions, organic shapes, character heads, soft objects

---

## Math Commands

Mathematical expression evaluation for calculations. Uses [mathjs](https://mathjs.org/) for robust evaluation.

### `math.eval <expression> [var=value...]`

Evaluate a mathematical expression with optional variable substitution.

**Usage:**
- `math.eval "sin(pi/4)"` - Evaluate with constants
- `math.eval "cos(angle) * radius" angle=0.785 radius=10` - With variables

**Response:**
```json
{
  "expression": "sin(pi/4)",
  "value": 0.7071067811865475
}
```

### `math.validate <expression>`

Check if an expression is syntactically valid.

**Usage:** `math.validate "sin(x) + cos(y)"`

### `math.functions`

List all available mathematical functions.

**Response includes:**
- **Trig:** `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`
- **Basic:** `abs`, `sqrt`, `pow`, `exp`
- **Rounding:** `floor`, `ceil`, `round`, `trunc`
- **Comparison:** `min`, `max`
- **Conditional:** `if(condition, then, else)` - Ternary conditional
- **Equality:** `eq(a, b)` - String/value equality (returns 1 if equal, 0 if not)

### `math.constants`

List all available mathematical constants.

**Response includes:**
- `pi` - π ≈ 3.14159...
- `e` - Euler's number ≈ 2.71828...
- `tau` - 2π ≈ 6.28318...

---

## YAML Geometry Commands (P2-M1b)

> **Note:** These commands are used within YAML builder definitions, not via the HTTP API.
> They are documented here for reference when authoring builders.

### Lathe Operation

Create rotational geometry by revolving a 2D profile around an axis.

**YAML Syntax:**
```yaml
geometry:
  - lathe: vase_body
    profile: vase_profile  # Reference to a profile defined in profiles: section
    segments: 24           # Number of segments around axis (more = smoother)
    angle: 360             # Degrees to revolve (360 = full circle)
    axis: y                # Axis to revolve around (x, y, or z)
    material: clay         # Optional material reference
```

**Example (Vase.yaml):**
```yaml
profiles:
  vase_profile:
    type: polygon
    closed: false
    points:
      - { x: "base_radius", y: 0 }
      - { x: "body_radius", y: "vase_height * 0.5" }
      - { x: "neck_radius", y: "vase_height * 0.8" }
      - { x: "lip_radius", y: "vase_height" }

geometry:
  - lathe: vase_body
    profile: vase_profile
    segments: 24
```

**Typical vertex/face counts:**
- Vase with 4-point profile × 24 segments = ~192 vertices, ~168 faces

### Sweep Operation

Extrude a 2D profile along a 3D path (spline) to create tubes, handles, pipes.

**YAML Syntax:**
```yaml
geometry:
  - sweep: handle
    profile: handle_cross_section  # 2D profile to extrude
    path: handle_spline            # 3D spline path reference
    segments: 16                   # Segments along path
    twist: 0                       # Optional twist in degrees
    scale: 1.0                     # Optional scale along path
    material: ceramic              # Optional material reference
```

**Example (Mug.yaml handle):**
```yaml
profiles:
  handle_cross_section:
    type: circle
    radius: "handle_radius"
    segments: 8

splines:
  handle_spline:
    type: bezier
    points:
      - { x: "mug_radius", y: "handle_y_start", z: 0 }
      - { x: "handle_x_offset", y: "handle_y_mid", z: 0 }
      - { x: "handle_x_offset", y: "handle_y_mid", z: 0 }
      - { x: "mug_radius", y: "handle_y_end", z: 0 }

geometry:
  - sweep: handle
    profile: handle_cross_section
    path: handle_spline
    segments: 16
```

**Typical vertex/face counts:**
- Circular profile (8 segments) × path (16 segments) = ~128 vertices per sweep

### Subdivide Operation

Smooth a mesh by subdividing faces (Catmull-Clark subdivision).

**YAML Syntax:**
```yaml
geometry:
  # First create base geometry (box, loft, etc.)
  - box: cushion_base
    size: { x: "width", y: "height", z: "depth" }
  
  # Then subdivide to create smooth, organic shape
  - subdivide: cushion_smooth
    iterations: 2  # More iterations = smoother (1-3 typical)
```

**Example (Cushion.yaml):**
```yaml
geometry:
  # Create a simple box
  - vertex: corner_fbl
    position: { x: "-half_width", y: "-half_height", z: "-half_depth" }
  # ... more vertices ...
  
  # Create faces from vertices
  - face: bottom
    vertices: [corner_fbl, corner_fbr, corner_brr, corner_brl]
  # ... more faces ...
  
  # Subdivide for soft, organic look
  - subdivide: smooth
    iterations: 2
```

**Typical vertex/face counts:**
- Box (8 vertices, 6 faces) → Subdivide ×2 = ~98 vertices, ~96 faces

### Conditional Geometry

Use `when:` to include geometry only if a decision is true.

**YAML Syntax:**
```yaml
geometry:
  - when: has_stretchers  # Boolean decision name
    geometry:
      # Geometry to include only if has_stretchers is true
      - circle: stretcher_front_l
        center: { x: "-leg_x", y: "stretcher_height", z: "leg_z" }
        radius: "stretcher_radius"
  
  # String comparison (choice decisions)
  - when: "sign_shape == rectangle"
    geometry:
      - extrude2d: sign_plate
        shape: rect_shape
```

**Important:** `when:` conditions use simple `==` syntax for string comparisons, not the `eq()` function. The `eq()` function is only used in `derived:` expressions that are evaluated by MathService.

### Radial Array (P2M3-004)

Duplicate geometry in a circular pattern around a center point.

**YAML Syntax:**
```yaml
geometry:
  - radialArray: pattern_name
    count: 8                      # Number of copies (or decision/expression)
    radius: 1.0                   # Distance from center (optional, default 0)
    center: { x: 0, y: 0, z: 0 }  # Center point (optional, default origin)
    axis: y                        # Rotation axis: x, y, or z (default: y)
    geometry:
      # Geometry to duplicate and rotate
      - extrude2d: element
        shape: tooth_shape
        depth: 0.1
```

**Parameters:**
- **count**: Number of copies to create (can be decision or expression)
- **radius**: Distance from center (0 = rotate in place, no translation)
- **center**: Center point of the array (default: origin)
- **axis**: Rotation axis (y = horizontal circle, x = vertical YZ, z = vertical XY)

**Context Variables Available:**
Inside the radialArray geometry block, these variables are available:
- `__radial_index` - Current copy index (0 to count-1)
- `__radial_angle` - Rotation angle in radians
- `__radial_angle_deg` - Rotation angle in degrees

**Use Cases:**
- Gears and mechanical parts
- Decorative patterns and rosettes
- Flower petals
- Architectural details
- Radial symmetry elements

**Example (Decorative Pattern):**
```yaml
decisions:
  element_count:
    type: count
    min: 6
    max: 12

geometry:
  - radialArray: pattern
    count: element_count
    radius: 1.5
    axis: y
    geometry:
      - extrude2d: petal
        shape: petal_shape
        depth: 0.05
```

### Profiles Section

Define 2D profiles for use with lathe and sweep operations.

**YAML Syntax:**
```yaml
profiles:
  profile_name:
    type: circle | ellipse | rect | polygon
    # For circle:
    radius: expression
    segments: 8
    # For polygon:
    closed: true | false
    points:
      - { x: expression, y: expression }
      - { x: expression, y: expression }
```

### Splines Section

Define 3D paths for use with sweep operations.

**YAML Syntax:**
```yaml
splines:
  spline_name:
    type: bezier | linear
    points:
      - { x: expression, y: expression, z: expression }
      - { x: expression, y: expression, z: expression }
```

### Shapes Section (P2-M3)

Define 2D shapes for use with extrude2d operations.

**YAML Syntax:**
```yaml
shapes:
  shape_name:
    type: rect | circle | ellipse | polygon
    # For rect:
    width: expression
    height: expression
    # For circle:
    radius: expression
    segments: 32
    # For ellipse:
    radiusX: expression
    radiusZ: expression
    segments: 32
    # For polygon:
    points:
      - { x: expression, z: expression }
      - { x: expression, z: expression }
    # Optional center (default 0,0):
    center: { x: expression, z: expression }
```

### Extrude2D Operation (P2-M3)

Extrude a 2D shape into 3D geometry with proper normals, caps, and optional bevels.

**YAML Syntax:**
```yaml
geometry:
  - extrude2d: sign_plate
    shape: sign_shape      # Reference to shape in shapes: section
    depth: expression      # Extrusion depth along Y axis
    caps: both             # none | front | back | both (default: both)
    offset: 0              # Y offset for extrusion start (default: 0)
    bevel:                 # Optional bevel/chamfer (P2M3-003)
      size: 0.01           # Bevel size (distance from edge)
      segments: 2          # 1=chamfer, 2+=rounded
    color: $material       # Optional material reference
```

**Bevel Options (P2M3-003):**
- **Chamfer** (segments=1): Single angled cut at 45°
- **Rounded Bevel** (segments≥2): Smooth curve with multiple segments
- **Size**: Distance from edge (automatically clamped to depth/2)
- **Segments**: Higher values = smoother (but more geometry)

**Example (Sign.yaml):**
```yaml
shapes:
  sign_shape:
    type: rect
    width: $width
    height: $height
    center: { x: 0, z: 0 }

geometry:
  - extrude2d: sign_plate
    shape: sign_shape
    depth: $thickness
    caps: both
    color: $wood

  # With bevel for professional finish
  - extrude2d: beveled_sign
    shape: rounded_shape
    depth: 0.05
    bevel:
      size: 0.01
      segments: 2
    caps: both
```

**Use cases:** Signs, backplates, badges, tiles, architectural elements, plaques

**Typical vertex/face counts:**
- Rectangle (4-sided): 8 vertices, 12 faces (with caps)
- Circle (32 segments): 64 vertices, ~100 faces (with caps)

---

## Text Commands (P2-M4)

Font loading and text-to-geometry conversion for signage, labels, and engravings.

### `text.load <name> path=<path>`

Load a font file for text generation.

**Usage:**
```bash
text.load roboto path="./fonts/Roboto-Regular.ttf"
text.load opensans path="C:/Windows/Fonts/OpenSans.ttf"
```

**Response:**
```json
{
  "name": "roboto",
  "message": "Font \"roboto\" loaded from ./fonts/Roboto-Regular.ttf"
}
```

**Auto-loading:** The following font names will auto-load from system fonts if not explicitly loaded:
- `arial` - Windows: C:/Windows/Fonts/arial.ttf, Linux: Liberation Sans
- `roboto` - Linux: Roboto-Regular.ttf, Windows: falls back to Arial
- `helvetica` - macOS: Helvetica.ttc, Windows: falls back to Arial

**Note:** Supports TrueType (.ttf) and OpenType (.otf) fonts via opentype.js.

---

### `text.list`

List all loaded fonts.

**Usage:** `text.list`

**Response:**
```json
{
  "fonts": ["roboto", "opensans"],
  "count": 2
}
```

---

### `text.outline <char> font=<name> [size=<size>]`

Get glyph outline (contours) for a single character.

**Usage:**
```bash
text.outline A font=roboto size=1.0
text.outline % font=opensans size=0.5
```

**Parameters:**
- `<char>` - Single character to extract
- `font` - Font name (must be loaded first)
- `size` - Optional size in meters (default: 1.0)

**Response:**
```json
{
  "char": "A",
  "width": 0.678,
  "height": 1.0,
  "contours": [
    { "points": 24, "isHole": false },
    { "points": 12, "isHole": true }
  ],
  "totalPoints": 36,
  "bounds": {
    "xMin": 0.012,
    "xMax": 0.666,
    "zMin": 0.0,
    "zMax": 0.987
  }
}
```

**Contour properties:**
- `points` - Number of 2D points in this contour
- `isHole` - True if contour is a hole (e.g., inside 'A', 'O', 'P', 'R')

**Use cases:**
- Preview glyph complexity before converting to 3D
- Verify font contains specific characters
- Get sizing information for layout planning

---

### `text.text <string> font=<name> [size=<size>] [spacing=<spacing>]`

Get outlines for a text string with kerning and spacing.

**Usage:**
```bash
text.text "HELLO" font=roboto size=1.0
text.text "Welcome" font=opensans size=0.5 spacing=0.05
```

**Parameters:**
- `<string>` - Text string to extract
- `font` - Font name (must be loaded first)
- `size` - Optional size in meters (default: 1.0)
- `spacing` - Optional extra spacing between characters (default: 0.0)

**Response:**
```json
{
  "text": "HELLO",
  "glyphs": 5,
  "totalContours": 7,
  "totalPoints": 142,
  "width": 3.245,
  "outlines": [
    {
      "char": "H",
      "width": 0.678,
      "contours": 1,
      "bounds": { "xMin": 0.0, "xMax": 0.678, "zMin": 0.0, "zMax": 1.0 }
    },
    {
      "char": "E",
      "width": 0.567,
      "contours": 1,
      "bounds": { "xMin": 0.678, "xMax": 1.245, "zMin": 0.0, "zMax": 1.0 }
    }
    // ... more glyphs
  ]
}
```

**Features:**
- **Automatic kerning** - Uses font's kerning table for proper spacing
- **Position calculation** - Each glyph's bounds reflect its position in the string
- **Width calculation** - Total width includes all glyphs and spacing

**Use cases:**
- Generate text geometry for signs and labels
- Calculate layout dimensions before building
- Preview text appearance with specific fonts

**Next steps (P2M4-002):**
These outlines can be extruded to 3D geometry using the `extrude2d` command (once text integration is complete).

---

## Geometry Query Commands (P2-M3)

### `geometry.shape2d`

Create and query 2D shapes programmatically.

**Usage:**
```bash
geometry.shape2d type=rect width=2 height=1
geometry.shape2d type=circle radius=1 segments=32
geometry.shape2d type=ellipse radiusX=2 radiusZ=1 segments=32
```

**Parameters:**
- `type` - Shape type: rect, circle, ellipse
- For rect: `width`, `height`, `x`, `z` (center position)
- For circle: `radius`, `segments`, `x`, `z`
- For ellipse: `radiusX`, `radiusZ`, `segments`, `x`, `z`

**Returns:**
```json
{
  "type": "rect",
  "pointCount": 4,
  "bounds": { "minX": "-1.000", "maxX": "1.000", "minZ": "-0.500", "maxZ": "0.500" },
  "area": "2.000",
  "isClockwise": false,
  "points": [
    { "x": -1, "z": -0.5 },
    { "x": 1, "z": -0.5 },
    { "x": 1, "z": 0.5 },
    { "x": -1, "z": 0.5 }
  ]
}
```

---

## WebSocket Events

The authoring server also broadcasts events via WebSocket on port 4200:

- `builder_opened` - When a builder is opened
- `builder_run` - When a builder is run
- `measurement_changed` - When a measurement is overridden
- `decision_changed` - When a decision is overridden

Connect to `ws://127.0.0.1:4200` to receive these events.

