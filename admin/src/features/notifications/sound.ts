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

let listening = false;

/**
 * Unlock audio on the admin's first interaction with the page, whatever it is.
 *
 * This is what was missing: priming only ran when the sound toggle was switched
 * on, and sound is on by default, so an admin who never touched that control
 * left the AudioContext suspended for the whole session. Every later
 * `resume()` was outside a gesture and Chrome refused it — badge, popup and
 * bell all worked and the chime never played.
 *
 * `once` on each listener, and the flag, keep this to a single unlock.
 */
export function primeAudioOnFirstGesture(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const unlock = () => {
    primeAudio();
    for (const evt of GESTURES) window.removeEventListener(evt, unlock);
  };
  const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;
  for (const evt of GESTURES) window.addEventListener(evt, unlock, { once: true, passive: true });
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
  gain.gain.exponentialRampToValueAtTime(0.42, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * Play the notification chime (respects the persisted mute preference).
 *
 * Three rising tones rather than two, longer and louder than before: this has
 * to carry across a room while someone is packing orders, not sit politely
 * under the UI.
 */
export function playNewOrderSound(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  try {
    // Resume is a no-op once primed; kept for the case where the gesture and
    // the first order land in the same moment.
    if (c.state === "suspended") void c.resume();
    beep(c, 784, 0, 0.16); // G5
    beep(c, 1047, 0.14, 0.16); // C6
    beep(c, 1319, 0.28, 0.34); // E6 — held, so the phrase resolves audibly
  } catch {
    /* ignore audio errors */
  }
}
