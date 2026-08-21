/**
 * One-time localStorage migration for the Vanguard -> Flint rename.
 *
 * Four keys hold real user state (chart indicators, per-symbol drawings,
 * terminal levels, dashboard layout). Renaming the brand without moving them
 * would silently drop everything a user had saved, so we rewrite the old keys
 * to their new names on first read and leave a sentinel behind.
 *
 * Safe to call from anywhere, any number of times: it no-ops on the server,
 * and after the first successful pass it costs a single localStorage read.
 *
 * Delete this module (and its call sites) once no active browser can still be
 * holding `vanguard*` keys.
 */

const SENTINEL = 'flint.storage.migrated.v1';

/** Keys that don't follow the dotted convention and need an explicit mapping. */
const EXACT_RENAMES: Record<string, string> = {
  vanguard_layout: 'flint.dashboard.layout.v1',
};

let done = false;

export function migrateLegacyStorageKeys(): void {
  if (done || typeof window === 'undefined') return;

  try {
    if (window.localStorage.getItem(SENTINEL)) {
      done = true;
      return;
    }

    // Snapshot the key list first — we mutate the store while iterating it.
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k) keys.push(k);
    }

    for (const oldKey of keys) {
      const newKey = EXACT_RENAMES[oldKey]
        ?? (oldKey.startsWith('vanguard.')
          ? `flint.${oldKey.slice('vanguard.'.length)}`
          : null);
      if (!newKey) continue;

      const value = window.localStorage.getItem(oldKey);
      if (value === null) continue;

      // Never clobber a newer value that already exists under the new name.
      if (window.localStorage.getItem(newKey) === null) {
        window.localStorage.setItem(newKey, value);
      }
      window.localStorage.removeItem(oldKey);
    }

    window.localStorage.setItem(SENTINEL, '1');
    done = true;
  } catch {
    // Private browsing or a full quota: the app still works, users just start
    // from defaults. Don't set `done`, so a later call can retry.
  }
}
