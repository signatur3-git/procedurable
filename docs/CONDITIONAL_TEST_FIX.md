# ConditionalTest Fix - Final Version

**Date:** 2026-01-16  
**Issue:** Syntax error with `when:` clauses causing "Cannot read properties of undefined (reading 'length')"

---

## The Problem

The YAML used multiple top-level `when:` clauses:

```yaml
# WRONG SYNTAX:
- when: is_round
  vertex: center
  position: { x: 0, y: 0, z: 0 }

- when: is_round
  vertex: c0
  position: ...
```

This is **invalid**. The `when:` clause expects a `geometry:` array child:

```yaml
# Correct when: syntax:
- when: is_round
  geometry:
    - vertex: center
      position: ...
    - vertex: c0
      position: ...
```

However, for mutually exclusive geometry (if/else), the **`if/then/else`** syntax is better.

---

## The Solution

Use a single `if/then/else` block with nested geometry:

```yaml
geometry:
  - if: is_round
    then:
      # All circle geometry here
      - vertex: center
        position: { x: 0, y: 0.01, z: 0 }
      - vertex: c0
        position: { x: "final_radius * cos(0)", y: 0.01, z: "final_radius * sin(0)" }
      # ... more vertices
      - face: f0
        vertices: [center, c0, c1]
        color: { name: blue }
      # ... more faces
    
    else:
      # All square geometry here
      - vertex: v1
        position: { x: "-final_radius", y: 0, z: "-final_radius" }
      # ... more vertices
      - face: base
        vertices: [v1, v2, v3, v4]
        color: { name: red }
```

---

## Expected Behavior

**When `is_round=false` (default):**
- Red square
- 4 vertices (v1, v2, v3, v4)
- 1 quad face

**When `is_round=true` (toggled):**
- Blue circle
- 13 vertices (center + 12 around circumference)
- 12 triangular faces

---

## Testing

1. **Restart authoring server** (to reload YAML)
2. **Refresh dashboard**
3. **Select ConditionalTest**
4. **Run with any seed**
5. **Toggle `is_round`**

You should see:
- ✅ No errors
- ✅ Red square → Blue circle
- ✅ Vertex count changes: 4 → 13
- ✅ Face count changes: 1 → 12

---

## Lessons Learned

### YAML Conditional Syntax Options:

1. **`if/then/else`** - Best for mutually exclusive geometry
   ```yaml
   - if: condition
     then:
       - vertex: ...
     else:
       - vertex: ...
   ```

2. **`when:`** - For optional geometry (requires `geometry:` child)
   ```yaml
   - when: condition
     geometry:
       - vertex: ...
       - face: ...
   ```

3. **`repeat:`** - For looping
   ```yaml
   - repeat: count
     as: index
     geometry:
       - vertex: "v{{index}}"
         position: ...
   ```

---

**Status:** ✅ ConditionalTest now works correctly with proper if/then/else syntax

