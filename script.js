const CIRCLE_WIDTH = 8;
const CIRCLE_RADIUS = CIRCLE_WIDTH / 2;
const MAX_ROTATION_ANGLE = 80;

const elements = {
  twoDRect: document.getElementById("two-d-rect"),
  threeDRect: document.getElementById("three-d-rect"),
  centerCursorLine: document.getElementById("center-cursor-line"),
  sliceLine: document.getElementById("slice-line"),
  centerCircle: document.getElementById("center-circle"),
  intersection1Circle: document.getElementById("intersection-1-circle"),
  intersection2Circle: document.getElementById("intersection-2-circle"),
  cursorCircle: document.getElementById("cursor-circle"),
  cursorRect: document.getElementById("cursor-rect"),
};

const state = {
  x: 0,
  y: 0,
  width: window.innerWidth,
  height: window.innerHeight,
  centerX: window.innerWidth / 2,
  centerY: window.innerHeight / 2,
};

document.addEventListener("mousemove", (event) => {
  state.x = event.clientX;
  state.y = event.clientY;
});

window.addEventListener("resize", () => {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.centerX = state.width / 2;
  state.centerY = state.height / 2;
  updateCenterCircle();
});

window.addEventListener("load", () => {
  updateCenterCircle();
  requestAnimationFrame(render);
});

function updateCenterCircle() {
  elements.centerCircle.style.left = `${state.centerX - CIRCLE_RADIUS}px`;
  elements.centerCircle.style.top = `${state.centerY - CIRCLE_RADIUS}px`;
}

function render() {
  if (
    elements.cursorCircle.style.left !== `${state.x - CIRCLE_RADIUS}px` ||
    elements.cursorCircle.style.top !== `${state.y - CIRCLE_RADIUS}px`
  ) {
    elements.cursorCircle.style.left = `${state.x - CIRCLE_RADIUS}px`;
    elements.cursorCircle.style.top = `${state.y - CIRCLE_RADIUS}px`;

    const dy = state.y - state.centerY;
    const dx = state.x - state.centerX;

    const centerCursorWidth = Math.sqrt(dx * dx + dy * dy);
    const centerCursorAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const sliceWidth = Math.sqrt(
      state.width * state.width + state.height * state.height,
    );
    const sliceAngle = centerCursorAngle + 90;

    elements.centerCursorLine.style.left = `${state.centerX}px`;
    elements.centerCursorLine.style.top = `${state.centerY}px`;
    elements.centerCursorLine.style.width = `${centerCursorWidth}px`;
    elements.centerCursorLine.style.transform = `rotate(${centerCursorAngle}deg)`;

    elements.sliceLine.style.left = `${state.centerX - sliceWidth / 2}px`;
    elements.sliceLine.style.top = `${state.centerY}px`;
    elements.sliceLine.style.width = `${sliceWidth}px`;
    elements.sliceLine.style.transform = `rotate(${sliceAngle}deg)`;

    const [i1, i2] = lineRectIntersections(
      state.width,
      state.height,
      (sliceAngle * Math.PI) / 180,
    );

    elements.intersection1Circle.style.left = `${i1.x - CIRCLE_RADIUS}px`;
    elements.intersection1Circle.style.top = `${i1.y - CIRCLE_RADIUS}px`;
    elements.intersection2Circle.style.left = `${i2.x - CIRCLE_RADIUS}px`;
    elements.intersection2Circle.style.top = `${i2.y - CIRCLE_RADIUS}px`;

    elements.twoDRect.style.clipPath = getClipPolygon(
      i1,
      i2,
      state.width,
      state.height,
    );
    elements.threeDRect.style.clipPath = getClipPolygon(
      i2,
      i1,
      state.width,
      state.height,
    );

    const xRatio = Math.min(1, state.height / state.width);
    const yRatio = Math.min(1, state.width / state.height);

    // const rotX = ((state.y / state.height) * 2 - 1) * xRatio;
    // const rotY = -1 * (((state.x / state.width) * 2 - 1) * yRatio);
    const rotX = ((state.y / state.height) * 2 - 1) * xRatio;
    const rotY = -1 * (((state.x / state.width) * 2 - 1) * yRatio);

    const rotAngle =
      (centerCursorWidth / (sliceWidth / 2)) * MAX_ROTATION_ANGLE;

    elements.threeDRect.style.transform = `rotate3d(${rotX}, ${rotY}, 0, ${-rotAngle}deg)`;
  }

  requestAnimationFrame(render);
}

function getClipPolygon(anchor, other, width, height) {
  let corner1, corner2;

  if (anchor.x === 0) {
    corner1 = { x: 0, y: 0 };
    corner2 = { x: width, y: 0 };
  } else if (anchor.y === 0) {
    corner1 = { x: width, y: 0 };
    corner2 = { x: width, y: height };
  } else if (anchor.x >= width) {
    corner1 = { x: width, y: height };
    corner2 = { x: 0, y: height };
  } else {
    corner1 = { x: 0, y: height };
    corner2 = { x: 0, y: 0 };
  }

  return (
    `polygon(` +
    `${anchor.x}px ${anchor.y}px, ` +
    `${corner1.x}px ${corner1.y}px, ` +
    `${corner2.x}px ${corner2.y}px, ` +
    `${other.x}px ${other.y}px` +
    `)`
  );
}

function lineRectIntersections(width, height, angle) {
  const cx = width / 2;
  const cy = height / 2;

  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  const points = [];

  // left
  if (dx !== 0) {
    const t = (0 - cx) / dx;
    const y = cy + t * dy;
    if (y >= 0 && y <= height) points.push({ x: 0, y });
  }

  // right
  if (dx !== 0) {
    const t = (width - cx) / dx;
    const y = cy + t * dy;
    if (y >= 0 && y <= height) points.push({ x: width, y });
  }

  // top
  if (dy !== 0) {
    const t = (0 - cy) / dy;
    const x = cx + t * dx;
    if (x >= 0 && x <= width) points.push({ x, y: 0 });
  }

  // bottom
  if (dy !== 0) {
    const t = (height - cy) / dy;
    const x = cx + t * dx;
    if (x >= 0 && x <= width) points.push({ x, y: height });
  }

  points.sort((a, b) => {
    const ta = (a.x - cx) * dx + (a.y - cy) * dy;
    const tb = (b.x - cx) * dx + (b.y - cy) * dy;
    return ta - tb;
  });

  return points;
}
