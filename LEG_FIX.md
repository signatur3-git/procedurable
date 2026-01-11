# Furniture Leg Positioning Fix

## 🔧 Issue Identified
The chair and table legs were not positioned correctly - they were extending beyond the seat/table edges.

## ✅ Fixes Applied

### Chair Legs
**Before:**
```typescript
const legPositions = [
  new Vec3(-design.seatWidth / 2 + legThickness, 0, -design.seatDepth / 2 + legThickness),
  // ... positions were at edges minus leg thickness
];
```

**After:**
```typescript
const legInset = legThickness / 2 + 0.02; // Small inset for stability
const legPositions = [
  new Vec3(-design.seatWidth / 2 + legInset, 0, -design.seatDepth / 2 + legInset),
  // ... legs now properly inset from edges
];
```

**Why:** Box legs are centered at the given position, so they need to be inset by `legThickness/2` plus a small margin to stay within the seat boundaries.

### Chair Back
**Improvements:**
- Increased thickness from 0.03 to 0.04 for better visual weight
- Adjusted position to account for back thickness: `z -= design.seatDepth / 2 - backThickness / 2`
- Now properly aligned with the seat back edge

### Table Legs
The table legs were already using a 15% inset which works well with the cylindrical legs:
```typescript
const legInset = Math.min(design.topWidth, design.topDepth) * 0.15;
```

This is appropriate since table legs are tapered cylinders, not boxes.

## 🎨 Visual Improvements

After refresh, you should see:

### Chairs
- ✅ All 4 legs properly positioned within seat boundaries
- ✅ Legs don't extend past seat edges
- ✅ Back positioned flush with seat back edge
- ✅ Better visual stability

### Tables
- ✅ Legs already well-positioned (15% inset)
- ✅ Tapered cylindrical legs look elegant
- ✅ Proper support appearance

## 🔄 What to Do

**Refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R) to see the improved furniture!

The dev server should automatically reload with hot module replacement, but a hard refresh ensures you get the latest changes.

## 📊 Technical Details

- **Leg Inset Calculation**: `legThickness / 2 + 0.02` meters
- **Box Legs**: Centered at position (need explicit inset)
- **Cylindrical Legs**: Already handle centering well
- **Chair Back**: Now accounts for its own thickness in positioning

---

**The furniture should now look much more realistic and properly proportioned!** 🪑✨

