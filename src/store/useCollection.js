import { useCallback, useEffect, useRef, useState } from 'react';
import { safeGet, safeSet } from '../utils/storage';

/**
 * Same-tab write signal. The native `storage` event fires on *other* tabs only,
 * so we broadcast this one for components in the current tab.
 * Payload: { detail: { key } }.
 */
export const SAME_TAB_EVENT = 'cgms:storage';

/** Dispatch a same-tab update signal for `key`. */
function broadcast(key) {
  try {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: { key } }));
  } catch {
    // dispatchEvent can throw only in very old browsers / jsdom edge cases — ignore.
  }
}

/**
 * useCollection — reactive, cross-tab-synced array backed by localStorage.
 *
 *   const [items, add, update, remove, replace] = useCollection(STORAGE_KEYS.SERVICES, seed);
 *
 * Behaviour:
 *   • Reads initial state synchronously from localStorage (falls back to `seed`).
 *   • Subscribes to native `storage` events (cross-tab) AND our
 *     'cgms:storage' CustomEvent (same-tab) — every consumer of the same key
 *     re-reads automatically after any mutation.
 *   • Mutations go through `safeSet` and then broadcast. The writer relies on
 *     the event listener to update its own state, so there is exactly ONE
 *     render per mutation per consumer (no redundant setState inside mutators).
 *   • Seed value is pinned on first render (via ref) so callers can pass a
 *     fresh `MOCK_*` array without re-subscribing.
 *
 * Mutators are stable — destructuring is safe in dependency arrays.
 */
export default function useCollection(key, seed = []) {
  const seedRef = useRef(seed);
  // Track the last-seen raw JSON payload. Lets us skip setItems when an event
  // fires but the stored value is byte-identical to what we already hold —
  // avoids a useless re-render.
  const lastRawRef = useRef(null);
  const [items, setItems] = useState(() => {
    try { lastRawRef.current = localStorage.getItem(key); } catch {}
    const val = safeGet(key, seedRef.current);
    /* Persist-on-hydrate (Module 4 enhancement).
     *   When localStorage has no entry for `key` yet AND the seed is
     *   a non-empty array, write the seed through on first read. This
     *   makes cross-store lazy lookups (e.g. mockAppointments.
     *   hostNameFor reading `cgms_staff_v1` without a React context)
     *   work reliably from the very first render, instead of
     *   collapsing to '—' until the owner page is first visited.
     *
     *   Idempotent — only writes when the key is literally unset
     *   (lastRawRef.current === null). Never overwrites an empty-
     *   string value ('') or an empty-array payload ('[]') already
     *   persisted, so a user who intentionally cleared a collection
     *   doesn't get the seed restored.
     */
    if (lastRawRef.current == null && Array.isArray(val) && val.length > 0) {
      try {
        const payload = JSON.stringify(val);
        localStorage.setItem(key, payload);
        lastRawRef.current = payload;
        if (typeof window !== 'undefined' && window?.console) {
          // eslint-disable-next-line no-console
          console.debug(`[useCollection] Persisted seed for ${key} on first hydrate.`);
        }
      } catch { /* quota / private-mode — fall back to in-memory only */ }
    }
    return val;
  });

  useEffect(() => {
    const sync = (event) => {
      const changedKey = event?.key ?? event?.detail?.key;
      // Native `storage` also fires on localStorage.clear() with key === null;
      // treat null as "something may have changed, re-read to be safe".
      if (changedKey && changedKey !== key) return;
      let raw = null;
      try { raw = localStorage.getItem(key); } catch {}
      if (raw === lastRawRef.current) return; // no real change — skip re-render
      lastRawRef.current = raw;
      setItems(safeGet(key, seedRef.current));
    };

    window.addEventListener('storage', sync);
    window.addEventListener(SAME_TAB_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SAME_TAB_EVENT, sync);
    };
  }, [key]);

  /** Commit helper — write storage and broadcast. */
  const commit = useCallback(
    (mutator) => {
      const prev = safeGet(key, seedRef.current);
      const next =
        typeof mutator === 'function' ? mutator(Array.isArray(prev) ? prev : []) : mutator;
      safeSet(key, next);
      broadcast(key);
      return next;
    },
    [key],
  );

  const add = useCallback(
    (item) => commit((list) => [...list, item]),
    [commit],
  );

  const update = useCallback(
    (id, patch) =>
      commit((list) =>
        list.map((it) =>
          it && it.id === id
            ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) }
            : it,
        ),
      ),
    [commit],
  );

  const remove = useCallback(
    (id) => commit((list) => list.filter((it) => !it || it.id !== id)),
    [commit],
  );

  const replace = useCallback((next) => commit(next), [commit]);

  return [items, add, update, remove, replace];
}
