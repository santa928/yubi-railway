import { pointAt, speedMultiplier } from "../src/railway.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createWorld } from "../src/world.mjs";
test("ground raycast aligns with rendered perspective after scroll and resize", () => {
  const w = createWorld({ width: 390, height: 760 });
  for (const [width, height] of [
    [390, 760],
    [320, 640],
    [1200, 760],
  ]) {
    w.setView(width, height);
    for (let i = 0; i < 20; i++) w.tick(0.05);
    for (const [x, y] of [
      [width * 0.2, height * 0.4],
      [width * 0.8, height * 0.7],
    ]) {
      const p = w.pick(x, y);
      const projected = new THREE.Vector3(p.x, 0.06, p.z).project(w.camera);
      assert.ok(Math.abs(((projected.x + 1) * width) / 2 - x) < 0.001);
      assert.ok(Math.abs(((1 - projected.y) * height) / 2 - y) < 0.001);
    }
  }
  w.dispose();
});
test("scene uses real solid geometry, train follows track, and reset reuses bounded assets", () => {
  const w = createWorld({ width: 390, height: 760 });
  w.demo();
  for (let i = 0; i < 120; i++) w.tick(0.05);
  const s = w.stats();
  assert.ok(s.trains > 0);
  assert.ok(s.plots > 0);
  let meshes = 0,
    sprites = 0;
  w.scene.traverse((o) => {
    if (o.isMesh) meshes++;
    if (o.isSprite) sprites++;
  });
  assert.ok(meshes > 30);
  assert.equal(sprites, 0);
  assert.ok(s.plots <= 32 && s.groves <= 28);
  w.clear();
  assert.equal(w.stats().routes, 0);
  assert.equal(w.stats().plots, 0);
  w.dispose();
});
test("paused drawing updates geometry and cancellation removes the track immediately", () => {
  const w = createWorld({ width: 390, height: 760 });
  const before = w.root.children.length;
  w.railway.begin(w.pick(100, 450));
  w.railway.add(w.pick(260, 450));
  w.tick(0, { paused: true });
  assert.ok(w.root.children.length > before);
  w.railway.finish(false);
  w.tick(0, { paused: true });
  assert.equal(w.root.children.length, before);
  w.dispose();
});
test("screen-calibrated pacing scales by real distance and preserves 68px/s scroll", () => {
  for (const width of [320, 1200]) {
    const w = createWorld({ width, height: 720 });
    const r = w.railway.begin(w.pick(width * 0.15, 510));
    w.railway.add(w.pick(width * 0.85, 510));
    w.railway.finish(true);
    const project = (d) => {
      const p = pointAt(r, d);
      const v = new THREE.Vector3(p.x, 0.06, p.z).project(w.camera);
      return { x: ((v.x + 1) * width) / 2, y: ((1 - v.y) * 720) / 2 };
    };
    const before = project(r.distance);
    w.tick(0.1);
    const after = project(r.distance);
    assert.ok(
      Math.abs(after.x - before.x - 8.4 * speedMultiplier(r.total)) < 0.05,
    );
    assert.ok(Math.abs(after.y - before.y + 6.8) < 0.05);
    w.dispose();
  }
});
test("towns produce a full visible silhouette cycle and birth effects, not unreachable asset code", () => {
  const w = createWorld({ width: 390, height: 760 });
  w.demo();
  w.railway.step(9);
  w.tick(0.01);
  const s = w.stats();
  for (const kind of [
    "house",
    "shop",
    "playground",
    "cinema",
    "greenhouse",
    "fountainPlaza",
    "station",
    "flowerGarden",
    "tower",
    "civic",
  ])
    assert.ok(s.townKinds.includes(kind), kind);
  assert.ok(s.effects.births > 0);
  assert.ok(s.effects.births <= 12);
  const names = [];
  w.root.traverse((o) => {
    if (o.name) names.push(o.name);
  });
  for (const kind of [
    "cinema",
    "greenhouse",
    "playground",
    "flowerGarden",
    "fountainPlaza",
  ])
    assert.ok(
      names.some((n) => n.includes(kind)),
      `actual geometry for ${kind}`,
    );
  w.clear();
  assert.equal(w.stats().effects.births, 0);
  w.dispose();
});

test("crossings span the actual rails, close near cars, freeze on pause and clear with their route", () => {
  const world = createWorld({ width: 390, height: 760 });
  const route = world.railway.begin({ x: 0, z: 0 });
  world.railway.add({ x: 0, z: 23 });
  world.railway.finish(true);
  world.tick(0);
  const crossing = world.root.children.find(
    (child) => child.name === "railway-crossing",
  );
  assert.ok(crossing);
  assert.ok(Math.abs(crossing.position.x) < 0.001);
  route.distance = crossing.position.z;
  world.tick(0.1, { paused: true });
  assert.equal(world.stats().crossings.active, 1);
  const gate = crossing.children.find((child) => child.type === "Group");
  const frozen = gate.rotation.x;
  world.tick(0.5, { paused: true });
  assert.equal(gate.rotation.x, frozen);
  world.tick(0.1);
  assert.ok(gate.rotation.x < frozen);
  route.distance = 20;
  world.tick(0.1);
  assert.equal(world.stats().crossings.active, 0);
  world.railway.remove(route);
  world.tick(0);
  assert.equal(world.stats().crossings.count, 0);
  world.clear();
  world.dispose();
});
