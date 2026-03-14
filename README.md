# Edge

An interactive 3D perspective visualization. Moving the cursor across the screen drives a perpendicular "slice" that splits a full-viewport image into two halves, one flat, one with a live 3D tilt that responds to cursor position and distance from center.

## How it works

The core idea is: draw an imaginary line from the center of the screen to the cursor, then draw a second line perpendicular to it. That perpendicular line is the **slice**, it cuts across the entire viewport and divides the background image in two.

Both halves display the same image. One half stays flat, 2D. The other half gets a `rotate3d()` transform applied, creating a folding effect. The rotation axis and angle are derived from where the cursor is and how far it is from the center.

<!--
## Files

### `index.html`

Minimal shell. All visual elements are empty `<div>`s positioned by JavaScript at runtime, there is no meaningful DOM structure beyond what is needed to target elements via IDs.

| Element                  | Role                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `#two-d-rect`            | The flat half of the split image                             |
| `#three-d-rect`          | The 3D-rotated half of the split image                       |
| `#center-cursor-line`    | Debug line drawn from screen center to cursor                |
| `#slice-line`            | Debug line showing the perpendicular slice                   |
| `#center-circle`         | Dot at the screen center                                     |
| `#intersection-1-circle` | Dot where the slice meets the viewport edge (red)            |
| `#intersection-2-circle` | Dot where the slice meets the opposite edge (blue)           |
| `#cursor-circle`         | Dot that follows the cursor                                  |
| `#cursor-rect`           | Full-viewport transparent overlay that captures mouse events |

### `style.css`

All elements are `position: absolute; top: 0; left: 0`, their actual position and size are set entirely by JavaScript. CSS only handles appearance (colors, border-radius) and a few transform properties.

**Key rules:**

`body`, three things happen here:

- `overflow: hidden` prevents scrollbars when elements overflow during rotation.
- `background-color: black` fills any gap revealed when `#three-d-rect` rotates away from the screen plane.
- `perspective: 1200px` establishes the 3D perspective context for all children. Setting this on `body` (rather than on `#three-d-rect` itself) is critical: the CSS `perspective` property only affects _child_ elements, not the element it's declared on. If declared on `#three-d-rect`, it would have no effect on that element's own `rotate3d()` transform.

`body` is explicitly sized to `100dvw × 100dvh`. This is required for `perspective-origin` to resolve correctly. Because all children are `position: absolute`, the body would otherwise collapse to zero height, causing `perspective-origin: 50% 50%` (the default) to resolve to the top edge of the screen instead of the center.

`#two-d-rect` and `#three-d-rect` share the same background image at `100dvw × 100dvh`. They are stacked on top of each other. CSS `clip-path` is used by JavaScript to show only each element's respective half of the viewport, so visually they form one seamless image.

`#center-cursor-line` uses `transform-origin: top left` because the line is drawn starting from the screen center outward, rotation should pivot from its starting point, not its center.

### `script.js`

#### Constants

```js
const CIRCLE_WIDTH = 8; // diameter of all debug dots in pixels
const CIRCLE_RADIUS = 4; // half of CIRCLE_WIDTH, used to center dots on their coordinates
const MAX_ROTATION_ANGLE = 80; // maximum 3D tilt in degrees, reached when cursor is at the viewport edge
```

#### `state`

Holds all mutable runtime values in one place:

```js
const state = {
  x,
  y, // current cursor position in viewport coordinates
  width,
  height, // current viewport dimensions
  centerX,
  centerY, // derived: viewport center (width/2, height/2)
};
```

`x` and `y` are updated by a `mousemove` listener. `width`, `height`, `centerX`, and `centerY` are updated by a `resize` listener.

#### `elements`

A plain object of pre-fetched DOM references, queried once at startup. All DOM writes go through this object.

#### Event listeners

- `mousemove`, updates `state.x` and `state.y`.
- `resize`, updates viewport dimensions in `state`, then calls `updateCenterCircle()` to reposition the center dot immediately (without waiting for the cursor to move).
- `load`, positions the center dot and starts the render loop via `requestAnimationFrame`.

#### `updateCenterCircle()`

