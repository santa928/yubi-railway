export const CONFIG = {
  trainSpeed: 84 / 24,
  speedReferenceLength: 24,
  maxSpeedMultiplier: 3,
  startLength: 210 / 24,
  tipGap: 76 / 24,
  minLength: 70 / 24,
  maxRoutes: 8,
  maxPoints: 900,
  townSpacing: 62 / 24,
};
/** 点の密度でなく線路の実距離で速度倍率を決める。短線路は従来速度。 */
export function speedMultiplier(length) {
  return Math.min(
    CONFIG.maxSpeedMultiplier,
    Math.max(1, length / CONFIG.speedReferenceLength),
  );
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function rebuild(r) {
  r.lengths = [0];
  for (let i = 1; i < r.points.length; i++)
    r.lengths.push(r.lengths[i - 1] + dist(r.points[i], r.points[i - 1]));
  r.total = r.lengths.at(-1) || 0;
}
export function pointAt(r, d) {
  d = Math.max(0, Math.min(r.total, d));
  let lo = 1,
    hi = r.points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r.lengths[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const a = r.points[lo - 1] || r.points[0],
    b = r.points[lo] || a,
    t =
      (d - (r.lengths[lo - 1] || 0)) /
      ((r.lengths[lo] || 0) - (r.lengths[lo - 1] || 0) || 1);
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    dx: b.x - a.x,
    dz: b.z - a.z,
  };
}
export function createRailway(options = {}) {
  let serial = 0;
  const w = {
    routes: [],
    actives: new Map(),
    get active() {
      return this.actives.get("default") || null;
    },
    isActive(r) {
      return [...this.actives.values()].includes(r);
    },
    events: [],
    begin(p, key = "default") {
      if (this.actives.has(key)) this.finish(false, key);
      if (this.routes.length >= CONFIG.maxRoutes) {
        const old = this.routes.find((r) => !this.isActive(r));
        if (!old) return null;
        this.remove(old);
      }
      const r = {
        id: ++serial,
        points: [{ ...p }],
        lengths: [0],
        total: 0,
        revision: 0,
        committed: false,
        running: false,
        distance: 0,
        direction: 1,
        turnWait: 0,
        nextTown: 0,
      };
      this.actives.set(key, r);
      this.routes.push(r);
      return r;
    },
    add(p, key = "default") {
      const r = this.actives.get(key);
      if (!r || r.points.length >= CONFIG.maxPoints) return false;
      const prev = r.points.at(-1),
        length = dist(prev, p);
      if (length < 0.12) return false;
      const count = Math.min(
        CONFIG.maxPoints - r.points.length,
        30,
        Math.ceil(length / 0.18),
      );
      for (let i = 1; i <= count; i++) {
        const t = i / count;
        r.points.push({
          x: prev.x + (p.x - prev.x) * t,
          z: prev.z + (p.z - prev.z) * t,
        });
      }
      rebuild(r);
      r.revision++;
      if (
        !r.running &&
        (options.startReady
          ? options.startReady(r)
          : r.total >= CONFIG.startLength)
      )
        this.launch(r);
      return true;
    },
    launch(r) {
      r.carCount = r.total >= 12.5 ? 3 : r.total >= 5.8 ? 2 : 1;
      r.carWidth = Math.min(2.05, r.total * 0.55);
      r.spacing = 2.03;
      r.extent = ((r.carCount - 1) * r.spacing) / 2 + r.carWidth / 2;
      r.distance = r.extent;
      r.running = true;
      r.nextTown = -28 / 24;
    },
    finish(commit, key = "default") {
      const r = this.actives.get(key);
      if (!r) return null;
      this.actives.delete(key);
      if (
        !commit ||
        (options.minimumReady
          ? !options.minimumReady(r)
          : r.total < CONFIG.minLength)
      ) {
        this.remove(r);
        return null;
      }
      r.committed = true;
      if (!r.running) this.launch(r);
      return r;
    },
    remove(r) {
      this.routes = this.routes.filter((x) => x !== r);
      for (const [key, value] of this.actives)
        if (value === r) this.actives.delete(key);
      this.events.push({ kind: "remove", id: r.id });
    },
    cars(r) {
      return Array.from({ length: r.carCount || 0 }, (_, i) => ({
        distance: r.distance + (i - (r.carCount - 1) / 2) * r.spacing,
        reversed: r.carCount === 1 ? r.direction < 0 : i === 0,
        cab: i === 0 || i === r.carCount - 1,
      }));
    },
    step(dt) {
      for (const r of this.routes) {
        if (!r.running) continue;
        if (r.turnWait > 0) {
          r.turnWait = Math.max(0, r.turnWait - dt);
          continue;
        }
        const speed = options.speedForRoute
            ? options.speedForRoute(r)
            : CONFIG.trainSpeed * speedMultiplier(r.total),
          gap = options.tipGapForRoute
            ? options.tipGapForRoute(r)
            : CONFIG.tipGap;
        const low = Math.min(r.extent, r.total / 2),
          end = Math.max(low, r.total - r.extent);
        if (!r.committed) {
          const high = Math.max(low, end - gap);
          r.distance = Math.min(high, r.distance + speed * dt);
          r.waiting = r.distance >= high - 0.001;
        } else {
          r.waiting = false;
          r.distance += speed * dt * r.direction;
          if (r.distance >= end) {
            r.distance = end;
            r.direction = -1;
            r.turnWait = 0.45;
          } else if (r.distance <= low) {
            r.distance = low;
            r.direction = 1;
            r.turnWait = 0.45;
          }
        }
        const front = r.distance + ((r.carCount - 1) * r.spacing) / 2;
        while (front - r.nextTown >= CONFIG.townSpacing) {
          r.nextTown += CONFIG.townSpacing;
          this.events.push({ kind: "town", route: r, distance: r.nextTown });
        }
      }
    },
    clear() {
      for (const r of [...this.routes]) this.remove(r);
    },
    drain() {
      const e = this.events;
      this.events = [];
      return e;
    },
  };
  return w;
}
