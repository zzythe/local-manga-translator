// Setup page: installs nothing itself, but walks the user through Ollama and the model,
// noticing each step as soon as it's done. Also shows the free-plan meter and Pro.
const $ = id => document.getElementById(id);
const ask = message => chrome.runtime.sendMessage(message);
const VISION = /qwen3-vl|qwen2\.5vl|vl|vision|llava|gemma3|minicpm-v|pixtral|llama4/i;

const gb = bytes => (bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1) + ' GB';
const setState = (step, state, pill) => { $(step).dataset.state = state; if (pill != null) $(step).querySelector('.pill') && ($(step).querySelector('.pill').textContent = pill); };

$('version').textContent = 'Version ' + chrome.runtime.getManifest().version;
document.querySelectorAll('.limit-text').forEach(n => { n.textContent = CONFIG.freePagesPerDay; });
$('price').textContent = CONFIG.proPrice;

/* ---------- Step 1: the download that fits this computer ---------- */

const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
if (platform.includes('win')) {
  $('engine-download').href = 'https://ollama.com/download/OllamaSetup.exe';
  $('engine-download').textContent = 'Download Ollama for Windows';
  $('engine-hint').textContent = 'The installer is about 1.9 GB. Open it when it finishes and click Install. This page notices by itself when Ollama is ready.';
} else if (platform.includes('mac')) {
  $('engine-download').href = 'https://ollama.com/download/Ollama.dmg';
  $('engine-download').textContent = 'Download Ollama for Mac';
  $('engine-hint').textContent = 'Open the downloaded file, drag Ollama to Applications and open it once. This page notices by itself when it\'s ready.';
} else if (platform.includes('linux')) {
  $('engine-download').hidden = true;
  $('engine-linux').hidden = false;
  $('engine-hint').textContent = 'Paste this into a terminal. This page notices by itself when Ollama is ready.';
}
$('copy-linux').onclick = async () => {
  await navigator.clipboard.writeText($('engine-linux').querySelector('code').textContent);
  $('copy-linux').textContent = 'Copied';
};

/* ---------- Status polling ---------- */

let status = {running: false, models: []}, downloading = false, choosing = false;

async function refresh() {
  try { status = await ask({type: 'ollama'}); } catch { status = {running: false, models: []}; }
  render();
}

function render() {
  if (status.running) {
    setState('step-engine', 'done', 'Ready');
    $('engine-ok').textContent = `Ollama ${status.version || ''} is running.`;
  } else {
    setState('step-engine', 'active', 'Not found yet');
  }

  const vision = status.models.filter(m => VISION.test(m.name));
  if (!status.running) {
    if (!downloading) setState('step-model', 'waiting', 'Waiting for step 1');
    $('model-download').disabled = true;
  } else if (vision.length && !downloading && !choosing) {
    setState('step-model', 'done', 'Ready');
    $('model-choices').hidden = true; $('model-download').hidden = true; $('model-progress').hidden = true;
    $('model-ok').textContent = `Installed: ${vision.map(m => `${m.name} (${gb(m.size)})`).join(', ')}.`;
  } else if (!downloading) {
    setState('step-model', 'active', vision.length ? 'Choose a size' : 'Not downloaded');
    $('model-choices').hidden = false; $('model-download').hidden = false;
    $('model-download').disabled = false;
  }

  const ready = status.running && vision.length && !downloading;
  setState('step-try', ready ? 'active' : 'waiting');
}

refresh();
setInterval(() => { if (!downloading) refresh(); }, 2500);

/* ---------- Step 2: model download with progress ---------- */

$('model-change').onclick = () => { choosing = true; render(); };

