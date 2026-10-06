// Sparse A* around static buildings. Dynamic defenses remain attackable obstacles.
export function findPath(from, to, isBlocked) {
  const size = 3,
    key = (x, z) => `${x},${z}`,
    snap = (v) => Math.round(v / size),
    sx = snap(from.x),
    sz = snap(from.z),
    tx = snap(to.x),
    tz = snap(to.z);
  const open = [{ x: sx, z: sz, g: 0, f: 0 }],
    nodes = new Map([[key(sx, sz), open[0]]]),
    closed = new Set();
  let goal = null;
  for (let n = 0; open.length && n < 1200; n++) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift(),
      ck = key(current.x, current.z);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (Math.hypot(current.x - tx, current.z - tz) < 1.5) {
      goal = current;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const x = current.x + dx,
        z = current.z + dz,
        k = key(x, z);
      if (
        closed.has(k) ||
        Math.abs(x * size) > 96 ||
        Math.abs(z * size) > 96 ||
        isBlocked(x * size, z * size)
      )
        continue;
      if (
        dx &&
        dz &&
        (isBlocked(current.x * size, z * size) ||
          isBlocked(x * size, current.z * size))
      )
        continue;
      const g = current.g + Math.hypot(dx, dz),
        old = nodes.get(k);
      if (old && old.g <= g) continue;
      const node = {
        x,
        z,
        g,
        f: g + Math.hypot(x - tx, z - tz),
        parent: current,
      };
      nodes.set(k, node);
      open.push(node);
    }
  }
  if (!goal) return [];
  const path = [];
  while (goal.parent) {
    path.unshift({ x: goal.x * size, z: goal.z * size });
    goal = goal.parent;
  }
  return path;
}
