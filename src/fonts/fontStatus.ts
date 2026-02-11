export type SmuflFontStatus = {
  bravura: boolean;
  heji: boolean;
};

export async function getSmuflFontStatus(): Promise<SmuflFontStatus> {
  if (!document.fonts?.check) {
    return { bravura: false, heji: false };
  }

  return {
    bravura: document.fonts.check('16px "Bravura"'),
    heji: document.fonts.check('16px "HEJI"'),
  };
}
