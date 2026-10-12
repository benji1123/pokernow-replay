// The analysis runs in the browser: Pyodide (CPython compiled to WebAssembly) loads once from the CDN,
// then installs our pure-Python wheel from this site. Files never leave the device.
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
const WHEEL = "pokernow_analyzer-0.1.0-py3-none-any.whl"; // built into public/ by `npm run wheel`

let enginePromise = null;

// Start the download early (at app mount) so it overlaps with the user picking files.
export function warmUp(onStatus = () => {}) {
  if (!enginePromise) {
    enginePromise = (async () => {
      onStatus("Loading the Python engine…");
      const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`);
      const py = await loadPyodide({ indexURL: PYODIDE });
      await py.loadPackage(new URL(import.meta.env.BASE_URL + WHEEL, window.location.href).href);
      onStatus("");
      return py.pyimport("pokernow_analyzer.analyze").analyze_json;
    })().catch((e) => {
      enginePromise = null; // let the next attempt retry (e.g. after a network blip)
      throw new Error(`Could not load the analysis engine: ${e.message}`);
    });
  }
  return enginePromise;
}

export async function analyzeLogs(files, { merges = [], autoMerge = true } = {}, onStatus) {
  const analyzeJson = await warmUp(onStatus);
  const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
  const out = JSON.parse(analyzeJson(JSON.stringify({ files: texts, merges, auto_merge: autoMerge })));
  if (out.error) throw new Error(out.error);
  return out.session;
}
