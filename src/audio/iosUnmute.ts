const STORAGE_KEY = 'mmi:audioUnlocked';
const SILENCE_DATA_URI = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

let unlocked = false;
let unlockingPromise: Promise<void> | null = null;
let unlockInfoLogged = false;
let primed = false;
let keepAliveEl: HTMLAudioElement | null = null;

function getStoredUnlocked() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setStoredUnlocked() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore storage write errors
  }
}

function getKeepAliveEl() {
  if (!keepAliveEl) {
    const a = new Audio(SILENCE_DATA_URI);
    a.preload = 'auto';
    a.playsInline = true;
    a.loop = true;
    a.muted = false;
    a.volume = 0.001;
    keepAliveEl = a;
  }
  return keepAliveEl;
}

export function getAudioDiagnostics() {
  return {
    keepAliveExists: keepAliveEl !== null,
    keepAlivePaused: keepAliveEl ? keepAliveEl.paused : null,
  };
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleTouchMac = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || isAppleTouchMac;
  const isWebKit = /WebKit/i.test(ua);
  const isCriOS = /CriOS/i.test(ua);
  const isFxiOS = /FxiOS/i.test(ua);
  return isIOS && isWebKit && !isCriOS && !isFxiOS;
}

export function isAudioUnlocked() {
  return unlocked || getStoredUnlocked();
}

function markUnlocked() {
  unlocked = true;
  setStoredUnlocked();
  if (import.meta.env.DEV && !unlockInfoLogged) {
    console.info('[audio] iOS audio unlocked');
    unlockInfoLogged = true;
  }
}

export async function ensureAudioReady(ctx: AudioContext): Promise<void> {
  if (isAudioUnlocked()) {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return;
  }

  if (!unlockingPromise) {
    unlockingPromise = (async () => {
      let playPromise: Promise<void> | null = null;

      if (isIosSafari()) {
        const el = getKeepAliveEl();
        try {
          playPromise = el.play();
        } catch {
          playPromise = null;
        }
      }

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (isIosSafari()) {
        if (!playPromise) throw new Error('keepalive play did not start');
        await playPromise;
      }

      markUnlocked();
    })().finally(() => {
      unlockingPromise = null;
    });
  }

  return unlockingPromise;
}

export function primeOnFirstUserGesture(ctx: AudioContext): void {
  if (typeof window === 'undefined' || primed) return;
  primed = true;

  const events: Array<keyof WindowEventMap> = ['touchend', 'pointerup', 'keydown'];

  const handler = () => {
    void ensureAudioReady(ctx)
      .then(() => {
        events.forEach((event) => window.removeEventListener(event, handler, true));
      })
      .catch(() => {
        // keep listeners for retry on next gesture
      });
  };

  events.forEach((event) => window.addEventListener(event, handler, { capture: true }));
}
