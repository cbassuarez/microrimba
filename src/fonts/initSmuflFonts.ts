const FONT_STYLE_ID = 'smufl-font-faces';

function createBaseSafeUrl(path: string) {
  const base = import.meta.env.BASE_URL;
  const baseUrl = new URL(base, window.location.origin);
  return new URL(path, baseUrl).toString();
}

function ensurePreload(href: string, family: string) {
  const id = `smufl-font-preload-${family.toLowerCase()}`;
  if (document.getElementById(id)) {
    return;
  }

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  link.href = href;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

export function initSmuflFonts() {
  if (typeof document === 'undefined') {
    return;
  }

  const bravuraUrl = createBaseSafeUrl('fonts/bravura/Bravura.woff2');
  const hejiUrl = createBaseSafeUrl('fonts/heji/HEJI.woff2');

  if (!document.getElementById(FONT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = FONT_STYLE_ID;
    style.textContent = `
      @font-face {
        font-family: "Bravura";
        src: url("${bravuraUrl}") format("woff2");
        font-display: swap;
      }
      @font-face {
        font-family: "HEJI";
        src: url("${hejiUrl}") format("woff2");
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  }

  ensurePreload(bravuraUrl, 'Bravura');
  ensurePreload(hejiUrl, 'HEJI');

  void document.fonts?.load('16px "Bravura"');
  void document.fonts?.load('16px "HEJI"');
}
