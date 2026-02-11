const STORAGE_KEY = 'microrimba:audioUnlocked';

let unlocked = false;
let unlockingPromise: Promise<void> | null = null;
let unlockInfoLogged = false;
let silentAudioSourcePromise: Promise<string> | null = null;
let primed = false;

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

function getSilenceAssetUrl() {
  return `${import.meta.env.BASE_URL}audio/_silence.mp3`;
}

async function getSilentAudioSource() {
  if (!silentAudioSourcePromise) {
    const assetUrl = getSilenceAssetUrl();
    silentAudioSourcePromise = fetch(assetUrl)
      .then((res) => (res.ok ? res.text() : ''))
      .then((text) => {
        const trimmed = text.trim();
        return trimmed.startsWith('data:audio/') ? trimmed : assetUrl;
      })
      .catch(() => assetUrl);
  }
  return silentAudioSourcePromise;
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

async function playSilentElement() {
  const src = await getSilentAudioSource();
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.playsInline = true;
  audio.loop = false;
  audio.muted = false;
  audio.volume = 0.001;
  audio.currentTime = 0;
  await audio.play();
  audio.pause();
  audio.currentTime = 0;
}

export async function ensureAudioReady(ctx: AudioContext): Promise<void> {
  if (isAudioUnlocked()) {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    return;
  }

  if (!unlockingPromise) {
    unlockingPromise = (async () => {
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // ignore
        }
      }
      if (!isIosSafari()) {
        markUnlocked();
        return;
      }
      await playSilentElement();
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

  const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchend', 'keydown'];

  const handler = () => {
    void ensureAudioReady(ctx)
      .then(() => {
        events.forEach((event) => window.removeEventListener(event, handler, true));
      })
      .catch(() => {
        // keep listeners for retry on next gesture
      });
  };

  events.forEach((event) => window.addEventListener(event, handler, { passive: true, capture: true }));
}
