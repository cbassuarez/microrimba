export type ThemeMode = 'light' | 'dark';
const key = 'theme';

export const initTheme = () => {
  const stored = localStorage.getItem(key);
  const initial: ThemeMode = stored === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', initial === 'dark');
  return initial;
};

export const setTheme = (mode: ThemeMode) => {
  localStorage.setItem(key, mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
};
