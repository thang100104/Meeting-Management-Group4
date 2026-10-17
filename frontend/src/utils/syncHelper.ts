import { useEffect } from 'react';

export const getStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null && saved !== 'undefined') {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(`Error reading ${key} from localStorage`, error);
  }
  return defaultValue;
};

export const setStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('appDataSync'));
    window.dispatchEvent(new Event('storage'));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage`, error);
  }
};

export const useDataSync = (keysToWatch: string | string[], callback: () => void) => {
  useEffect(() => {
    const handleSync = (e?: Event) => {
      // Can add filtering if event contains details about which key changed, 
      // but for simplicity, any sync event triggers a callback.
      callback();
    };

    window.addEventListener('appDataSync', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('appDataSync', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [keysToWatch, callback]);
};
