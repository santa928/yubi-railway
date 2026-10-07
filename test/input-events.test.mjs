import { createAudio } from "../src/audio.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createWorld } from "../src/world.mjs";
import { createPointers } from "../src/pointers.mjs";
test("real UI handlers isolate captures, accept empty coalesced events and clean up global controls", () => {
  const nodes = new Map(),
    captures = new Set();
  let world, resize, frame;
  function el(s) {
    if (!nodes.has(s))
      nodes.set(s, {
        handlers: {},
        addEventListener(n, f) {
          this.handlers[n] = f;
        },
        setAttribute() {},
        classList: { add() {}, toggle() {} },
        querySelector: () => el("p"),
        clientWidth: 800,
        clientHeight: 760,
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 800,
          height: 760,
        }),
        setPointerCapture: (id) => captures.add(id),
        hasPointerCapture: (id) => captures.has(id),
        releasePointerCapture(id) {
          captures.delete(id);
          this.handlers.lostpointercapture?.({
            type: "lostpointercapture",
            pointerId: id,
          });
        },
      });
    return nodes.get(s);
  }
  const document = { ...el("document"), querySelector: el, hidden: false },
    window = el("window");
  class Renderer {
    constructor() {
      this.shadowMap = {};
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
  }
  const context = {
    document,
    window,
    THREE: { WebGLRenderer: Renderer },
    createWorld: (o) => (world = createWorld(o)),
    createPointers,
    createAudio,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    ResizeObserver: class {
      constructor(f) {
        resize = f;
      }
      observe() {}
    },
    requestAnimationFrame: (f) => (frame = f),
    console,
  };
  vm.runInNewContext(
    fs.readFileSync("src/main.mjs", "utf8").replace(/^import[^\n]*\n/gm, ""),
    context,
  );
  const c = el("#canvas"),
    event = (type, id, x = 100, y = 400) =>
      c.handlers[type]({
        type,
        pointerId: id,
        clientX: x,
        clientY: y,
        button: 0,
        preventDefault() {},
        getCoalescedEvents: () => [],
      });
  event("pointerdown", 1);
  event("pointerdown", 2, 100, 600);
  event("pointermove", 1, 600, 400);
  event("pointermove", 2, 600, 600);
  assert.equal(captures.size, 2);
  assert.ok(world.railway.routes.every((r) => r.running));
  event("pointerup", 1, 600, 400);
  assert.equal(captures.size, 1);
  assert.equal(world.railway.actives.size, 1);
  event("pointercancel", 2);
  assert.equal(world.railway.actives.size, 0);
  assert.equal(world.railway.routes.length, 1);
  event("pointerdown", 3);
  event("pointerdown", 4, 200, 500);
  event("pointermove", 3, 600, 400);
  event("pointermove", 4, 650, 500);
  el("#pause").handlers.click();
  assert.equal(captures.size, 0);
  assert.equal(world.railway.actives.size, 0);
  assert.ok(world.railway.routes.every((r) => r.committed));
  event("pointerdown", 5);
  event("pointerdown", 6);
  el("#clear").handlers.click();
  event("pointermove", 5, 700, 600);
  assert.equal(world.railway.routes.length, 0);
  assert.equal(captures.size, 0);
  event("pointerdown", 7);
  event("pointerdown", 8);
  document.hidden = true;
  document.handlers.visibilitychange();
  assert.equal(world.railway.routes.length, 0);
  assert.equal(captures.size, 0);
  event("pointerdown", 9);
  resize();
  assert.equal(world.railway.routes.length, 0);
  assert.equal(captures.size, 0);
  world.tick = () => {
    throw new Error("simulated world failure");
  };
  assert.doesNotThrow(() => frame(100));
  assert.equal(el("#error").hidden, false);
  world.dispose();
});
