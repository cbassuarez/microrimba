const NOTATION_STYLE_ID = 'notation-font-faces';

export function installNotationFonts(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(NOTATION_STYLE_ID)) {
    return;
  }

  const base = import.meta.env.BASE_URL || '/';
  const heji2Url = new URL('fonts/heji/HEJI2.otf', base).toString();
  const heji2TextUrl = new URL('fonts/heji/HEJI2Text.otf', base).toString();

  const style = document.createElement('style');
  style.id = NOTATION_STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "HEJI2";
      src: url("${heji2Url}") format("opentype");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "HEJI2Text";
      src: url("${heji2TextUrl}") format("opentype");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
  `;

  document.head.appendChild(style);
}
