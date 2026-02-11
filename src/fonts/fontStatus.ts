export type SmuflFontStatus = {
  heji2: boolean;
  heji2Text: boolean;
};

export async function getSmuflFontStatus(): Promise<SmuflFontStatus> {
  if (!document.fonts?.check) {
    return { heji2: false, heji2Text: false };
  }

  return {
    heji2: document.fonts.check('16px "HEJI2"'),
    heji2Text: document.fonts.check('16px "HEJI2Text"'),
  };
}
