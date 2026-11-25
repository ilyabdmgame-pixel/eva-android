const ROOT_2 = Math.sqrt(2);
const ROOT_3 = Math.sqrt(3);
const ROOT_6 = Math.sqrt(6);
const VERTICAL = Math.sqrt(2 / 3);

export function camera({ width, height, pixelsPerMeter, u = 0, v = 0 }) {
  return {
    width, height,
    scale: pixelsPerMeter,
    x: width / 2 - pixelsPerMeter * (u - v) / ROOT_2,
    y: height / 2 - pixelsPerMeter * (u + v) / ROOT_6
  };
}

export function project(view, { u, v, z = 0 }) {
  return {
    x: view.x + view.scale * (u - v) / ROOT_2,
    y: view.y + view.scale * ((u + v) / ROOT_6 - z * VERTICAL),
    depth: (u + v + z) / ROOT_3
  };
}

export function worldAtHeight(view, x, y, z = 0) {
  const difference = (x - view.x) * ROOT_2 / view.scale;
  const sum = ((y - view.y) / view.scale + z * VERTICAL) * ROOT_6;
  return { u: (sum + difference) / 2, v: (sum - difference) / 2, z };
}
