// Tiny script on every page. It does nothing unless the translator was turned on for this site
// (in this browser session) or the site is set to translate automatically, and then asks the
// extension to load the full translator.
(async () => {
  const load = async () => {
    if (globalThis.__mangaTranslatorLoaded) return;
    const answer = await chrome.runtime.sendMessage({type: 'wanted'}).catch(() => null);
    if (answer?.on) chrome.runtime.sendMessage({type: 'auto'}).catch(() => {});
  };
  load();
  // Back and forward can restore a page from memory without running scripts again.
  addEventListener('pageshow', event => { if (event.persisted) load(); });
})();
