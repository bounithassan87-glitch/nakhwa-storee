// A short, pleasant two-tone "ding" generated with the Web Audio API — no audio
// asset to ship, works offline. The preference is persisted in localStorage and
// can be toggled by the admin (see the bell/mute control in the Topbar).

const PREF_KEY = "nakhwa.admin.soundEnabled";

export function isSoundEnabled(): boolean {
  return localStorage.getItem(PREF_KEY) !== "false"; // default ON
}

export function setSoundPref(enabled: boolean): void {
  localStorage.setItem(PREF_KEY, enabled ? "true" : "false");
}

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  ctx = ctx ?? new Ctor();
  return ctx;
}

/** Resume the AudioContext on a user gesture so later beeps are allowed to play
 *  (browsers block audio until the user has interacted with the page). */
export function primeAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

function beep(c: AudioContext, freq: number, start: number, dur: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Play the notification chime (respects the persisted mute preference). */
export function playNewOrderSound(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") void c.resume();
    beep(c, 784, 0, 0.18); // G5
    beep(c, 1047, 0.12, 0.22); // C6
  } catch {
    /* ignore audio errors */
  }
}
