// 8notes.com score 6974 / CC BY 3.0。帰属は音楽クレジットと配布資料へ。
export const BGM_PATH = "audio/workrail.mp3";
const DEFAULT_VOLUME = 0.35;
const MAX_VOICES = 10;

/** 音を一元管理する。ユーザー操作で解放し、停止中はノードを保持しない。 */
export function createAudio({
  contextFactory,
  bgmPath = BGM_PATH,
  fetchAudio = globalThis.fetch,
} = {}) {
  let context;
  let master;
  let buffer;
  let music;
  let musicStarted = 0;
  let musicOffset = 0;
  let unlocked = false;
  let muted = false;
  let volume = DEFAULT_VOLUME;
  let active = false;
  let loading = false;
  let disposed = false;
  let nextTrain = 0;
  let nextAlarm = 0;
  let previous = { trains: 0, plots: 0 };
  const voices = new Set();

  function stopMusic() {
    if (!music) return;
    musicOffset =
      (musicOffset + context.currentTime - musicStarted) % buffer.duration;
    music.stop();
    music.disconnect();
    music = null;
  }

  function stopVoices() {
    for (const voice of voices) {
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    voices.clear();
  }

  function startMusic() {
    if (
      !active ||
      muted ||
      !buffer ||
      music ||
      context.state !== "running" ||
      disposed
    )
      return;
    music = context.createBufferSource();
    music.buffer = buffer;
    music.loop = true;
    music.connect(master);
    musicStarted = context.currentTime;
    music.start(0, musicOffset);
  }

  function sync() {
    if (!context || disposed) return;
    master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.03);
    if (!active || muted) {
      stopMusic();
      stopVoices();
      if (context.state === "running") context.suspend().catch(() => {});
      return;
    }
    context
      .resume()
      .then(() => {
        if (!active || muted || disposed) {
          if (context.state === "running") context.suspend().catch(() => {});
          return;
        }
        startMusic();
      })
      .catch(() => {});
  }

  function loadMusic() {
    if (!bgmPath || loading || buffer) return;
    loading = true;
    fetchAudio(bgmPath)
      .then((response) => {
        if (!response.ok) throw new Error("BGM download failed");
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((decoded) => {
        if (disposed) return;
        buffer = decoded;
        startMusic();
      })
      .catch(() => {
        loading = false;
      }); // 次の操作で取得を再試行でき、ゲームは無音でも操作できる。
  }

  function unlock() {
    if (disposed) return;
    try {
      if (!context) {
        const Factory =
          globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!contextFactory && !Factory) return;
        const candidate = contextFactory ? contextFactory() : new Factory();
        const gain = candidate.createGain();
        gain.gain.value = muted ? 0 : volume;
        gain.connect(candidate.destination);
        context = candidate;
        master = gain;
      }
      unlocked = true;
      // Safariではユーザー操作の同期処理内でresumeする必要がある。
      context
        .resume()
        .then(() => {
          if (!active || muted) sync();
          else startMusic();
        })
        .catch(() => {});
      loadMusic();
    } catch {
      unlocked = false;
    }
  }

  function tone(frequency, duration, strength, type = "sine") {
    if (
      !unlocked ||
      !active ||
      muted ||
      context?.state !== "running" ||
      voices.size >= MAX_VOICES
    )
      return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(strength, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    const voice = { oscillator, gain };
    voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      voices.delete(voice);
    };
    oscillator.start();
    oscillator.stop(now + duration + 0.02);
  }

  function update(state, { paused = false, hidden = false } = {}) {
    const shouldRun = !paused && !hidden && state.trains > 0;
    if (shouldRun !== active) {
      active = shouldRun;
      nextTrain = 0;
      nextAlarm = 0;
      sync();
    }
    if (active && context?.state === "running" && !muted) {
      if (state.trains > previous.trains) tone(660, 0.2, 0.13);
      if (state.plots > previous.plots) tone(880, 0.1, 0.07);
      const now = context.currentTime;
      if (now >= nextTrain) {
        tone(110, 0.045, 0.035, "triangle");
        nextTrain = now + 0.32;
      }
      if (state.crossings.active && now >= nextAlarm) {
        tone(740, 0.16, 0.09, "triangle");
        nextAlarm = now + 0.45;
      }
    }
    previous = { trains: state.trains, plots: state.plots };
  }

  function setMuted(value) {
    muted = value;
    sync();
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    sync();
  }

  function reset() {
    active = false;
    sync();
    musicOffset = 0;
    previous = { trains: 0, plots: 0 };
  }

  function dispose() {
    reset();
    disposed = true;
    master?.disconnect();
    context?.close().catch(() => {});
  }

  function stats() {
    return {
      unlocked,
      muted,
      volume,
      active,
      voices: voices.size,
      music: !!music,
      available: !!context,
    };
  }

  return { unlock, update, setMuted, setVolume, reset, dispose, stats };
}
