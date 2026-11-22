// Local Manga Translator: background worker.
// Makes network requests for the page script (images, Ollama), keeps the free-plan meter,
// talks to ExtensionPay, and injects the translator when the user asks for it.

// Chrome loads these here; Firefox lists them in the manifest instead.
if (typeof importScripts === 'function') importScripts('ExtPay.js', 'config.js');

const extpay = ExtPay(CONFIG.extpayId);
extpay.startBackground();

const OLLAMA_HOSTS = ['http://127.0.0.1:11434/', 'http://localhost:11434/'];

/* ------------------------------------------------------------------------------------------
 * Ollama refuses requests from browser extensions unless the user changes OLLAMA_ORIGINS.
 * Instead, this extension's own background requests (tab -1) present Ollama's own origin.
 * Requests from web pages are not touched, so websites still can't use the user's Ollama.
 * ---------------------------------------------------------------------------------------- */

const ORIGIN_RULES = OLLAMA_HOSTS.map((host, i) => ({
  id: i + 1,
  priority: 1,
  condition: {urlFilter: '|' + host, tabIds: [chrome.tabs.TAB_ID_NONE]},
  action: {type: 'modifyHeaders', requestHeaders: [{header: 'origin', operation: 'set', value: 'http://127.0.0.1'}]}
}));

const rulesReady = chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: ORIGIN_RULES.map(r => r.id), addRules: ORIGIN_RULES
}).catch(error => console.error('Could not set up the Ollama connection rule', error));

/* ------------------------------------------------------------------------------------------
 * Requests for the page script. Images are fetched with the reader page as referrer, because
 * many manga sites refuse hotlinked images.
 * ---------------------------------------------------------------------------------------- */

let nextRefererRule = 1000;

async function withReferer(url, referrer, run) {
  if (!referrer || !/^https?:/.test(url)) return run();
  const id = nextRefererRule++;
  if (nextRefererRule > 900000) nextRefererRule = 1000;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [id],
    addRules: [{
      id, priority: 2,
      condition: {urlFilter: '|' + url + '|', tabIds: [chrome.tabs.TAB_ID_NONE]},
      action: {type: 'modifyHeaders', requestHeaders: [{header: 'referer', operation: 'set', value: referrer}]}
    }]
  });
  try { return await run(); }
  finally { chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: [id]}).catch(() => {}); }
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'request') handleRequest(port);
  else if (port.name === 'pull') handlePull(port);
});

function handleRequest(port) {
  const controller = new AbortController();
  let timer = 0, closed = false;
  const send = message => { if (!closed) try { port.postMessage(message); } catch {} };
  port.onDisconnect.addListener(() => { closed = true; controller.abort(); clearTimeout(timer); });
  port.onMessage.addListener(async message => {
    if (message.type === 'abort') return controller.abort();
    if (message.type !== 'start') return; // pings only keep this worker awake
    timer = setTimeout(() => { controller.abort(); send({type: 'error', message: 'The request timed out.', code: 'TIMEOUT'}); }, message.timeout);
    try {
      if (OLLAMA_HOSTS.some(h => message.url.startsWith(h))) await rulesReady;
      const response = await withReferer(message.url, message.referrer, () => fetch(message.url, {
        method: message.method,
        headers: Object.fromEntries(Object.entries(message.headers || {}).filter(([k]) => k.toLowerCase() !== 'referer')),
        body: message.data,
        credentials: message.credentials ? 'include' : 'omit',
        signal: controller.signal
      }));
      if (message.responseType === 'blob') {
        const buffer = await response.arrayBuffer();
        send({type: 'done', status: response.status, base64: toBase64(buffer), mime: response.headers.get('content-type') || ''});
      } else {
        send({type: 'done', status: response.status, text: await response.text()});
      }
    } catch (error) {
      if (controller.signal.aborted) send({type: 'error', message: 'Stopped.', code: 'ABORT'});
      else send({type: 'error', message: 'Network request failed.', code: 'NETWORK'});
    } finally { clearTimeout(timer); }
  });
}

/* ------------------------------------------------------------------------------------------
 * Model download for the setup page, with progress.
 * ---------------------------------------------------------------------------------------- */

function handlePull(port) {
  const controller = new AbortController();
  let closed = false;
  const send = message => { if (!closed) try { port.postMessage(message); } catch {} };
  port.onDisconnect.addListener(() => { closed = true; controller.abort(); });
  port.onMessage.addListener(async message => {
    if (message.type !== 'start') return;
    try {
      await rulesReady;
      const response = await fetch(OLLAMA_HOSTS[0] + 'api/pull', {
        method: 'POST', body: JSON.stringify({model: message.model, stream: true}), signal: controller.signal
      });
      if (!response.ok) throw new Error(`Ollama answered ${response.status}.`);
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffered = '';
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, {stream: true});
        const lines = buffered.split('\n');
        buffered = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const update = JSON.parse(line);
          if (update.error) throw new Error(update.error);
          send({type: 'progress', ...update});
        }
      }
      send({type: 'done'});
    } catch (error) {
      if (!closed) send({type: 'error', message: error.message || 'The download stopped.'});
    }
  });
}