Positions `#center-circle` at the screen center. Called on page load and on resize. It is intentionally separated from `render()` because the center dot only needs to move when the viewport dimensions change, not on every animation frame.

#### `render()`

The main animation loop, called every frame via `requestAnimationFrame`. To avoid redundant DOM writes, the entire body is gated behind a check: if the cursor hasn't moved since the last frame, nothing is updated.

When the cursor has moved, the following sequence runs:

**1. Cursor circle**

Positions `#cursor-circle` centered on the cursor coordinates.

**2. Center-to-cursor vector**

```
dx = cursor.x - center.x
dy = cursor.y - center.y
```

- `centerCursorWidth`, the distance from center to cursor (Pythagorean theorem). Used later to scale the rotation angle.
- `centerCursorAngle`, the angle of this vector in degrees, via `Math.atan2(dy, dx)`.

**3. Slice geometry**

- `sliceWidth`, the viewport diagonal. Guarantees the slice line always spans beyond the viewport corners regardless of angle.
- `sliceAngle`, `centerCursorAngle + 90°`. Always perpendicular to the center-cursor vector.
- The `#center-cursor-line` and `#slice-line` elements are positioned and rotated to visualize these vectors.

**4. Intersection points**

`lineRectIntersections()` is called with the slice angle to find the two points where the slice line crosses the viewport boundary. These are stored as `i1` (the "lower" intersection, negative direction along the line) and `i2` (the "upper" intersection, positive direction).

The red dot (`#intersection-1-circle`) is placed at `i1`, and the blue dot (`#intersection-2-circle`) at `i2`.

**5. Clip paths**

`getClipPolygon()` is called twice to produce CSS `polygon()` clip paths, one for each half of the split image:

- `#two-d-rect` uses `i1` as the anchor point.
- `#three-d-rect` uses `i2` as the anchor point.

**6. 3D rotation**

```js
const rotX = ((state.y / state.height) * 2 - 1) * xRatio;
const rotY = -1 * (((state.x / state.width) * 2 - 1) * yRatio);
const rotAngle = (centerCursorWidth / (sliceWidth / 2)) * MAX_ROTATION_ANGLE;

elements.threeDRect.style.transform = `rotate3d(${rotX}, ${rotY}, 0, ${-rotAngle}deg)`;
```

`rotX` and `rotY` define the rotation axis. They are normalized cursor coordinates in the range `[-1, 1]`, scaled by `xRatio`/`yRatio` to compensate for non-square viewports (so the perceived tilt is consistent regardless of aspect ratio).

`rotAngle` scales linearly from `0°` at the center to `MAX_ROTATION_ANGLE` at the viewport edge.

The result is that `#three-d-rect` appears to hinge away from the screen along the slice line, with the tilt angle and axis both driven by cursor position.

#### `getClipPolygon(anchor, other, width, height)`

Builds a CSS `polygon()` string that covers one half of the viewport. The polygon always has four vertices: `anchor`, two corners of the viewport, and `other`.

The two corners are determined by which edge `anchor` lies on:

| `anchor` edge        | corner 1     | corner 2     |
| -------------------- | ------------ | ------------ |
| Left (`x === 0`)     | top-left     | top-right    |
| Top (`y === 0`)      | top-right    | bottom-right |
| Right (`x >= width`) | bottom-right | bottom-left  |
| Bottom (else)        | bottom-left  | top-left     |

This ensures the polygon always wraps around the correct half of the viewport in clockwise order.

#### `lineRectIntersections(width, height, angle)`

Pure geometry function. Given viewport dimensions and a line angle (in radians) passing through the viewport center, returns the two points where the line exits the viewport boundary.

Uses parametric line representation: a point on the line is `center + t * direction`, where `direction = (cos(angle), sin(angle))`. For each of the four edges, it solves for `t` and validates that the resulting point lies within the edge's bounds.

Corner deduplication: top and bottom edge checks use **strict** bounds (`x > 0 && x < width`) while left and right use inclusive bounds (`y >= 0 && y <= height`). This ensures that when the line passes exactly through a corner, only one edge check claims that point, preventing duplicate entries in the result array.

The results are sorted by their `t` parameter (dot product of the displacement from center with the direction vector), so `points[0]` is always the point in the negative direction and `points[1]` in the positive direction.
 -->
