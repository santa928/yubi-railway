const MAX_CROSSINGS = 12;
const TRAIN_ALERT_DISTANCE = 5;

/** 街の生成に合わせて線路上へ踏切を置き、車両の実位置で遮断する。 */
export function createCrossings(THREE, root, box, material, pointAt) {
  const crossings = [];

  function remove(index) {
    root.remove(crossings[index].group);
    crossings.splice(index, 1);
  }

  function spawn(route, distance) {
    const p = pointAt(route, distance);
    if (crossings.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 6)) return;
    const group = new THREE.Group();
    group.name = "railway-crossing";
    group.position.set(p.x, 0, p.z);
    group.rotation.y = Math.atan2(p.dx, p.dz);
    box(group, "#d9d4b9", 5.4, 0.04, 1.2, 0, 0.08);
    for (const side of [-1, 1]) {
      box(group, "#fff5d8", 1.3, 0.012, 0.06, side * 1.8, 0.108);
    }
    const gates = [];
    const lights = [];
    for (const side of [-1, 1]) {
      box(group, "#e3b23c", 0.16, 1.3, 0.16, side * 1.1, 0.7, 0.85);
      box(group, "#344f54", 0.48, 0.22, 0.12, side * 1.1, 1.2, 0.85);
      for (const offset of [-0.12, 0.12]) {
        const light = box(
          group,
          "#6d302c",
          0.13,
          0.13,
          0.13,
          side * 1.1 + offset,
          1.2,
          0.93,
        );
        lights.push(light);
      }
      for (const angle of [-Math.PI / 4, Math.PI / 4]) {
        const cross = box(
          group,
          "#f7c344",
          0.64,
          0.085,
          0.09,
          side * 1.1,
          1.57,
          0.85,
        );
        cross.rotation.z = angle;
      }
      const gate = new THREE.Group();
      gate.position.set(side * 1.1, 0.7, 0.85);
      for (let stripe = 0; stripe < 8; stripe++) {
        box(
          gate,
          stripe % 2 ? "#3b5151" : "#f7c344",
          0.09,
          0.09,
          0.21,
          0,
          0,
          -0.1 - stripe * 0.21,
        );
      }
      gate.rotation.x = Math.PI / 2;
      group.add(gate);
      gates.push(gate);
    }
    root.add(group);
    crossings.push({
      group,
      gates,
      lights,
      x: p.x,
      z: p.z,
      routeId: route.id,
      active: false,
    });
    if (crossings.length > MAX_CROSSINGS) remove(0);
  }

  function tick(dt, routes, time, cutoff, along) {
    const cars = routes.flatMap((route) => {
      if (!route.running) return [];
      return Array.from({ length: route.carCount }, (_, index) =>
        pointAt(
          route,
          route.distance + (index - (route.carCount - 1) / 2) * route.spacing,
        ),
      );
    });
    for (let index = crossings.length - 1; index >= 0; index--) {
      const crossing = crossings[index];
      if (along(crossing) < cutoff) {
        remove(index);
        continue;
      }
      crossing.active = cars.some(
        (p) =>
          Math.hypot(p.x - crossing.x, p.z - crossing.z) < TRAIN_ALERT_DISTANCE,
      );
      const target = crossing.active ? 0 : Math.PI / 2;
      for (const gate of crossing.gates) {
        const change = Math.max(
          -dt * 3,
          Math.min(dt * 3, target - gate.rotation.x),
        );
        gate.rotation.x += change;
      }
      crossing.lights.forEach((light, index) => {
        const on = crossing.active && Math.floor(time * 3) % 2 === index % 2;
        light.material = material(on ? "#ff5642" : "#6d302c");
      });
    }
  }

  function removeRoute(id) {
    for (let index = crossings.length - 1; index >= 0; index--) {
      if (crossings[index].routeId === id) remove(index);
    }
  }

  function clear() {
    while (crossings.length) remove(0);
  }

  function stats() {
    return {
      count: crossings.length,
      active: crossings.filter((c) => c.active).length,
    };
  }

  return { spawn, tick, removeRoute, clear, stats };
}
