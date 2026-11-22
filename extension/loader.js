// Tiny script on every page. It does nothing unless the user turned the translator on for this
// tab or for this site, and then asks the extension to load the full translator.
(async () => {
  const wanted = async () => {
    try { if (sessionStorage.getItem('manga-translator-on') === '1') return true; } catch {}
    try {
      const {settings} = await chrome.storage.local.get('settings');
      return !!settings?.sites?.includes(location.hostname);
    } catch { return false; }
  };
  const load = async () => { if (!globalThis.__mangaTranslatorLoaded && await wanted()) chrome.runtime.sendMessage({type: 'auto'}).catch(() => {}); };
  load();
  // Back and forward can restore a page from memory without running scripts again.
  addEventListener('pageshow', event => { if (event.persisted) load(); });
})();
