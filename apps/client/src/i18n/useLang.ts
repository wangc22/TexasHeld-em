import { useAuthStore } from '../store/authStore.js';
import { STRINGS } from './strings.js';

export function useLang() {
  const language = useAuthStore((s) => s.language);
  return STRINGS[language];
}
