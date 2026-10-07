import { createAudio } from "./audio.mjs";
import * as THREE from "three";
import { createWorld } from "./world.mjs";
import { createPointers } from "./pointers.mjs";
const canvas = document.querySelector("#canvas"),
  hint = document.querySelector("#hint"),
  status = document.querySelector("#status"),
  pauseButton = document.querySelector("#pause"),
  error = document.querySelector("#error");
const audio = createAudio();
let renderer,
  world,
  paused = false,
  pointers = null,
  last = 0,
  running = true;
function fail(message) {
  try {
    releaseAll(false, false);
  } catch {}
  audio.reset();
  running = false;
  error.hidden = false;
  error.querySelector("p").textContent = message;
  hint.classList.add("hidden");
  status.textContent = "表示を確認してね";
}
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  world = createWorld({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  pointers = createPointers(world);
} catch (e) {
  fail(
    "このブラウザでは3Dを表示できませんでした。新しいSafariやChromeで開き直してみてください。",
  );
}
function ui() {
  if (!world) return;
  const s = world.stats();
  hint.classList.toggle("hidden", s.routes > 0);
  pauseButton.hidden = false;
  pauseButton.textContent = paused ? "▶" : "Ⅱ";
  pauseButton.setAttribute(
    "aria-label",
    paused ? "まちと電車を動かす" : "まちと電車を一時停止",
  );
  status.textContent = paused
    ? "ひとやすみ"
    : s.drawing
      ? "せんろを のばして、まちを つなごう"
      : s.trains
        ? "でんしゃと まちが、どこまでも"
        : "ながく なぞると、でんしゃが しゅっぱつ";
}
function pixel(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(8, Math.min(r.width - 8, e.clientX - r.left)),
    y: Math.max(8, Math.min(r.height - 8, e.clientY - r.top)),
  };
}
function releaseCapture(id) {
  try {
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  } catch {}
}
function releaseAll(commit = false, flush = true) {
  if (!pointers) return;
  const ids = [...pointers.active.keys()];
  pointers.cancelAll(commit);
  ids.forEach(releaseCapture);
  if (flush) world.tick(0, { paused: true });
}
function reset() {
  if (!world) return;
  releaseAll(false);
  world.clear();
  audio.reset();
  paused = false;
  ui();
}
function togglePause() {
  if (!world) return;
  releaseAll(true);
  paused = !paused;
  audio.update(world.stats(), { paused, hidden: document.hidden });
  ui();
}
canvas.addEventListener("pointerdown", (e) => {
  if (!world || !running || e.button > 0) return;
  e.preventDefault();
  audio.unlock();
  if (!pointers.begin(e.pointerId, pixel(e))) return;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    pointers.finish(e.pointerId, false);
  }
  ui();
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointers?.active.has(e.pointerId)) return;
  e.preventDefault();
  const samples = e.getCoalescedEvents?.();
  for (const c of samples?.length ? samples : [e])
    pointers.move(e.pointerId, pixel(c));
});
function finish(e) {
  if (!pointers?.active.has(e.pointerId)) return;
  pointers.finish(e.pointerId, e.type === "pointerup");
  releaseCapture(e.pointerId);
  world.tick(0, { paused });
  ui();
}
canvas.addEventListener("pointerup", finish);
canvas.addEventListener("pointercancel", finish);
canvas.addEventListener("lostpointercapture", finish);
document.querySelector("#clear").addEventListener("click", reset);
pauseButton.addEventListener("click", () => {
  audio.unlock();
  togglePause();
});
const soundButton = document.querySelector("#sound");
soundButton.addEventListener("click", () => {
  audio.unlock();
  const muted = !audio.stats().muted;
  audio.setMuted(muted);
  soundButton.textContent = muted ? "音なし" : "音あり";
  soundButton.setAttribute("aria-pressed", String(muted));
  soundButton.setAttribute("aria-label", muted ? "音を鳴らす" : "音を消す");
});
document.querySelector("#volume").addEventListener("input", (e) => {
  audio.unlock();
  audio.setVolume(e.target.value);
});
canvas.addEventListener("keydown", (e) => {
  if (!world) return;
  audio.unlock();
  if (e.key === "Enter") {
    e.preventDefault();
    world.demo();
    ui();
  } else if (e.key === " ") {
    e.preventDefault();
    togglePause();
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    reset();
  }
});
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  fail("3Dの表示が一度止まりました。下のボタンで読み込み直してください。");
});
document
  .querySelector("#reload")
  .addEventListener("click", () => location.reload());
if (world) {
  new ResizeObserver(() => {
    releaseAll(false);
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    world.setView(r.width, r.height);
    ui();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => {
    last = 0;
    audio.update(world.stats(), { paused, hidden: document.hidden });
    if (document.hidden) {
      releaseAll(false);
      ui();
    }
  });
  window.addEventListener("blur", () => {
    releaseAll(false);
    ui();
  });
  function frame(t) {
    if (!running) return;
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
    last = t;
    try {
      world.tick(dt, { paused: paused || document.hidden });
      audio.update(world.stats(), { paused, hidden: document.hidden });
      pointers.update();
      renderer.render(world.scene, world.camera);
    } catch (e) {
      fail("3Dの表示が止まりました。読み込み直してみてください。");
      return;
    }
    requestAnimationFrame(frame);
  }
  ui();
  requestAnimationFrame(frame);
  window.render_game_to_text = () =>
    JSON.stringify({
      coordinates: "world x/z ground plane; screen origin top left",
      paused,
      ...world.stats(),
      audio: audio.stats(),
    });
  window.advanceTime = (ms) => {
    for (let t = 0; t < ms; t += 1000 / 60)
      world.tick(Math.min(1000 / 60, ms - t) / 1000, {
        paused: paused || document.hidden,
      });
    audio.update(world.stats(), { paused, hidden: document.hidden });
    ui();
    renderer.render(world.scene, world.camera);
  };
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) audio.update(world.stats(), { hidden: true });
    else audio.dispose();
  });
  window.addEventListener("pageshow", () => {
    last = 0;
    audio.update(world.stats(), { paused, hidden: document.hidden });
  });
  if (document.modelContext?.registerTool) {
    const abort = new AbortController();
    for (const tool of [
      {
        name: "read_railway_state",
        description: "Read the miniature railway state.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute(input) {
          empty(input);
          return world.stats();
        },
      },
      {
        name: "clear_railway",
        description: "Erase the rails and town, as the redraw button does.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute(input) {
          empty(input);
          reset();
          return world.stats();
        },
      },
    ]) {
      try {
        Promise.resolve(
          document.modelContext.registerTool(tool, { signal: abort.signal }),
        ).catch(() => {});
      } catch {}
    }
    window.addEventListener(
      "pagehide",
      () => {
        releaseAll(false);
        abort.abort();
      },
      { once: true },
    );
  }
}
function empty(v) {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length)
    throw new Error("Expected empty object");
}
