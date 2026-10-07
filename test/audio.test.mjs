import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../src/audio.mjs";

function fakeContext() {
  const sources = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  function node() {
    const result = {
      connected: false,
      stopped: false,
      connect() {
        this.connected = true;
      },
      disconnect() {
        this.connected = false;
      },
      start() {},
      stop() {
        this.stopped = true;
      },
    };
    sources.push(result);
    return result;
  }
  return {
    state: "suspended",
    currentTime: 0,
    destination: {},
    sources,
    createGain() {
      return Object.assign(node(), { gain: parameter() });
    },
    createOscillator() {
      return Object.assign(node(), { frequency: parameter() });
    },
    createBufferSource: node,
    decodeAudioData: async () => ({ duration: 81 }),
    resume() {
      this.state = "running";
      return Promise.resolve();
    },
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    },
    close() {
      this.state = "closed";
      return Promise.resolve();
    },
  };
}
const state = { trains: 1, plots: 2, crossings: { active: 1 } };
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

test("audio requires gesture, loops once, stops for pause/hidden/mute and resumes without duplicate music", async () => {
  const context = fakeContext();
  let created = 0;
  const audio = createAudio({
    contextFactory: () => {
      created++;
      return context;
    },
    bgmPath: "test.mp3",
    fetchAudio: async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
  });
  audio.update(state);
  assert.equal(audio.stats().unlocked, false);
  assert.equal(created, 0);
  audio.unlock();
  await flush();
  assert.equal(audio.stats().music, true);
  audio.unlock();
  audio.update(state);
  await flush();
  assert.equal(created, 1);
  assert.equal(context.sources.filter((n) => n.loop && n.connected).length, 1);
  audio.update(state, { paused: true });
  await flush();
  assert.equal(context.state, "suspended");
  assert.equal(audio.stats().music, false);
  assert.equal(audio.stats().voices, 0);
  audio.update(state);
  await flush();
  assert.equal(audio.stats().music, true);
  audio.update(state, { hidden: true });
  await flush();
  assert.equal(audio.stats().music, false);
  audio.update(state);
  audio.setMuted(true);
  await flush();
  assert.equal(context.state, "suspended");
  assert.equal(audio.stats().music, false);
  audio.setMuted(false);
  await flush();
  assert.equal(audio.stats().music, true);
  audio.reset();
  await flush();
  assert.equal(audio.stats().active, false);
  assert.equal(audio.stats().voices, 0);
  audio.dispose();
  assert.equal(context.state, "closed");
});

test("sound voices stay bounded and release after ending, missing music never blocks effects", async () => {
  const context = fakeContext();
  const audio = createAudio({
    contextFactory: () => context,
    bgmPath: "missing.mp3",
    fetchAudio: async () => ({ ok: false }),
  });
  audio.unlock();
  audio.update(state);
  await flush();
  for (let i = 0; i < 100; i++) {
    context.currentTime += 1;
    audio.update({ ...state, plots: i + 10 });
  }
  assert.equal(audio.stats().voices, 10);
  for (const node of context.sources) node.onended?.();
  assert.equal(audio.stats().voices, 0);
  assert.equal(audio.stats().music, false);
  audio.update(state);
  audio.setVolume(0.15);
  assert.equal(audio.stats().volume, 0.15);
  audio.reset();
  assert.equal(audio.stats().voices, 0);
});

test("late music download cannot start after reset or mute", async () => {
  const context = fakeContext();
  let complete;
  const response = new Promise((resolve) => {
    complete = resolve;
  });
  const audio = createAudio({
    contextFactory: () => context,
    bgmPath: "test.mp3",
    fetchAudio: () => response,
  });
  audio.unlock();
  audio.update(state);
  audio.reset();
  complete({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await flush();
  assert.equal(audio.stats().music, false);
  assert.equal(context.state, "suspended");
  audio.update(state);
  audio.setMuted(true);
  await flush();
  assert.equal(audio.stats().music, false);
  assert.equal(context.state, "suspended");
});

test("resume completion after pause suspends again instead of leaving the context running", async () => {
  const context = fakeContext();
  const pending = [];
  context.resume = () =>
    new Promise((resolve) =>
      pending.push(() => {
        context.state = "running";
        resolve();
      }),
    );
  const audio = createAudio({ contextFactory: () => context, bgmPath: null });
  audio.unlock();
  audio.update(state);
  audio.update(state, { paused: true });
  pending.forEach((resolve) => resolve());
  await flush();
  assert.equal(context.state, "suspended");
  assert.equal(audio.stats().music, false);
  assert.equal(audio.stats().voices, 0);
});