/* ------------------------------------------------------------------------------------------
 * Free plan: a daily page allowance. Pro (paid once through ExtensionPay) has no limit.
 * ---------------------------------------------------------------------------------------- */

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function proStatus(force) {
  const {pro} = await chrome.storage.local.get('pro');
  const fresh = pro && Date.now() - pro.checked < 6 * 3600e3;
  if (fresh && !force) return pro.paid;
  try {
    const user = await extpay.getUser();
    const paid = !!user.paid;
    if (!pro || pro.paid !== paid || !fresh) await chrome.storage.local.set({pro: {paid, checked: Date.now()}});
    return paid;
  } catch {
    return !!pro?.paid; // offline or ExtensionPay unreachable: keep the last known answer
  }
}

async function plan() {
  const {usage} = await chrome.storage.local.get('usage');
  const used = usage?.day === today() ? usage.count : 0;
  return {pro: await proStatus(false), used, limit: CONFIG.freePagesPerDay};
}

async function recordPage() {
  const {usage} = await chrome.storage.local.get('usage');
  const day = today();
  const count = (usage?.day === day ? usage.count : 0) + 1;
  await chrome.storage.local.set({usage: {day, count}, lifetime: ((await chrome.storage.local.get('lifetime')).lifetime || 0) + 1});
  return plan();
}

extpay.onPaid.addListener(() => chrome.storage.local.set({pro: {paid: true, checked: Date.now()}}));

/* ------------------------------------------------------------------------------------------
 * Ollama status for the setup page.
 * ---------------------------------------------------------------------------------------- */

async function ollamaStatus() {
  await rulesReady;
  try {
    const version = await (await fetch(OLLAMA_HOSTS[0] + 'api/version', {signal: AbortSignal.timeout(2500)})).json();
    const tags = await (await fetch(OLLAMA_HOSTS[0] + 'api/tags', {signal: AbortSignal.timeout(5000)})).json();
    return {running: true, version: version.version, models: (tags.models || []).map(m => ({name: m.name, size: m.size}))};
  } catch {
    return {running: false, models: []};
  }
}

/* ------------------------------------------------------------------------------------------
 * Opening the translator on a tab.
 * ---------------------------------------------------------------------------------------- */

const welcomeUrl = (hash = '') => chrome.runtime.getURL('welcome.html') + hash;

async function openWelcome(hash) {
  const url = welcomeUrl(hash);
  const [existing] = await chrome.tabs.query({url: chrome.runtime.getURL('welcome.html') + '*'});
  if (existing) { await chrome.tabs.update(existing.id, {active: true, url}); await chrome.windows.update(existing.windowId, {focused: true}); }
  else await chrome.tabs.create({url});
}

async function inject(tabId) {
  await chrome.scripting.executeScript({target: {tabId}, files: ['translator.js']});
}

async function openOn(tab) {
  if (!tab?.id) return;
  if (tab.url?.startsWith(chrome.runtime.getURL(''))) return; // the demo page runs it already
  try {
    await inject(tab.id);
    await chrome.tabs.sendMessage(tab.id, {type: 'open'});
  } catch {
    // Firefox: website access hasn't been allowed yet; the setup page asks for it.
    if (!(await chrome.permissions.contains({origins: ['<all_urls>']}).catch(() => true))) return openWelcome();
    // Browser pages, the extension stores and PDF viewers don't allow extensions.
    chrome.action.setBadgeBackgroundColor({color: '#e5306b', tabId: tab.id});
    chrome.action.setBadgeText({text: '✕', tabId: tab.id});
    chrome.action.setTitle({title: 'Translation isn’t possible on this page', tabId: tab.id});
    setTimeout(() => chrome.action.setBadgeText({text: '', tabId: tab.id}).catch(() => {}), 4000);
  }
}

chrome.action.onClicked.addListener(openOn);

chrome.runtime.onInstalled.addListener(details => {
  chrome.contextMenus.create({id: 'translate-page', title: 'Translate this page', contexts: ['page', 'image']}, () => void chrome.runtime.lastError);
  chrome.contextMenus.create({id: 'setup', title: 'Setup and plan', contexts: ['action']}, () => void chrome.runtime.lastError);
  if (details.reason === 'install') openWelcome();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-page') openOn(tab);
  if (info.menuItemId === 'setup') openWelcome();
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const answer = promise => { promise.then(reply, error => reply({error: String(error?.message || error)})); return true; };
  switch (message?.type) {
    case 'plan': return answer(plan());
    case 'used': return answer(recordPage());
    case 'refresh-pro': return answer(proStatus(true).then(() => plan()));
    case 'buy': extpay.openPaymentPage(); reply({ok: true}); return false;
    case 'manage': case 'login': extpay.openLoginPage(); reply({ok: true}); return false;
    case 'welcome': return answer(openWelcome(message.hash).then(() => ({ok: true})));
    case 'ollama': return answer(ollamaStatus());
    // Sites set to "always translate": the small page script asks for the translator.
    case 'auto': if (sender.tab?.id) inject(sender.tab.id).catch(() => {}); reply({ok: true}); return false;
  }
  return false;
});
