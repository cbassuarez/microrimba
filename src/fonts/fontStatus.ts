export type SmuflFontStatus = {
  bravura: boolean;
  heji2: boolean;
  heji2Text: boolean;
};

export async function getSmuflFontStatus(): Promise<SmuflFontStatus> {
  if (!document.fonts?.check) {
    return { bravura: false, heji2: false, heji2Text: false };
  }

  return {
    bravura: document.fonts.check('16px "Bravura"'),
    heji2: document.fonts.check('16px "HEJI2"'),
    heji2Text: document.fonts.check('16px "HEJI2Text"'),
  };
}
