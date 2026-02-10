export type ThemeMode = 'light' | 'dark';
const key = 'microrimba-theme';

export const initTheme = () => {
  const val = (localStorage.getItem(key) as ThemeMode | null) ?? 'light';
  document.documentElement.classList.toggle('dark', val === 'dark');
  return val;
};

export const setTheme = (mode: ThemeMode) => {
  localStorage.setItem(key, mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
};