$('model-download').onclick = () => {
  const model = document.querySelector('input[name="model"]:checked').value;
  downloading = true;
  $('model-error').hidden = true;
  $('model-download').disabled = true;
  $('model-choices').disabled = true;
  $('model-progress').hidden = false;
  setState('step-model', 'active', 'Downloading…');
  $('model-status').textContent = 'Starting the download…';

  const port = chrome.runtime.connect({name: 'pull'});
  const ping = setInterval(() => { try { port.postMessage({type: 'ping'}); } catch {} }, 15000);
  const layers = new Map();
  const samples = [];
  let finished = false;

  const finish = error => {
    if (finished) return;
    finished = true; downloading = false; clearInterval(ping);
    try { port.disconnect(); } catch {}
    $('model-choices').disabled = false;
    if (error) {
      $('model-error').hidden = false;
      $('model-error').textContent = `The download stopped: ${error} Check your internet connection and that Ollama is still running, then try again. It continues where it left off.`;
      $('model-download').disabled = false;
      $('model-download').textContent = 'Try again';
      setState('step-model', 'active', 'Stopped');
    } else {
      choosing = false;
      // Use the model just downloaded.
      chrome.storage.local.get('settings').then(({settings}) => chrome.storage.local.set({settings: {...(settings || {}), model}}));
    }
    refresh();
  };

  port.onMessage.addListener(message => {
    if (message.type === 'error') return finish(message.message);
    if (message.type === 'done') return finish();
    if (message.digest && message.total) layers.set(message.digest, {total: message.total, completed: message.completed || 0});
    const total = [...layers.values()].reduce((s, l) => s + l.total, 0);
    const done = [...layers.values()].reduce((s, l) => s + l.completed, 0);
    if (total > 1e6) {
      const now = performance.now();
      samples.push([now, done]);
      while (samples.length > 2 && now - samples[0][0] > 8000) samples.shift();
      const [t0, d0] = samples[0];
      const speed = now - t0 > 1000 ? (done - d0) / ((now - t0) / 1000) : 0;
      const left = speed > 0 ? (total - done) / speed : 0;
      $('model-fill').style.width = `${Math.min(100, 100 * done / total).toFixed(1)}%`;
      const eta = left > 90 ? `about ${Math.round(left / 60)} min left` : left > 0 ? 'less than 2 min left' : '';
      $('model-status').textContent = [`${gb(done)} of ${gb(total)}`, speed ? `${(speed / 1e6).toFixed(0)} MB/s` : '', eta].filter(Boolean).join(' · ');
    } else if (message.status) {
      $('model-status').textContent = /verifying|writing|success/.test(message.status) ? 'Finishing up…' : 'Preparing…';
    }
  });
  port.onDisconnect.addListener(() => finish('the connection to the extension closed.'));
  port.postMessage({type: 'start', model});
};

/* ---------- Plan ---------- */

async function renderPlan() {
  let plan;
  try { plan = await ask({type: 'plan'}); } catch { return; }
  if (!plan || plan.error) return;
  $('plan-free').hidden = plan.pro;
  $('plan-pro').hidden = !plan.pro;
  const left = Math.max(0, plan.limit - plan.used);
  $('plan-left').textContent = left;
  $('plan-limit').textContent = plan.limit;
  $('plan-fill').style.width = `${Math.round(100 * left / plan.limit)}%`;
  $('plan').classList.toggle('low', left <= Math.ceil(plan.limit / 6));
}
renderPlan();
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.usage || changes.pro)) renderPlan(); });
$('buy').onclick = () => ask({type: 'buy'});
$('login').onclick = () => ask({type: 'login'});
$('manage').onclick = () => ask({type: 'manage'});
// Coming back from the payment tab: check again right away.
addEventListener('focus', () => ask({type: 'refresh-pro'}).then(renderPlan).catch(() => {}));

/* ---------- Firefox: website access is granted separately ---------- */

const ALL_SITES = {origins: ['<all_urls>']};
async function checkAccess() {
  try { $('access').hidden = await chrome.permissions.contains(ALL_SITES); } catch { $('access').hidden = true; }
}
// permissions.request must run directly inside the click.
$('access-grant').onclick = () => chrome.permissions.request(ALL_SITES).then(checkAccess, checkAccess);
checkAccess();
