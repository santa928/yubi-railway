import test from "node:test";
import assert from "node:assert/strict";
import { createRailway, CONFIG } from "../src/railway.mjs";
test("train has a head start, waits for live tip, resumes, and never resets on release", () => {
  const w = createRailway();
  w.begin({ x: 0, z: 0 });
  w.add({ x: 2, z: 0 });
  assert.equal(w.active.running, false);
  w.add({ x: 14, z: 0 });
  assert.equal(w.active.running, true);
  for (let i = 0; i < 200; i++) w.step(0.05);
  assert.ok(
    w.active.total - (w.active.distance + w.active.extent) >=
      CONFIG.tipGap - 0.01,
  );
  const before = w.active.distance;
  w.add({ x: 22, z: 0 });
  w.step(0.1);
  assert.ok(w.active.distance > before);
  const d = w.active.distance;
  w.finish(true);
  assert.equal(w.routes[0].distance, d);
});
test("completed train reverses without changing carriage positions", () => {
  const w = createRailway();
  w.begin({ x: 0, z: 0 });
  w.add({ x: 14, z: 0 });
  w.finish(true);
  const r = w.routes[0];
  r.distance = r.total - r.extent;
  const positions = w.cars(r).map((c) => c.distance);
  w.step(0.01);
  assert.equal(r.direction, -1);
  assert.deepEqual(
    w.cars(r).map((c) => c.distance),
    positions,
  );
  w.step(0.5);
  w.step(0.1);
  assert.ok(r.distance < r.total - r.extent);
});
test("cancel, short marks, limits and reset", () => {
  const w = createRailway();
  w.begin({ x: 0, z: 0 });
  w.add({ x: 20, z: 0 });
  w.finish(false);
  assert.equal(w.routes.length, 0);
  w.begin({ x: 0, z: 0 });
  w.add({ x: 0.2, z: 0 });
  w.finish(true);
  assert.equal(w.routes.length, 0);
  for (let i = 0; i < 20; i++) {
    w.begin({ x: i, z: 0 });
    w.add({ x: i, z: 8 });
    w.finish(true);
  }
  assert.ok(w.routes.length <= CONFIG.maxRoutes);
  w.clear();
  assert.equal(w.routes.length, 0);
});

test("real distance controls proportional speed with a short-route baseline and cap", async () => {
  const { speedMultiplier, rebuild } = await import("../src/railway.mjs");
  assert.equal(speedMultiplier(8), 1);
  assert.equal(speedMultiplier(CONFIG.speedReferenceLength * 2), 2);
  assert.equal(speedMultiplier(1000), CONFIG.maxSpeedMultiplier);
  const sparse = {
    points: [
      { x: 0, z: 0 },
      { x: 24, z: 0 },
      { x: 24, z: 24 },
    ],
  };
  const dense = {
    points: Array.from({ length: 49 }, (_, i) =>
      i <= 24 ? { x: i, z: 0 } : { x: 24, z: i - 24 },
    ),
  };
  rebuild(sparse);
  rebuild(dense);
  assert.equal(speedMultiplier(sparse.total), speedMultiplier(dense.total));
  const world = createRailway();
  const route = world.begin({ x: 0, z: 0 });
  world.add({ x: 48, z: 0 });
  const before = route.distance;
  world.step(0.1);
  assert.ok(
    Math.abs(route.distance - before - CONFIG.trainSpeed * 2 * 0.1) < 0.001,
  );
  const extendedFrom = route.distance;
  world.add({ x: 96, z: 0 });
  assert.equal(route.distance, extendedFrom);
  world.finish(true);
  assert.equal(route.distance, extendedFrom);
  world.step(0);
  assert.equal(route.distance, extendedFrom);
});
