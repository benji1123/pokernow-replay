// Remembers the last uploaded logs in the browser's IndexedDB so the next visit can reload them without
// re-uploading. Local to this browser profile; nothing is sent anywhere. All failures (private mode, quota,
// no IndexedDB) are swallowed: the cache is a convenience, never a requirement.
const DB = "pokernow-replay", STORE = "sessions", KEY = "last";

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => { db.close(); resolve(req?.result); };
        t.onerror = () => { db.close(); reject(t.error); };
      })
  );
}

// files: File objects; summary: { hand_count, players } from the analyzed session, for the label on the upload screen.
export async function saveLastSession(files, { merges, autoMerge }, summary) {
  try {
    const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    await tx("readwrite", (s) => s.put({ files: texts, merges, autoMerge, summary, savedAt: Date.now() }, KEY));
  } catch {
    /* cache is best-effort */
  }
}

// Returns { files: File[], merges, autoMerge, summary, savedAt } or null.
export async function loadLastSession() {
  try {
    const rec = await tx("readonly", (s) => s.get(KEY));
    if (!rec) return null;
    return { ...rec, files: rec.files.map((f) => new File([f.text], f.name, { type: "text/csv" })) };
  } catch {
    return null;
  }
}

export async function forgetLastSession() {
  try {
    await tx("readwrite", (s) => s.delete(KEY));
  } catch {
    /* nothing to forget */
  }
}

// ---- study scores: one running record per mode, kept in memory for this visit only (never stored) ----
const SCORES = "scores"; // key used by older builds that did store scores

export const emptyScores = () => ({ modes: {}, updatedAt: null });

/** Fold one finished round into the record; returns the new record. */
export function recordRound(scores, mode, correct, total) {
  const m = scores.modes[mode] ?? { rounds: 0, correct: 0, total: 0, best: 0, bestOf: 0, last: null };
  const better = total && (m.bestOf === 0 || correct / total > m.best / m.bestOf || (correct / total === m.best / m.bestOf && total > m.bestOf));
  return {
    ...scores,
    updatedAt: Date.now(),
    modes: { ...scores.modes, [mode]: { rounds: m.rounds + 1, correct: m.correct + correct, total: m.total + total, best: better ? correct : m.best, bestOf: better ? total : m.bestOf, last: { correct, total, at: Date.now() } } },
  };
}

// Delete scores saved by older builds, so nothing about past quizzes lingers in the browser.
export async function purgeStoredScores() {
  try {
    await tx("readwrite", (s) => s.delete(SCORES));
  } catch {
    /* nothing stored */
  }
}
