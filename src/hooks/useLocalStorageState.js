import { useState } from 'react';

/**
 * useState that initializes from localStorage.
 * Falls back to defaultValue if the key doesn't exist or JSON.parse fails.
 *
 * @param {string} key          - localStorage key
 * @param {*}      defaultValue - fallback value if key is missing or corrupt
 * @returns {[*, function]}     - same signature as useState
 */
export default function useLocalStorageState(key, defaultValue) {
  return useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
}
