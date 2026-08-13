// A2I chat core — ported 1:1 from the original single-file app (index.html).
// Runs inside a client-only React shell (ChatShell) that mounts the original
// markup into the DOM before initApp() executes.

import { T, Tf, getLang, setLang } from '../lib/i18n';

export function initApp(): void {
// Robust element lookup: if an element is ever missing (typo, markup change),
// return a harmless no-op stub instead of null so a single bad id can never
// crash init and take the whole app down with it.
const _elStub: any = new Proxy({}, {
  get(_t, p) {
    if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    if (p === 'style' || p === 'dataset') return {};
    if (p === 'querySelector') return () => _elStub;
    if (p === 'querySelectorAll') return () => [];
    if (p === 'value' || p === 'textContent' || p === 'innerHTML') return '';
    if (p === 'hidden' || p === 'disabled') return false;
    if (p === 'files' || p === 'options' || p === 'children') return [];
    return () => _elStub; // methods (addEventListener, append, focus, …) → no-op
  },
  set() { return true; },
});
// This UI mounts static HTML dynamically, so individual element types are only known
// at the call site. Keep the permissive boundary here rather than disabling TypeScript
// validation for the entire application.
const $ = (id: string): any => document.getElementById(id) || _elStub;

// ---- Icon system --------------------------------------------------------
// A small set of hand-authored outline icons (24x24, Lucide/Feather-style:
// stroke=currentColor, no fill) for elements built at runtime. Static markup
// in the HTML inlines the same style of <svg> directly; this covers the
// pieces JS creates (message actions, chat-list rows, palette entries, …) so
// those strings live in one place instead of being duplicated per call site.
const ICONS = {
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  key: '<circle cx="7" cy="15" r="4"/><line x1="10.5" y1="11.5" x2="19" y2="3"/><line x1="15.5" y1="7" x2="18" y2="9.5"/><line x1="18" y1="4" x2="20.5" y2="6.5"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  pin: '<path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  sparkles: '<path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"/>',
  bot: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><line x1="4" y1="21" x2="20" y2="21"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
  message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="10" y="10" width="4" height="4"/><line x1="9" y1="2" x2="9" y2="5"/><line x1="15" y1="2" x2="15" y2="5"/><line x1="9" y1="19" x2="9" y2="22"/><line x1="15" y1="19" x2="15" y2="22"/><line x1="2" y1="9" x2="5" y2="9"/><line x1="2" y1="15" x2="5" y2="15"/><line x1="19" y1="9" x2="22" y2="9"/><line x1="19" y1="15" x2="22" y2="15"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
};
// Full <svg> markup for one icon; `cls` adds extra classes (e.g. 'ico-sm').
function svgIcon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `${ICONS[name] || ''}</svg>`;
}

const log = $('log'), col = $('col'), form = $('form'), input = $('input');
const send = $('send'), stopBtn = $('stop'), regenBtn = $('regen');
const engineSel = $('engine'), modelSel = $('model'), serverUrl = $('server-url');
const browserModelOptions = modelSel.innerHTML;
const statusEl = $('status'), dot = $('dot'), progress = $('progress');
const SYSTEM_PROMPT =
  'You are A2I, a helpful all-in-one AI assistant. Answer clearly and accurately. ' +
  'If context documents are provided, ground your answer in them.';

// Coder mode — a coding-specialist persona. Kept deliberately concrete so
// small local models (Qwen2.5-Coder, DeepSeek-Coder, Code Llama) follow it.
const CODER_PROMPT =
  'You are A2I Coder, an expert programming assistant. Rules:\n' +
  '1. Always put code in fenced blocks with the language tag ' +
  '(```python, ```ts, ```bash, …).\n' +
  '2. Write complete, runnable code — no "..." placeholders — and keep it ' +
  'idiomatic for the language.\n' +
  '3. Explain briefly BEFORE the code, not line by line after it.\n' +
  '4. Point out bugs, edge cases and security issues you notice.\n' +
  '5. When debugging, state the root cause first, then the fix.\n' +
  '6. If the request is ambiguous, state your assumption and proceed.\n' +
  'Reply in the language of the question (Khmer or English), but keep code, ' +
  'identifiers and error messages in English.';

let coderMode = localStorage.getItem('a2i-coder') === '1';
const activePrompt = () => (coderMode ? CODER_PROMPT : SYSTEM_PROMPT);
// Coding benefits from low randomness; general chat from a bit more.
const activeTemperature = () => (coderMode ? 0.2 : 0.7);

// ---- Coder mode --------------------------------------------------------

function refreshCoderUI() {
  const btn = $('coder-btn');
  btn.classList.toggle('on', coderMode);
  document.body?.classList.toggle('coder', coderMode);
  btn.title = coderMode
    ? 'Coder mode ON — expert coding assistant (click to turn off)'
    : 'Coder mode — expert coding assistant';
  input.placeholder = coderMode
    ? 'សួរអំពីកូដ… Ask about code, paste an error, request a function…'
    : 'សួរអ្វីក៏បាន… Ask anything…';
}
$('coder-btn').addEventListener('click', () => {
  coderMode = !coderMode;
  localStorage.setItem('a2i-coder', coderMode ? '1' : '0');
  refreshCoderUI();
  if (typeof showWelcome === 'function' && $('welcome')) showWelcome();
});

// ---- Theme -------------------------------------------------------------

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('a2i-theme', theme);
}
applyTheme(localStorage.getItem('a2i-theme') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('theme-btn').addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

// ---- Repair: clear a corrupt/partial model cache and reload ------------
// A model download interrupted by a broken GPU or a dropped connection can
// leave a partial file in CacheStorage / IndexedDB / OPFS that makes the
// next load hang. This clears model caches (keeping saved chats) and reloads.
async function repairModelCache() {
  const btn = $('repair-btn');
  btn.textContent = '⏳ …';
  try {
    if (window.caches) {
      for (const k of await caches.keys()) await caches.delete(k);
    }
  } catch { /* ignore */ }
  try {
    if (indexedDB.databases) {
      for (const db of await indexedDB.databases()) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    }
  } catch { /* ignore */ }
  try {
    const root = await navigator.storage?.getDirectory?.();
    if (root) {
      for await (const name of root.keys()) {
        await root.removeEntry(name, { recursive: true }).catch(() => {});
      }
    }
  } catch { /* ignore */ }
  // Unregister service workers so a stale cached app can't come back.
  try {
    if (navigator.serviceWorker) {
      for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    }
  } catch { /* ignore */ }
  // Give the GPU another chance after a manual repair.
  localStorage.removeItem('a2i-gpu-broken');
  location.reload(true);
}
$('repair-btn').addEventListener('click', repairModelCache);

// ---- Sidebar / conversations -------------------------------------------

const sidebar = $('sidebar');
$('menu-btn').addEventListener('click', () => sidebar.classList.toggle('open'));

let chats = [];
try { chats = JSON.parse(localStorage.getItem('a2i-chats') || '[]'); } catch { chats = []; }
let currentId = null;
let history = [{ role: 'system', content: SYSTEM_PROMPT }];

const saveChats = () => {
  try {
    localStorage.setItem('a2i-chats', JSON.stringify(chats.slice(0, 50)));
  } catch {
    // Storage full (usually attached images) — persist text only so chat
    // history and titles still survive across reloads.
    const lean = chats.slice(0, 50).map((c) => ({
      ...c,
      messages: c.messages.map((m) => (m.images ? { ...m, images: undefined } : m)),
    }));
    try { localStorage.setItem('a2i-chats', JSON.stringify(lean)); } catch { /* give up */ }
  }
};

function startRename(title, chat) {
  const inp = document.createElement('input');
  inp.className = 'rename-input';
  inp.value = chat.title || '';
  title.replaceWith(inp);
  inp.focus(); inp.select();
  let done = false;
  const finish = (save) => {
    if (done) return; done = true;
    if (save && inp.value.trim()) {
      chat.title = inp.value.trim().slice(0, 60);
      chat.renamed = true;
      saveChats();
    }
    renderChatList();
  };
  inp.addEventListener('click', (e) => e.stopPropagation());
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}

function renderChatList() {
  const list = $('chat-list');
  list.innerHTML = '';
  const sorted = [...chats].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
  for (const chat of sorted) {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === currentId ? ' active' : '');
    item.addEventListener('click', () => openChat(chat.id));

    const pin = document.createElement('button');
    pin.className = 'pin' + (chat.pinned ? ' on' : '');
    pin.innerHTML = svgIcon('pin', 'ico-sm');
    pin.title = chat.pinned ? 'Unpin' : 'Pin to top';
    pin.addEventListener('click', (e) => {
      e.stopPropagation(); chat.pinned = !chat.pinned; saveChats(); renderChatList();
    });

    const title = document.createElement('span');
    title.className = 't';
    title.textContent = chat.title || 'ជជែក / Chat';

    const ren = document.createElement('button');
    ren.className = 'ren'; ren.innerHTML = svgIcon('pencil', 'ico-sm'); ren.title = 'Rename';
    ren.addEventListener('click', (e) => { e.stopPropagation(); startRename(title, chat); });

    const del = document.createElement('button');
    del.className = 'del'; del.innerHTML = svgIcon('x', 'ico-sm'); del.title = 'Delete';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteChat(chat.id); });

    item.append(pin, title, ren, del);
    list.appendChild(item);
  }
}

function persistChat() {
  if (history.filter((m) => m.role !== 'system').length === 0) return;
  if (!currentId) {
    currentId = Date.now().toString(36);
    chats.unshift({ id: currentId, title: '', messages: [] });
  }
  const chat = chats.find((c) => c.id === currentId);
  chat.messages = history;
  if (!chat.renamed) {
    chat.title = (history.find((m) => m.role === 'user')?.content || 'Chat').slice(0, 42);
  }
  chat.updated = Date.now();
  saveChats();
  renderChatList();
}

function newChat() {
  currentId = null;
  history = [{ role: 'system', content: SYSTEM_PROMPT }];
  renderChat();
  renderChatList();
  input.focus();
}
$('new-chat').addEventListener('click', newChat);

function openChat(id) {
  const chat = chats.find((c) => c.id === id);
  if (!chat) return;
  currentId = id;
  history = chat.messages;
  renderChat();
  renderChatList();
  sidebar.classList.remove('open');
}

function deleteChat(id) {
  chats = chats.filter((c) => c.id !== id);
  saveChats();
  if (currentId === id) newChat(); else renderChatList();
}

// ---- Markdown (safe, dependency-free) ----------------------------------

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderMarkdown(src) {
  const blocks = [];
  src = src.replace(/```(\w*)\n?([\s\S]*?)(```|$)/g, (m, lang, code) => {
    blocks.push(code);
    return '\u0000' + (blocks.length - 1) + '\u0000';
  });
  let html = escapeHtml(src)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^## (.*)$/gm, '<h3>$1</h3>')
    .replace(/^# (.*)$/gm, '<h2>$1</h2>')
    .replace(/^\s*[-*•] (.*)$/gm, '<li>$1</li>')
    .replace(/^\s*\d+\. (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, (m) => '<ul>' + m + '</ul>');
  html = '<p>' + html.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  return html.replace(/\u0000(\d+)\u0000/g, (m, i) =>
    `<div class="code-wrap"><div class="code-head"><span>${escapeHtml(blocks[+i].slice(0, 32))}</span><button type="button" class="code-copy">Copy</button></div><pre><code>${escapeHtml(blocks[+i])}</code></pre></div>`);
}

// Copy button for code blocks (event delegation — works for streamed content).
log.addEventListener('click', (e) => {
  const btn = e.target.closest('.code-copy');
  if (!btn) return;
  const code = btn.closest('.code-wrap')?.querySelector('pre code')?.textContent;
  if (!code) return;
  navigator.clipboard?.writeText(code).then(() => {
    btn.textContent = T('copied') + ' ✓';
    setTimeout(() => { btn.textContent = T('copy'); }, 1200);
  });
});

// ---- Chat rendering ----------------------------------------------------

function toast(msg, type) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' toast-' + type : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, 2600);
}

function showWelcome() {
  const heading = coderMode ? T('coderHeading') : T('welcomeHeading');
  const sub = coderMode
    ? T('coderSub')
    : T('welcomeSub');
  col.innerHTML = `
    <div id="welcome">
      <div class="logo-big">A2</div>
      <h2></h2>
      <p></p>
      <div class="chips"></div>
      <div class="w-feats"></div>
    </div>`;
  col.querySelector('#welcome h2').textContent = heading;
  col.querySelector('#welcome p').innerHTML = sub;
  const chips = col.querySelector('.chips');
  const prompts = coderMode ? [
    T('chipCsv'), T('chipError'), T('chipApi'), T('chipReview'),
  ] : [
    T('chipHowAi'), T('chipMath'), T('chipImage'), T('chipAudio'), T('chipPoem'), T('chipBenefits'),
  ];
  for (const text of prompts) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = text;
    chip.addEventListener('click', () => { input.value = text; form.requestSubmit(); });
    chips.appendChild(chip);
  }
  // Feature cards expose only local execution paths. No remote provider,
  // account, key or web-search workflow is offered from the local-only UI.
  const feats = col.querySelector('.w-feats');
  const mk = (ico, title, sub, status, st, click) => {
    const b = document.createElement('button');
    b.className = 'w-feat';
    b.title = title + (sub ? ' — ' + sub : '') + (status ? ' (' + status + ')' : '');
    b.innerHTML =
      '<span class="wf-ico">' + ico + '</span>' +
      '<span class="wf-t">' + title + '</span>' +
      '<span class="wf-s">' + sub + '</span>' +
      (status ? '<span class="wf-st ' + st + '">' + status + '</span>' : '');
    b.addEventListener('click', click);
    feats.appendChild(b);
  };
  const localCore = a2iCoreBrain();
  mk(svgIcon('chip', 'ico-sm'), 'A2I Core', 'Local GGUF model on your PC',
    localCore?.online === false ? 'offline' : 'local', localCore?.online === false ? 'warn' : 'ok',
    () => { engineSel.value = 'server:0'; engineSel.dispatchEvent(new Event('change')); });
  mk(svgIcon('bolt', 'ico-sm'), T('featBrowserT'), T('featBrowserS'), T('featBrowserSt'), 'warn',
    () => { engineSel.value = 'browser'; engineSel.dispatchEvent(new Event('change')); });
  mk(svgIcon('settings', 'ico-sm'), 'Local model library', 'Review verified GGUF model options', 'Settings', 'ok',
    () => openSettings());
  mk(svgIcon('code', 'ico-sm'), 'Project review', 'Ask about files or request review-first edit proposals', 'Local', 'ok',
    () => $('project-btn').click());
  feats.style.display = 'none';
  requestAnimationFrame(() => { feats.style.display = 'grid'; });
}

function addMsg(cls, text, label, images) {
  const welcome = $('welcome');
  if (welcome) welcome.remove();
  const div = document.createElement('div');
  if (cls === 'note') {
    div.className = 'note';
    div.textContent = text;
    div.update = () => {};
  } else if (cls === 'user') {
    div.className = 'msg user';
    if (images && images.length) {
      const gal = document.createElement('div');
      gal.className = 'msg-imgs';
      for (const src of images) {
        const im = document.createElement('img');
        im.src = src; im.alt = 'attached image';
        gal.appendChild(im);
      }
      div.appendChild(gal);
    }
    if (text) {
      const tx = document.createElement('div');
      tx.textContent = text;
      div.appendChild(tx);
    }
    div.update = () => {};
  } else {
    // AI message: avatar | (label, content, hover action bar) — the layout
    // readers know from Claude/ChatGPT, so the eye can skim who-said-what by
    // the left rail alone.
    div.className = 'msg ' + cls;
    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.textContent = 'A2';
    div.appendChild(avatar);
    const wrap = document.createElement('div');
    wrap.className = 'msg-body';
    div.appendChild(wrap);

    let labelEl = null;
    if (label) {
      labelEl = document.createElement('div');
      labelEl.className = 'brain-label';
      labelEl.textContent = label;
      wrap.appendChild(labelEl);
    }
    div.setLabel = (t) => {
      if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.className = 'brain-label';
        wrap.insertBefore(labelEl, wrap.firstChild);
      }
      labelEl.textContent = t;
    };
    const body = document.createElement('div');
    body.className = 'md';
    wrap.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    wrap.appendChild(actions);
    let raw = text;
    const speakBtn = document.createElement('button');
    speakBtn.className = 'act-btn';
    speakBtn.innerHTML = svgIcon('volume', 'ico-sm');
    speakBtn.title = 'Read aloud / អានឮៗ';
    speakBtn.addEventListener('click', () => speakText(raw));
    actions.appendChild(speakBtn);
    // Chain the answer into a saveable narration (chat → audio, n8n-style).
    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'act-btn';
    voiceBtn.innerHTML = svgIcon('download', 'ico-sm');
    voiceBtn.title = 'Voice this answer → audio file / បំប្លែងជាសំឡេង';
    voiceBtn.addEventListener('click', async () => {
      if (voiceBtn.disabled || !raw) return;
      voiceBtn.disabled = true;
      voiceBtn.innerHTML = '<span class="typing" aria-label="generating"><i></i><i></i><i></i></span>';
      const clean = raw.replace(/[#*`>_~]/g, '').slice(0, AUDIO_MAX_CHARS);
      try {
        const player = await buildAudioWrap(audioUrl(clean));
        wrap.appendChild(player);
        log.scrollTop = log.scrollHeight;
        voiceBtn.innerHTML = svgIcon('check', 'ico-sm');
      } catch {
        voiceBtn.innerHTML = svgIcon('download', 'ico-sm');
        voiceBtn.disabled = false;
        voiceBtn.title = '⚠ Failed — try again / បរាជ័យ ព្យាយាមម្តងទៀត';
      }
    });
    actions.appendChild(voiceBtn);
    const copy = document.createElement('button');
    copy.className = 'act-btn';
    copy.innerHTML = svgIcon('copy', 'ico-sm');
    copy.title = 'Copy';
    actions.appendChild(copy);
    copy.addEventListener('click', () => {
      navigator.clipboard?.writeText(raw);
      copy.innerHTML = svgIcon('check', 'ico-sm');
      toast('Copied to clipboard', 'ok');
      setTimeout(() => { copy.innerHTML = svgIcon('copy', 'ico-sm'); }, 1200);
    });

    div.update = (t) => {
      raw = t;
      // A bare ellipsis means "waiting for the first token": show a live
      // typing indicator instead of a static character.
      body.innerHTML = (t === '…')
        ? '<span class="typing" aria-label="thinking"><i></i><i></i><i></i></span>'
        : renderMarkdown(t);
      log.scrollTop = log.scrollHeight;
    };
    // Zen & reasoning models stream their chain-of-thought first — show it in
    // a collapsible "Thinking" block above the answer.
    let reasonEl = null, reasonBody = null, reasonRaw = '';
    div.setReason = (t) => {
      reasonRaw = t;
      if (!reasonEl) {
        reasonEl = document.createElement('details');
        reasonEl.className = 'reasoning';
        const sum = document.createElement('summary');
        sum.textContent = 'Thinking…';
        reasonEl.appendChild(sum);
        reasonBody = document.createElement('div');
        reasonBody.className = 'reasoning-body';
        reasonEl.appendChild(reasonBody);
        wrap.insertBefore(reasonEl, body);
      }
      reasonBody.textContent = t;
      reasonEl.querySelector('summary').textContent = 'Thinking (' +
        t.split(/\s+/).length + ' words)';
    };
    div.update(text);
  }
  col.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function renderChat() {
  col.innerHTML = '';
  const msgs = history.filter((m) => m.role !== 'system');
  if (!msgs.length) { showWelcome(); regenBtn.style.display = 'none'; return; }
  for (const m of msgs) {
    if (m.role === 'user') { addMsg('user', m.content, null, m.images); continue; }
    if (m.genImage) {
      const d = addMsg('ai', '', 'A2I Image');
      const b = d.querySelector('.md');
      b.innerHTML = '';
      const im = new Image(); im.className = 'gen-img'; im.src = m.genImage;
      im.alt = m.content || 'generated image';
      b.appendChild(im);
      continue;
    }
    if (m.genAudio) {
      const d = addMsg('ai', '', 'A2I Audio');
      const b = d.querySelector('.md');
      b.innerHTML = '';
      const au = document.createElement('audio');
      au.className = 'gen-audio'; au.controls = true; au.src = m.genAudio;
      b.appendChild(au);
      continue;
    }
    addMsg('ai', m.content, 'A2I');
  }
  regenBtn.style.display =
    msgs.at(-1)?.role === 'assistant' ? 'grid' : 'none';
}

// ---- Knowledge base (files in knowledge/, listed in knowledge/index.json) --

const knowledgeChunks = [];
const docFreq = new Map();

const tokenize = (text) => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);

function addKnowledgeDoc(source, text) {
  const SIZE = 800, OVERLAP = 100;
  for (let start = 0; start < text.length; start += SIZE - OVERLAP) {
    const chunkText = text.slice(start, start + SIZE).trim();
    if (!chunkText) continue;
    const terms = new Map();
    for (const t of tokenize(chunkText)) terms.set(t, (terms.get(t) || 0) + 1);
    for (const t of terms.keys()) docFreq.set(t, (docFreq.get(t) || 0) + 1);
    knowledgeChunks.push({ source, text: chunkText, terms });
  }
}

function searchKnowledge(query, topK = 3) {
  const qTerms = new Map();
  for (const t of tokenize(query)) qTerms.set(t, (qTerms.get(t) || 0) + 1);
  if (!qTerms.size || !knowledgeChunks.length) return [];
  const idf = (t) => Math.log((1 + knowledgeChunks.length) / (1 + (docFreq.get(t) || 0))) + 1;
  const scored = knowledgeChunks.map((c) => {
    let dotp = 0;
    for (const [t, q] of qTerms) if (c.terms.has(t)) dotp += q * idf(t) * c.terms.get(t) * idf(t);
    let norm = 0;
    for (const [t, n] of c.terms) norm += (n * idf(t)) ** 2;
    return { c, score: norm ? dotp / Math.sqrt(norm) : 0 };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
    .filter((s) => s.score > 0).map((s) => s.c);
}

async function loadKnowledge() {
  try {
    const files = await (await fetch('knowledge/index.json')).json();
    for (const name of files) {
      try {
        addKnowledgeDoc(name, await (await fetch('knowledge/' + name)).text());
      } catch { /* skip unreadable file */ }
    }
  } catch { /* no knowledge folder — fine */ }
}

// ---- Wikipedia grounding (idea from vane's search researcher) ----------

const wikiToggle = $('wiki-toggle');
wikiToggle.checked = localStorage.getItem('a2i-wiki') !== 'off';
wikiToggle.addEventListener('change', () =>
  localStorage.setItem('a2i-wiki', wikiToggle.checked ? 'on' : 'off'));

// Which sources to consult — vane's focus modes. "auto" lets each action
// decide from the query; the others force or disable a source.
let searchMode = localStorage.getItem('a2i-search-mode') || 'auto';
const searchModeSel = $('search-mode');
searchModeSel.value = searchMode;
searchModeSel.addEventListener('change', () => {
  searchMode = searchModeSel.value;
  localStorage.setItem('a2i-search-mode', searchMode);
  wikiToggle.checked = searchMode !== 'off';
  localStorage.setItem('a2i-wiki', wikiToggle.checked ? 'on' : 'off');
});

async function searchWikipedia(query) {
  if (!wikiToggle.checked) return [];
  const langs = /[ក-៿]/.test(query) ? ['km', 'en'] : ['en'];
  const results = [];
  for (const lang of langs) {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query` +
        `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=2` +
        `&prop=extracts&exintro&explaintext&format=json&origin=*`;
      const data = await (await fetch(url, { signal: AbortSignal.timeout(5000) })).json();
      for (const page of Object.values(data?.query?.pages || {})) {
        if (page.extract) {
          results.push({
            source: `Wikipedia (${lang}): ${page.title}`,
            text: page.extract.slice(0, 1200),
          });
        }
      }
      if (results.length) break;
    } catch { /* offline or blocked — answer without Wikipedia */ }
  }
  return results.slice(0, 2);
}

// ---- Source-specific search (vane's academic / discussion modes) -------
// vane routes a query to different sources depending on what it is asking
// for. Both endpoints below are keyless and CORS-open, so this keeps A2I's
// "no API key" promise. Each fails silently — grounding is a bonus, never a
// requirement for answering.

async function searchAcademic(query) {
  try {
    const url = 'https://export.arxiv.org/api/query?search_query=all:' +
      encodeURIComponent(query) + '&max_results=3&sortBy=relevance';
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
    return [...xml.querySelectorAll('entry')].slice(0, 3).map((entry) => {
      const title = entry.querySelector('title')?.textContent?.trim() || 'paper';
      const summary = entry.querySelector('summary')?.textContent?.trim() || '';
      const published = entry.querySelector('published')?.textContent?.slice(0, 4) || '';
      return { source: `arXiv (${published}): ${title}`, text: summary.slice(0, 900) };
    });
  } catch { return []; }
}

async function searchDiscussions(query) {
  try {
    const url = 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=4&query=' +
      encodeURIComponent(query);
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits || [])
      .filter((hit) => hit.title)
      .slice(0, 3)
      .map((hit) => ({
        source: `Hacker News (${hit.points || 0} points, ${hit.num_comments || 0} comments): ${hit.title}`,
        text: (hit.story_text || hit.title || '').slice(0, 700) +
          (hit.url ? `\n${hit.url}` : ''),
      }));
  } catch { return []; }
}

// Which sources a query calls for. Declarative, like looksLikeCode(), rather
// than vane's LLM classifier — small local models classify unreliably.
const wantsAcademic = (q) =>
  /\b(paper|papers|study|studies|research|arxiv|citation|cite|journal|scholar|thesis|preprint)\b/i.test(q) ||
  /\b(ស្រាវជ្រាវ|អត្ថបទវិទ្យាសាស្ត្រ)\b/.test(q);

const wantsDiscussions = (q) =>
  /\b(opinion|opinions|experience|experiences|review|reviews|people think|think about|recommend|recommendation|vs\.?|versus|pros and cons|best practice)\b/i.test(q) ||
  /\b(យោបល់|បទពិសោធ)\b/.test(q);

// ---- Calculator tool (idea from ai-sdk tools) ---------------------------

function calculate(query) {
  const match = query.match(/[-+]?[\d.,]+(?:\s*[-+*/×÷^]\s*[-+]?[\d.,()]+)+/);
  if (!match) return null;
  const expr = match[0].replaceAll(',', '').replaceAll('×', '*')
    .replaceAll('÷', '/').replaceAll('^', '**');
  if (!/^[\d\s+\-*/().]+$/.test(expr.replaceAll('**', ''))) return null;
  try {
    const value = Function(`"use strict"; return (${expr});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return `${match[0].trim()} = ${value}`;
  } catch {
    return null;
  }
}

// Rough char budgets so the whole prompt stays within a small local model's
// context window (CPU engine uses n_ctx 4096; ~1 token ≈ 2.5 chars for mixed
// Khmer/English, so keep the prompt well under that).
//
// The single-thread compat engine (browsers without JSPI) prefills the whole
// prompt on one core, so its wait time is dominated by prompt length far more
// than the multi-thread path. Smaller budgets there trade a little grounding
// depth for a much shorter time-to-first-token — the actual complaint people
// have ("it's slow") is almost always this wait, not the generation speed.
function usingCompatEngine() {
  return engineSel.value === 'browser' && needsWllamaCompat();
}
function contextCharBudget() { return usingCompatEngine() ? 500 : 1500; }
function historyCharBudget() { return usingCompatEngine() ? 1200 : 4000; }

// Keep the system message plus the most recent turns that fit the budget.
function fitHistory(systemMsg, turns) {
  const budget = historyCharBudget();
  const kept = [];
  let used = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const len = turns[i].content.length + 8;
    if (used + len > budget && kept.length) break;
    kept.unshift(turns[i]);
    used += len;
  }
  return [systemMsg, ...kept];
}

// ---- Action registry (pattern borrowed from vane's researcher agent) ----
// Each action declares when it applies (`enabled`) and what context it
// contributes (`run`). Gating is declarative rather than model-driven,
// because the small local models A2I supports cannot be relied on for
// function calling — yet we still get the benefit: tools run only when
// relevant, so a coding question is not polluted with Wikipedia text.

const ActionRegistry = {
  actions: [],
  register(action) { this.actions.push(action); },
  available(ctx) { return this.actions.filter((a) => { try { return a.enabled(ctx); } catch { return false; } }); },
  // Run every applicable action in parallel; failures never break the turn.
  async gather(ctx) {
    const results = await Promise.all(this.available(ctx).map(async (a) => {
      try { return (await a.run(ctx)) || []; } catch { return []; }
    }));
    return results.flat().filter(Boolean);
  },
};

// Queries that are clearly about code shouldn't pull encyclopedia articles.
const looksLikeCode = (q) =>
  coderMode ||
  /```|\b(function|const|let|var|def |class |import |return|async|await|=>|null|undefined)\b/.test(q) ||
  /\b(bug|error|exception|stack ?trace|compile|refactor|regex|api|sql|css|html)\b/i.test(q) ||
  /\b(python|javascript|typescript|java|rust|golang|c\+\+|bash|shell)\b/i.test(q);

ActionRegistry.register({
  name: 'calculator',
  enabled: (ctx) => calculate(ctx.query) !== null,
  run: (ctx) => [{ p: 100, text: '[Calculator — exact result, trust this]\n' + calculate(ctx.query) }],
});

ActionRegistry.register({
  name: 'knowledge',
  // Only worth running when documents were actually loaded.
  enabled: () => knowledgeChunks.length > 0,
  run: (ctx) => searchKnowledge(ctx.query).map((h, i) => ({ p: 50 - i, text: `[${h.source}]\n${h.text}` })),
});

ActionRegistry.register({
  name: 'wikipedia',
  enabled: (ctx) => wikiToggle.checked && !looksLikeCode(ctx.query) &&
    (searchMode === 'auto' || searchMode === 'web'),
  run: async (ctx) => (await searchWikipedia(ctx.query)).map((w, i) => ({ p: 20 - i, text: `[${w.source}]\n${w.text}` })),
});

// Academic and discussion sources outrank Wikipedia when the query asks for
// them: a request for papers wants papers, not an encyclopedia summary.
ActionRegistry.register({
  name: 'academic',
  enabled: (ctx) => wikiToggle.checked && (searchMode === 'academic' ||
    (searchMode === 'auto' && wantsAcademic(ctx.query))),
  run: async (ctx) => (await searchAcademic(ctx.query)).map((r, i) => ({ p: 35 - i, text: `[${r.source}]\n${r.text}` })),
});

ActionRegistry.register({
  name: 'discussions',
  enabled: (ctx) => wikiToggle.checked && (searchMode === 'discussions' ||
    (searchMode === 'auto' && wantsDiscussions(ctx.query))),
  run: async (ctx) => (await searchDiscussions(ctx.query)).map((r, i) => ({ p: 30 - i, text: `[${r.source}]\n${r.text}` })),
});

async function withKnowledge(messages) {
  const turns = messages.filter((m) => m.role !== 'system');
  const lastUser = [...turns].reverse().find((m) => m.role === 'user');
  let systemContent = activePrompt();

  if (lastUser) {
    // Gather context from the applicable actions, then rank by priority
    // (higher = keep first) before spending the budget — PR-Agent's
    // compression idea: prioritise, then truncate.
    const parts = await ActionRegistry.gather({ query: lastUser.content });
    parts.sort((a, b) => b.p - a.p);

    // Fill the budget with whole pieces. A piece that does not fit is
    // truncated only if a useful amount survives; otherwise it is skipped so
    // the model never receives a meaningless fragment.
    const budget = contextCharBudget();
    const MIN_USEFUL = Math.min(200, Math.floor(budget / 2));
    let ctx = '';
    for (const { text } of parts) {
      const sep = ctx ? '\n\n' : '';
      const room = budget - ctx.length - sep.length;
      if (room < MIN_USEFUL) break;
      // Reserve one char for the ellipsis when truncating.
      const piece = text.length <= room ? text : text.slice(0, room - 1) + '…';
      ctx += sep + piece;
    }
    // A small model drifts unless told plainly to stay on the sources, so
    // the grounding instruction is explicit rather than implied.
    if (ctx) {
      systemContent = activePrompt() +
        '\n\nAnswer USING ONLY the context documents below. Do not add facts ' +
        'that are not in them. If they do not answer the question, say you ' +
        'do not know.\n\nContext documents:\n' + ctx;
    }
  }

  return fitHistory({ role: 'system', content: systemContent }, turns);
}

// ---- Brains ------------------------------------------------------------

let webllmEngine = null, loadedModel = null;
let currentAbort = null;

const LOCAL_ONLY = true;

type ServerBrain = {
  name: string;
  url: string;
  model?: string;
  online?: boolean;
};

function loadServerBrains(): ServerBrain[] {
  // A2I Web accepts only the machine-local Core endpoint in local-only mode.
  // Old browser entries with cloud URLs or API keys are intentionally ignored.
  const local = { name: 'A2I Core (local)', url: 'http://127.0.0.1:8990' };
  try {
    const saved = JSON.parse(localStorage.getItem('a2i-brains') || 'null');
    if (Array.isArray(saved)) {
      const core = saved.find((brain) => {
        const url = String(brain?.url || '');
        return url.includes('127.0.0.1:8990') || url.includes('localhost:8990');
      });
      if (core) return [{ name: 'A2I Core (local)', url: String(core.url).replace(/\/+$/, '') }];
    }
  } catch { /* use the safe default */ }
  return [local];
}
let serverBrains: ServerBrain[] = loadServerBrains();
const saveBrains = () => localStorage.setItem('a2i-brains', JSON.stringify(serverBrains));

function isA2ICoreBrain(brain) {
  const url = brain?.url || '';
  return url.includes('127.0.0.1:8990') || url.includes('localhost:8990') ||
    /^A2I Core/i.test(brain?.name || '');
}

function a2iCoreBrain() {
  return serverBrains.find((brain) => isA2ICoreBrain(brain));
}

function ensureA2ICoreLocal() {
  let brain = a2iCoreBrain();
  if (!brain) {
    brain = { name: 'A2I Core (local)', url: 'http://127.0.0.1:8990' };
    serverBrains = [brain];
  }
  delete brain.model;
  saveBrains();
  return serverBrains.indexOf(brain);
}

function brainStatusLabel(brain) {
  if (brain.online === true) return ' (online)';
  if (brain.online === false) return ' (offline)';
  return '';
}

function rebuildEngineSelect(selected) {
  engineSel.innerHTML = '';
  const add = (value, label) => {
    const option = document.createElement('option');
    option.value = value; option.textContent = label;
    engineSel.appendChild(option);
  };
  add('auto', 'A2I Local — Core first, browser fallback');
  serverBrains.forEach((brain, index) => add('server:' + index, brain.name + brainStatusLabel(brain)));
  add('browser', T('engBrowser'));
  const saved = localStorage.getItem('a2i-engine');
  const savedValid = saved && [...engineSel.options].some((option) => option.value === saved);
  engineSel.value = selected || (savedValid ? saved : 'auto');
}

// Base URLs may or may not already end in /v1 (A2I Core/Ollama use bare host;
// Groq/OpenRouter include /v1). Normalise so we never double it.
function apiBase(url) {
  const base = (url || '').replace(/\/+$/, '');
  // Same-origin Vercel proxy paths (/api/zen) already include the full base —
  // never append /v1 to them.
  if (base.startsWith('/api/')) return base;
  return /\/v\d+$/.test(base) ? base : base + '/v1';
}

async function checkBrains() {
  await Promise.all(serverBrains.map(async (brain) => {
    try {
      const res = await fetch(apiBase(brain.url) + '/models',
        { signal: AbortSignal.timeout(8000) });
      brain.online = res.ok;
    } catch {
      brain.online = false;
    }
  }));
  const current = engineSel.value;
  rebuildEngineSelect(current);
  refreshBar();
}
setInterval(checkBrains, 30000);

engineSel.addEventListener('change', () => {
  // Local-only mode has no provider-setup entries in the engine selector.
  localStorage.setItem('a2i-engine', engineSel.value);
  refreshBar();
});

function currentServerBrain() {
  const m = engineSel.value.match(/^server:(\d+)$/);
  return m ? serverBrains[+m[1]] : null;
}

serverUrl.addEventListener('change', () => {
  const brain = currentServerBrain();
  if (brain) {
    brain.url = serverUrl.value.trim().replace(/\/+$/, '');
    brain.online = undefined;
    saveBrains();
    checkBrains();
  }
});
modelSel.addEventListener('change', () => {
  loadedModel = null; webllmEngine = null;
  const mode = engineSel.value;
  if (mode.startsWith('server:')) {
    const brain = currentServerBrain();
    if (brain) { brain.model = modelSel.value; saveBrains(); }
  }
  refreshBar();
});

// The selector intentionally exposes only local inference: the browser model
// and the GGUF model currently loaded by A2I Core.
function syncModelPicker() {
  const mode = engineSel.value;
  if (mode === 'browser') {
    modelSel.innerHTML = browserModelOptions;
    modelSel.style.display = navigator.gpu ? 'inline-block' : 'none';
    return;
  }
  modelSel.style.display = 'none';
}

function refreshBar() {
  const mode = engineSel.value;
  const brain = currentServerBrain();
  // The select is truncated with an ellipsis (long provider descriptions no
  // longer wrap the topbar to two lines) — keep the full text reachable on
  // hover/long-press via the native title tooltip.
  engineSel.title = engineSel.options[engineSel.selectedIndex]?.textContent || '';
  syncModelPicker();
  serverUrl.style.display = 'none';
  if (mode === 'auto') {
    setStatus('A2I Local — Core first, browser fallback', true);
  } else if (mode === 'browser') {
    setStatus(loadedModel ? `ready: ${loadedModel}`
      : navigator.gpu ? T('stModelLoads')
      : T('stCpuMode'), !!loadedModel);
  } else if (brain) {
    setStatus(Tf('stBrain', { name: brain.name }));
  }
}

// When a model is loading, `loadingReporter` (set by the send flow) mirrors
// progress into the visible chat bubble so it never looks frozen.
let loadingReporter = null;

function setStatus(text, ready = false) {
  statusEl.textContent = text;
  statusEl.title = text; // truncated with an ellipsis in the topbar; full text on hover
  dot.classList.toggle('ready', ready);
  if (loadingReporter) loadingReporter(text);
}

// ---- In-browser brain --------------------------------------------------

async function loadWebLLM() {
  const sources = [
    new URL('vendor/web-llm.mjs', location.href).href,
    'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm',
    'https://esm.sh/@mlc-ai/web-llm',
  ];
  let lastError = null;
  for (const src of sources) {
    try { return await import(src); } catch (err) { lastError = err; }
  }
  throw new Error(
    'មិនអាចទាញ AI library បានទេ — សូមពិនិត្យអ៊ីនធឺណិត រួចព្យាយាមម្តងទៀត។ ' +
    '(Could not load the AI library.) ' + lastError.message);
}

// 1.5B (not 0.5B): still fits phones/basic laptops (see MODELS.md), but is
// noticeably more coherent than 0.5B — a genuine "not smart" complaint traced
// back to first-time users landing on the smallest possible default model.
const CPU_MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf';
const CPU_MODEL_NAME = 'Qwen2.5 1.5B (CPU)';

// Turns an infinite hang into a clear, recoverable error: rejects if the
// wrapped work makes no progress for `ms`. Call `ping()` on each sign of
// life (e.g. a download-progress event).
function stallGuard(ms) {
  let timer, rejectFn;
  const promise = new Promise((_, reject) => { rejectFn = reject; });
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => rejectFn(new Error(
      'ការទាញ model គាំង (គ្មានចលនា ' + Math.round(ms / 1000) + ' វិនាទី) — ' +
      'សូមចុច "ជួសជុល" ក្នុង sidebar រួចព្យាយាមម្តងទៀត។ ' +
      '(Download stalled — click "Fix" in the sidebar, then retry.)')), ms);
  };
  arm();
  return { signal: promise, ping: arm, clear: () => clearTimeout(timer) };
}

async function loadGpuEngine(model) {
  setStatus(T('stLoadingLib'));
  const webllm = await loadWebLLM();
  setStatus(T('stDownloadingModel'));
  progress.hidden = false;
  const watch = stallGuard(60000);
  const engine = await Promise.race([
    watch.signal,
    webllm.CreateMLCEngine(model, {
      initProgressCallback: (p) => {
        watch.ping();
        progress.value = p.progress || 0;
        const pct = Math.round((p.progress || 0) * 100);
        setStatus(Tf('stDownloadPct', { pct: String(pct) }));
      },
    }),
  ]).finally(() => watch.clear());
  progress.hidden = true;
  return {
    kind: 'gpu',
    stop: () => engine.interruptGenerate?.(),
    async ask(messages, onDelta, signal, maxTokens = 1024) {
      const chunks = await engine.chat.completions.create({
        messages, stream: true, max_tokens: maxTokens,
      });
      let answer = '';
      for await (const chunk of chunks) {
        if (signal?.aborted) { this.stop(); break; }
        answer += chunk.choices?.[0]?.delta?.content || '';
        onDelta(answer);
      }
      return answer;
    },
  };
}

// wllama's default WASM build needs the browser to support JSPI
// (WebAssembly.Suspending) and Memory64. Browsers without them (Safari, older
// Chrome/Firefox, many mobile browsers) load the model fine but then hard-abort
// with "(ABORT)" at the first token. wllama ships a separate *compat* build for
// exactly these browsers; we vendor it under vendor/wllama/compat/ and switch to
// it here so the CPU engine works everywhere. See a2i-web/vendor/wllama/compat/.
function needsWllamaCompat() {
  const hasJSPI = typeof WebAssembly.Suspending === 'function';
  let hasMem64 = false;
  try {
    new WebAssembly.Memory({ address: 'i64', initial: 1n });
    hasMem64 = true;
  } catch { /* Memory64 unsupported */ }
  return !hasJSPI || !hasMem64;
}

// ---- Load a model from the user's disk / SSD (no download, works offline) ----
// wllama.loadModel([file]) reads the weights straight from a File object, so a
// GGUF kept on an external SSD needs zero network — and a new preview URL never
// triggers a re-download. The File System Access API lets the chosen file
// persist across reloads; browsers without it fall back to a per-session picker.
const LOCAL_MODEL_DB = 'a2i-local-model';
let localModelFile = null; // File for this session (just picked, or reopened)

function idbModelOp(mode, run) {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(LOCAL_MODEL_DB, 1); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('h');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction('h', mode);
        const rq = run(tx.objectStore('h'));
        let out;
        if (rq) rq.onsuccess = () => { out = rq.result; };
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => reject(tx.error);
      } catch (e) { reject(e); }
    };
  });
}
const putModelHandle = (h) => idbModelOp('readwrite', (s) => s.put(h, 'model')).catch(() => {});
const getModelHandle = () => idbModelOp('readonly', (s) => s.get('model')).catch(() => null);
const clearModelHandle = () => idbModelOp('readwrite', (s) => s.delete('model')).catch(() => {});

async function pickLocalModel() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'GGUF model', accept: { 'application/octet-stream': ['.gguf'] } }],
      });
      await putModelHandle(handle);
      localModelFile = await handle.getFile();
      return localModelFile;
    } catch (e) {
      if (e && e.name === 'AbortError') return null; // user cancelled the dialog
      // any other error: fall through to the <input> fallback
    }
  }
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.gguf';
    inp.onchange = () => { localModelFile = (inp.files && inp.files[0]) || null; resolve(localModelFile); };
    inp.click();
  });
}

async function getLocalModelBlob() {
  if (localModelFile) return localModelFile;
  const handle = await getModelHandle();
  if (!handle || !handle.getFile) return null;
  try {
    if (handle.queryPermission) {
      let p = await handle.queryPermission({ mode: 'read' });
      if (p !== 'granted' && handle.requestPermission) p = await handle.requestPermission({ mode: 'read' });
      if (p !== 'granted') return null;
    }
    localModelFile = await handle.getFile();
    return localModelFile;
  } catch { return null; }
}

async function refreshLocalModelState() {
  const tag = $('set-local-model-state');
  if (tag === _elStub) return;
  let name = localModelFile && localModelFile.name;
  if (!name) { const h = await getModelHandle(); name = h && h.name; }
  tag.textContent = name ? ('✓ ' + name + ' — no download') : 'none — uses one-time download';
}

$('set-local-model').addEventListener('click', async () => {
  const f = await pickLocalModel();
  if (!f) return;
  webllmEngine = null; // drop the cached engine so the next message reloads with this file
  setStatus(Tf('stModelFileSet', { name: f.name }), false);
  refreshLocalModelState();
});
$('set-local-model-clear').addEventListener('click', async () => {
  localModelFile = null;
  webllmEngine = null;
  await clearModelHandle();
  setStatus(T('stLocalCleared'), false);
  refreshLocalModelState();
});
refreshLocalModelState();

async function loadCpuEngine(forceCompat = false) {
  setStatus(forceCompat ? T('stCpuCompat') : T('stCpu'));
  const { Wllama } = await import(new URL('vendor/wllama/index.js', location.href).href);
  const wllama = new Wllama(
    { default: new URL('vendor/wllama/wllama.wasm', location.href).href });
  // On browsers that lack JSPI/Memory64 — or after the default build has aborted
  // once — point wllama at the vendored compat build (single-threaded, works
  // everywhere) instead of the engine that aborts mid-inference.
  const compat = forceCompat || needsWllamaCompat();
  if (compat) {
    wllama.setCompat({
      worker: new URL('vendor/wllama/compat/wllama.js', location.href).href,
      wasm: new URL('vendor/wllama/compat/wllama.wasm', location.href).href,
    }, 'firefox_safari');
  }
  const url = localStorage.getItem('a2i-cpu-model-url') || CPU_MODEL_URL;
  // Multi-thread (SharedArrayBuffer, enabled by our COOP/COEP headers) is faster,
  // but the compat build is single-threaded, so use 1 thread there for stability.
  const threads = compat
    ? 1
    : Math.max(2, Math.min(navigator.hardwareConcurrency || 4, 8));
  progress.hidden = false;
  const watch = stallGuard(60000);
  // 4096 is plenty once prompts are trimmed — smaller KV cache means faster
  // prefill and less RAM. n_gpu_layers:0 forces pure-CPU inference (wllama v3
  // otherwise offloads to the WebGPU we may be falling back FROM).
  const modelCfg = { n_ctx: 4096, n_threads: threads, n_batch: 256, n_gpu_layers: 0 };
  // Prefer a model the user picked from their own disk/SSD — it loads straight
  // from the File, with no network download at all.
  const localFile = await getLocalModelBlob();
  if (localFile) {
    setStatus(Tf('stUsingLocalFile', { name: localFile.name }));
    await Promise.race([
      watch.signal,
      wllama.loadModel([localFile], modelCfg),
    ]).finally(() => watch.clear());
  } else {
    await Promise.race([
      watch.signal,
      wllama.loadModelFromUrl(url, {
        ...modelCfg,
        progressCallback: ({ loaded, total }) => {
          watch.ping();
          progress.value = total ? loaded / total : 0;
          const pct = Math.round(100 * (loaded / (total || 1)));
          const mb = Math.round(loaded / 1048576);
          setStatus(Tf('stDownloadPctCpu', { pct: String(pct), mb: String(mb) }));
        },
      }),
    ]).finally(() => watch.clear());
  }
  progress.hidden = true;
  const engine = {
    kind: 'cpu',
    compat,
    stop: () => {},
    ask(messages, onDelta, signal, maxTokens = 1024) {
      // Single-thread compat generation is slow per token; a shorter cap
      // means a full answer finishes sooner instead of a longer one being
      // cut off by the user losing patience.
      const cap = compat ? 180 : 300;
      return new Promise((resolve, reject) => {
        let answer = '';
        wllama.createChatCompletion({
          messages,
          stream: true,
          abortSignal: signal,
          max_tokens: Math.min(maxTokens, cap),
          onData: (chunk) => {
            const delta =
              chunk?.choices?.[0]?.delta?.content ?? chunk?.currentText ?? '';
            if (chunk?.currentText !== undefined) answer = chunk.currentText;
            else answer += delta;
            onDelta(answer);
          },
        }).then(() => resolve(answer),
          (err) => signal?.aborted ? resolve(answer) : reject(err));
      });
    },
    // Generate a single token so any WASM "(ABORT)" surfaces now, at load time,
    // where we can transparently fall back to the compat build — instead of on
    // the user's first message.
    async warmup() {
      await this.ask([{ role: 'user', content: 'Hi' }], () => {}, null, 1);
    },
  };
  return engine;
}

async function ensureBrowserEngine() {
  if (webllmEngine) return webllmEngine;
  const errors = [];

  // 1. Try the GPU engine when a WebGPU adapter is advertised. The adapter
  //    can exist yet fail at device creation (e.g. DXGI_ERROR_DEVICE_REMOVED
  //    on a weak/broken Windows GPU), so a failure here must NOT be fatal —
  //    we fall through to the CPU engine. Once GPU has failed on this device
  //    we remember it and skip straight to CPU on later loads (faster start).
  const gpuBroken = localStorage.getItem('a2i-gpu-broken') === '1';
  if (navigator.gpu && !gpuBroken) {
    try {
      webllmEngine = await loadGpuEngine(modelSel.value);
      loadedModel = modelSel.value;
      setStatus(`ready: ${modelSel.value}`, true);
      return webllmEngine;
    } catch (err) {
      progress.hidden = true;
      errors.push('GPU: ' + err.message);
      // A large model can exhaust a capable GPU's memory; that must not
      // condemn the GPU for the small models it can still run. Only blacklist
      // the GPU when a small model fails — a genuine device/driver problem.
      const isBigModel = /\b(7B|8B|9B|13B)\b/i.test(modelSel.value);
      if (!isBigModel) localStorage.setItem('a2i-gpu-broken', '1');
      setStatus(T('stGpuFail'));
    }
  }

  // 2. CPU engine (wllama, WebAssembly). Works on any device. We try the fast
  //    default build first (unless feature-detection already says it can't run
  //    here), then the universal compat build. Each candidate is warmed up with
  //    a 1-token generation so a mid-inference "(ABORT)" is caught here and
  //    turned into a fallback — never shown to the user as a dead chat.
  const cpuPlans = needsWllamaCompat() ? [true] : [false, true];
  for (const forceCompat of cpuPlans) {
    try {
      const engine = await loadCpuEngine(forceCompat);
      setStatus(T('stWarming'));
      await Promise.race([
        engine.warmup(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('warmup timed out')), 30000)),
      ]);
      webllmEngine = engine;
      loadedModel = (localModelFile ? localModelFile.name : CPU_MODEL_NAME) + (engine.compat ? ' — compat' : '');
      setStatus(Tf('stCpuSlower', { model: loadedModel }), true);
      return webllmEngine;
    } catch (err) {
      progress.hidden = true;
      errors.push('CPU' + (forceCompat ? ' compat' : '') + ': ' + err.message);
      if (!forceCompat) {
        setStatus(T('stCompatEngine'));
      }
    }
  }

  throw new Error(
    T('errNoBrowserEngine') + ' ' +
    T('errNoBrowserEngine2') + ' ' +
    T('errNoBrowserEngine3') + ' ' +
    errors.join(' | '));
}

async function askBrowser(messages, onDelta, signal) {
  const engine = await ensureBrowserEngine();
  return engine.ask(messages, onDelta, signal);
}

// ---- Streaming helpers -------------------------------------------------

// Parse an OpenAI-style SSE stream, calling onDelta with the growing answer.
async function readSSE(res, onDelta, signal, onReason) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let answer = '', reasoning = '', buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const chunk = JSON.parse(line.slice(6));
          const d = chunk.choices?.[0]?.delta;
          if (d?.reasoning_content) {
            reasoning += d.reasoning_content;
            if (onReason) onReason(reasoning);
          }
          if (d?.content) { answer += d.content; onDelta(answer); }
        } catch { /* ignore keep-alive / partial lines */ }
      }
    }
  } catch (err) {
    if (!signal?.aborted) throw err;
  }
  return answer;
}

// ---- Gemini (Google) — your own API key, called straight from the browser --
// Uses Gemini's native streaming endpoint with ?key=…, which is CORS-friendly
// for browsers (the OpenAI-compat Bearer endpoint is not). The key is stored
// only in this browser's localStorage and sent directly to Google — no proxy.
const GEMINI_KEY = () => localStorage.getItem('a2i-gemini-key') || '';
const GEMINI_MODEL = () => localStorage.getItem('a2i-gemini-model') || 'gemini-2.0-flash';

function toGeminiBody(messages, maxTokens = 1024) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      for (const url of (m.images || [])) {
        const mt = /^data:(.*?);base64,(.*)$/.exec(url);
        if (mt) parts.push({ inlineData: { mimeType: mt[1], data: mt[2] } });
      }
      if (!parts.length) parts.push({ text: '' });
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature: activeTemperature() },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  return body;
}

// Convert history (with optional image data URLs) into OpenAI vision format
// only for messages that carry images; plain text messages stay as strings.
function toOpenAIMessages(messages) {
  return messages.map((m) => {
    if (m.images && m.images.length) {
      return {
        role: m.role,
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          ...m.images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

async function readGeminiSSE(res, onDelta, signal) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let answer = '', buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parts = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts || [];
          const t = parts.map((p) => p.text || '').join('');
          if (t) { answer += t; onDelta(answer); }
        } catch { /* ignore keep-alive / partial lines */ }
      }
    }
  } catch (err) {
    if (!signal?.aborted) throw err;
  }
  return answer;
}

async function askGemini(messages, onDelta, signal) {
  if (LOCAL_ONLY) throw new Error('A2I local-only mode does not use Gemini or API keys.');
  const key = GEMINI_KEY();
  if (!key) throw new Error(T('errNoGemKey'));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(GEMINI_MODEL())}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toGeminiBody(messages, 1024)),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return '';
    throw new Error(T('errGemReach'));
  }
  if (res.status === 429) {
    throw new Error(T('errGemQuota'));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(Tf('errGemStatus', { s: String(res.status), t: text.slice(0, 160) }));
  }
  return readGeminiSSE(res, onDelta, signal);
}

// ---- A2I Cloud (Vercel serverless proxy → hosted model) ----------------

let cloudAvailable = false;
let cloudModel = '';
let cloudBase = '';
const CLOUD_MODEL = () => localStorage.getItem('a2i-cloud-model') || cloudModel || 'big-pickle';

async function checkCloud() {
  if (LOCAL_ONLY) { cloudAvailable = false; return false; }
  try {
    const res = await fetch('/api/chat', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const info = await res.json();
      cloudAvailable = !!info.configured;
      cloudModel = info.model || '';
      cloudBase = info.base || '';
      refreshCloudStatusUI();
      if ($('welcome') && typeof showWelcome === 'function') showWelcome();
    }
  } catch { cloudAvailable = false; }
}

// Update any UI that reflects the server-configured A2I Cloud API without
// touching inputs the user may be typing into (used from checkCloud() and
// openSettings()).
function refreshCloudStatusUI() {
  const ztag = $('set-zen-state');
  if (ztag && !overlay.hidden) {
    if (cloudAvailable) {
      ztag.textContent = '● server-configured — key on server, no setup needed';
      ztag.classList.add('on');
    } else {
      ztag.textContent = ZEN_KEY() ? '● active' : '';
      ztag.classList.toggle('on', !!ZEN_KEY());
    }
  }
  const cs = $('cloud-status');
  if (cs) {
    if (cloudAvailable) {
      cs.hidden = false;
      const body = cs.querySelector('[data-i18n-html="cloudStatusBody"]');
      if (body) body.innerHTML = Tf('cloudStatusBody', { model: cloudModel || 'default', base: cloudBase || 'server' });
    } else {
      cs.hidden = true;
    }
  }
}

async function askCloud(messages, onDelta, signal, onReason) {
  if (LOCAL_ONLY) throw new Error('A2I local-only mode does not use cloud inference.');
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: toOpenAIMessages(messages), max_tokens: 1024, model: CLOUD_MODEL() }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return '';
    throw new Error(T('errCloudReach'));
  }
  if (res.status === 503) {
    const info = await res.json().catch(() => ({}));
    throw new Error(info.message || T('errCloudNotConfig'));
  }
  if (!res.ok) throw new Error(Tf('errCloudStatus', { s: String(res.status) }));
  return readSSE(res, onDelta, signal, onReason);
}

// ---- Server brains -----------------------------------------------------

async function askServer(brain, messages, onDelta, signal, onReason) {
  let res;
  try {
    const body: Record<string, unknown> = {
      messages: toOpenAIMessages(messages), stream: true, max_tokens: 1024,
      temperature: activeTemperature(),
    };
    if (brain.model) body.model = brain.model;
    res = await fetch(apiBase(brain.url) + '/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
    });
  } catch (err) {
    if (signal?.aborted) return '';
    throw new Error(Tf('errServerReach', { name: brain.name, url: brain.url }));
  }
  if (res.status === 429) {
    throw new Error(Tf('errServerQuota', { name: brain.name }));
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(Tf('errServerStatus', { name: brain.name, s: String(res.status), t: t.slice(0, 160) }));
  }
  return readSSE(res, onDelta, signal, onReason);
}

// ---- Auto: local-first failover -----------------------------------------
// Core uses the GGUF model installed on this PC. If it is unavailable, A2I
// falls back only to the browser's local model; it never tries an API provider.
async function askAuto(messages, aiDiv, signal) {
  const localBrains = serverBrains.filter((brain) => brain.online !== false);
  const choices = [
    ...localBrains.map((brain) => ({ label: brain.name, fn: (delta, reason) => askServer(brain, messages, delta, signal, reason) })),
    { label: 'In-browser AI', fn: (delta) => askBrowser(messages, delta, signal) },
  ];
  let lastError = null;
  for (let index = 0; index < choices.length; index++) {
    const choice = choices[index];
    aiDiv.setLabel(choice.label);
    try {
      const answer = await choice.fn((text) => aiDiv.update(text), (reasoning) => aiDiv.setReason(reasoning));
      if (answer && answer.trim()) { aiDiv.setLabel(choice.label); return answer; }
    } catch (error) {
      if (signal?.aborted) return '';
      lastError = error;
      if (index < choices.length - 1) {
        aiDiv.update('↻ ' + choice.label + ' មិនអាចប្រើ — កំពុងប្ដូរទៅ local model បន្ទាប់…');
      }
    }
  }
  throw lastError || new Error('A2I local models are unavailable. Start A2I Core or load a local browser model.');
}

// ---- All brains together -----------------------------------------------

async function askAllBrains(question, messages, signal) {
  const results = [];
  const liveBrains = serverBrains.filter((b) => b.online !== false);
  const tasks = liveBrains.map((brain) => {
    const div = addMsg('ai', '…', brain.name);
    return askServer(brain, messages, (t) => div.update(t), signal, (rt) => div.setReason(rt))
      .then((answer) => results.push({ name: brain.name, answer, brain }))
      .catch((err) => div.update('⚠ ' + err.message));
  });
  if (GEMINI_KEY()) {
    const div = addMsg('ai', '…', 'Gemini');
    tasks.push(
      askGemini(messages, (t) => div.update(t), signal)
        .then((answer) => results.push({ name: 'Gemini', answer, brain: null }))
        .catch((err) => div.update('⚠ ' + err.message)));
  }
  if (cloudAvailable) {
    const div = addMsg('ai', '…', 'A2I Cloud');
    tasks.push(
      askCloud(messages, (t) => div.update(t), signal)
        .then((answer) => results.push({ name: 'A2I Cloud', answer, brain: null, cloud: true }))
        .catch((err) => div.update('⚠ ' + err.message)));
  }
  if (loadedModel && webllmEngine) {
    const div = addMsg('ai', '…', loadedModel);
    tasks.push(
      askBrowser(messages, (t) => div.update(t), signal)
        .then((answer) => results.push({ name: 'In-browser ' + loadedModel, answer, brain: null }))
        .catch((err) => div.update('⚠ ' + err.message)));
  }
  await Promise.allSettled(tasks);

  if (results.length === 0) {
    const div = addMsg('ai', '…', 'In-browser AI');
    return askBrowser(messages, (t) => div.update(t), signal);
  }
  if (results.length === 1) return results[0].answer;

  // Combining costs a whole extra round-trip (wait for every brain, THEN wait
  // for one more generation), so only pay for it when it can actually help.
  // Treat the in-browser fallback model as "weak" — it is usually far smaller
  // than a configured Cloud/server/Gemini brain.
  const isWeak = (r) => r.name.startsWith('In-browser ');
  const strong = results.filter((r) => !isWeak(r));

  // Exactly one strong answer plus weak filler: the strong answer alone is
  // already the best we have, and asking a small model to "help combine" it
  // only adds latency and a chance of the small model garbling it.
  if (strong.length === 1 && strong.length < results.length) return strong[0].answer;

  // Combine among the strong answers when there are any, so a weak in-browser
  // answer cannot dilute or override a better one; otherwise combine what we have.
  const toCombine = strong.length > 0 ? strong : results;
  if (toCombine.length === 1) return toCombine[0].answer;

  const combineMessages = [
    { role: 'system', content: activePrompt() },
    {
      role: 'user',
      content:
        `Question: ${question}\n\n` +
        toCombine.map((r, i) => `Answer ${i + 1} (from ${r.name}):\n${r.answer}`).join('\n\n') +
        '\n\nCombine these answers into one single best answer to the question. ' +
        'Keep what is correct, drop what is wrong, and reply in the language of the question.',
    },
  ];
  const div = addMsg('ai combined', '…', 'A2I combined / ចម្លើយរួម');
  // Pick a combiner: prefer Cloud, then a configured server brain (Groq /
  // Cerebras / etc. are typically much stronger than the in-browser fallback),
  // then in-browser only as a last resort.
  const serverResult = toCombine.find((r) => r.brain) || results.find((r) => r.brain);
  let combined;
  if (cloudAvailable) {
    combined = await askCloud(combineMessages, (t) => div.update(t), signal);
  } else if (serverResult) {
    combined = await askServer(serverResult.brain, combineMessages, (t) => div.update(t), signal);
  } else if (webllmEngine && loadedModel) {
    combined = await askBrowser(combineMessages, (t) => div.update(t), signal);
  } else {
    combined = toCombine.map((r) => r.answer).join('\n\n');
  }
  return combined;
}

// ---- Send flow ---------------------------------------------------------

function setGenerating(on) {
  send.style.display = on ? 'none' : 'grid';
  stopBtn.style.display = on ? 'grid' : 'none';
  regenBtn.style.display = !on &&
    history.at(-1)?.role === 'assistant' ? 'grid' : 'none';
  input.disabled = on;
  document.body.classList.toggle('busy', on);
}

stopBtn.addEventListener('click', () => {
  currentAbort?.abort();
  webllmEngine?.stop?.();
});

// Sub-2B models have almost no Khmer in their training data: they emit
// fluent-looking Khmer that means nothing. Better to say so once, up front,
// than to let someone read a confident, invented answer.
let smallModelWarned = false;

function warnIfModelTooSmall(question, mode) {
  if (smallModelWarned || mode !== 'browser') return;
  if (!/[ក-៿]/.test(question)) return;
  const model = loadedModel || modelSel.value || '';
  if (!/\b(0\.5B|1B|1\.5B)\b/i.test(model)) return;
  smallModelWarned = true;
  addMsg('note',
    Tf('noteSmallModel', { model }));
}

async function generate() {
  const question = [...history].reverse().find((m) => m.role === 'user')?.content || '';
  let mode = engineSel.value;
  setGenerating(true);
  currentAbort = new AbortController();
  const signal = currentAbort.signal;
  const messages = await withKnowledge(history);
  warnIfModelTooSmall(question, mode);

  const chosenBrain = currentServerBrain();
  if (chosenBrain && chosenBrain.online === false) {
    addMsg('note',
      Tf('noteBrainOffline', { name: chosenBrain.name }));
    mode = 'browser';
    rebuildEngineSelect('browser');
    refreshBar();
  }

  try {
    let answer;
    // aiDiv/askFn are hoisted so the self-critique pass below (after the mode
    // branches) can reuse whichever bubble and brain actually answered.
    // askFn stays unset for 'all' mode, which already does its own
    // multi-brain combine and isn't a good fit for a second critique round.
    let aiDiv, askFn;
    if (mode === 'auto') {
      aiDiv = addMsg('ai', '…', 'Auto');
      answer = await askAuto(messages, aiDiv, signal);
      askFn = (msgs, onDelta, sig) => askAuto(msgs, aiDiv, sig);
    } else if (mode === 'cloud') {
      aiDiv = addMsg('ai', '…', 'A2I Cloud');
      answer = await askCloud(messages, (t) => aiDiv.update(t), signal, (rt) => aiDiv.setReason(rt));
      askFn = (msgs, onDelta, sig) => askCloud(msgs, onDelta, sig);
    } else if (mode === 'gemini') {
      aiDiv = addMsg('ai', '…', 'Gemini');
      answer = await askGemini(messages, (t) => aiDiv.update(t), signal);
      askFn = (msgs, onDelta, sig) => askGemini(msgs, onDelta, sig);
    } else if (mode === 'all') {
      answer = await askAllBrains(question, messages, signal);
    } else if (mode === 'browser') {
      aiDiv = addMsg('ai', '…', 'In-browser AI');
      // Until the engine is ready, mirror download progress into the bubble.
      if (!(webllmEngine && loadedModel)) {
        aiDiv.update('⬇ កំពុងរៀបចំ AI ជាលើកដំបូង… (setting up the AI for the first time — this downloads a model once, then works instantly)');
        loadingReporter = (t) => aiDiv.update(t);
      } else if (webllmEngine.compat) {
        // Single-thread prefill has no incremental progress to show, so the
        // wait before the first token can otherwise look identical to a
        // frozen page. Say plainly that it is working.
        aiDiv.update('កំពុងគិត (យឺត ព្រោះ browser នេះប្រើ CPU តែ១ core)… ' +
          'thinking… (slow — this browser runs single-core CPU inference)');
      }
      try {
        answer = await askBrowser(messages, (t) => aiDiv.update(t), signal);
      } finally {
        loadingReporter = null;
      }
      askFn = (msgs, onDelta, sig) => askBrowser(msgs, onDelta, sig);
    } else {
      const brain = currentServerBrain();
      aiDiv = addMsg('ai', '…', brain?.name || 'server');
      answer = await askServer(brain, messages, (t) => aiDiv.update(t), signal, (rt) => aiDiv.setReason(rt));
      askFn = (msgs, onDelta, sig) => askServer(brain, msgs, onDelta, sig);
    }

    // Self-critique: ask the same brain to check its own draft and reply with
    // just the corrected final answer. The draft is kept visible in the
    // collapsible "Thinking" area so nothing is silently thrown away; on any
    // failure (timeout, provider error) the original draft is kept as-is.
    if (answer && askFn && critiqueMode && !signal.aborted) {
      const draft = answer;
      aiDiv.setReason(draft);
      aiDiv.update(T('critiqueRunning'));
      try {
        const critiqueMessages = [
          { role: 'system', content: activePrompt() },
          {
            role: 'user',
            content:
              `Question: ${question}\n\nDraft answer:\n${draft}\n\n` +
              'Carefully check the draft answer above for mistakes, missing steps, or unclear ' +
              'parts. Reply with ONLY the corrected, final answer (not a list of corrections) — ' +
              'in the language of the question.',
          },
        ];
        const revised = await askFn(critiqueMessages, (t) => aiDiv.update(t), signal);
        answer = (revised && revised.trim()) ? revised : draft;
      } catch {
        answer = draft;
      }
      if (answer === draft) aiDiv.update(draft);
    }

    if (answer) {
      history.push({ role: 'assistant', content: answer });
      persistChat();
      if (localStorage.getItem('a2i-autospeak') === '1') speakText(answer);
    }
  } catch (err) {
    addMsg('ai', '⚠ ' + err.message);
  } finally {
    currentAbort = null;
    setGenerating(false);
    input.focus();
    refreshBar();
  }
}

// ---- Image attachments (vision) ----------------------------------------
let attachedImages = [];
const fileInput = $('file-input');
const attachPreview = $('attach-preview');

function renderAttachPreview() {
  attachPreview.innerHTML = '';
  attachPreview.style.display = attachedImages.length ? 'flex' : 'none';
  attachedImages.forEach((src, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    const rm = document.createElement('button');
    rm.textContent = '✕'; rm.title = 'Remove';
    rm.addEventListener('click', () => { attachedImages.splice(i, 1); renderAttachPreview(); });
    thumb.append(img, rm);
    attachPreview.appendChild(thumb);
  });
}

// Downscale to keep prompts small and localStorage happy (max 1024px, JPEG).
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const s = Math.min(MAX / width, MAX / height);
        width = Math.round(width * s); height = Math.round(height * s);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

async function addFiles(files) {
  for (const f of files) {
    if (!f.type?.startsWith('image/')) continue;
    if (attachedImages.length >= 4) break;
    try { attachedImages.push(await compressImage(f)); } catch { /* skip */ }
  }
  renderAttachPreview();
}

$('attach-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
input.addEventListener('paste', (e) => {
  const imgs = [...(e.clipboardData?.items || [])]
    .filter((it) => it.type.startsWith('image/')).map((it) => it.getAsFile()).filter(Boolean);
  if (imgs.length) { e.preventDefault(); addFiles(imgs); }
});
const composerEl = $('composer');
['dragenter', 'dragover'].forEach((ev) => composerEl.addEventListener(ev, (e) => {
  e.preventDefault(); composerEl.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((ev) => composerEl.addEventListener(ev, (e) => {
  e.preventDefault(); composerEl.classList.remove('dragging');
  if (ev === 'drop' && e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]);
}));

// ---- Image generation (free, keyless — Pollinations) -------------------
let imageMode = false;
let audioMode = false;
const imgBtn = $('img-btn');
const audBtn = $('aud-btn');
function refreshComposerMode() {
  imgBtn.classList.toggle('on', imageMode);
  audBtn.classList.toggle('on', audioMode);
  input.placeholder = imageMode
    ? 'ពណ៌នារូបដែលចង់បាន… Describe an image to generate…'
    : audioMode
      ? 'ពណ៌នាសំឡេង/អត្ថបទ… Describe audio or text to voice…'
      : 'សួរអ្វីក៏បាន… Ask anything…';
}
imgBtn.addEventListener('click', () => {
  imageMode = !imageMode;
  if (imageMode) audioMode = false;
  refreshComposerMode();
  input.focus();
});
audBtn.addEventListener('click', () => {
  audioMode = !audioMode;
  if (audioMode) imageMode = false;
  refreshComposerMode();
  input.focus();
});

// Self-critique: after a normal answer, ask the same brain to review its own
// draft and produce a corrected final version. Persistent setting (not a
// one-shot composer mode like image/audio), since it affects every reply.
let critiqueMode = localStorage.getItem('a2i-critique') === '1';
const critiqueBtn = $('critique-btn');
critiqueBtn.classList.toggle('on', critiqueMode);
critiqueBtn.addEventListener('click', () => {
  critiqueMode = !critiqueMode;
  localStorage.setItem('a2i-critique', critiqueMode ? '1' : '0');
  critiqueBtn.classList.toggle('on', critiqueMode);
});

async function generateImage(prompt) {
  addMsg('user', prompt);
  history.push({ role: 'user', content: prompt });
  persistChat();
  const div = addMsg('ai', 'កំពុងបង្កើតរូប… (generating image, ~10s)', 'A2I Image');
  const body = div.querySelector('.md');
  const seed = Math.floor(Math.random() * 1e6);
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
    '?width=1024&height=1024&nologo=true&seed=' + seed;
  const img = new Image();
  img.className = 'gen-img'; img.alt = prompt; img.loading = 'lazy';
  const fail = setTimeout(() => img.onerror && img.onerror(), 45000);
  img.onload = () => {
    clearTimeout(fail);
    body.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'gen-img-wrap';
    wrap.appendChild(img);
    wrap.appendChild(document.createElement('br'));
    const dl = document.createElement('a');
    dl.href = url; dl.target = '_blank'; dl.rel = 'noopener';
    dl.innerHTML = svgIcon('download', 'ico-sm') + ' បើក/រក្សាទុក · Open / save';
    wrap.appendChild(dl);
    body.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    history.push({ role: 'assistant', content: prompt, genImage: url });
    persistChat();
  };
  img.onerror = () => {
    clearTimeout(fail);
    div.update('⚠ បង្កើតរូបមិនបានទេ — ព្យាយាមម្តងទៀត ឬពិនិត្យអ៊ីនធឺណិត។ (Image generation failed — try again.)');
  };
  img.src = url;
}

// Free, keyless voice/audio generation. Unlike the browser's read-aloud
// (which is ephemeral), this returns a real audio file the user can save.
const AUDIO_VOICE = 'nova';
// The service reads the prompt back as speech, so keep chained answers within
// a sane length rather than posting an essay at the endpoint.
const AUDIO_MAX_CHARS = 900;

function audioUrl(prompt) {
  return 'https://text.pollinations.ai/' + encodeURIComponent(prompt) +
    '?model=openai-audio&voice=' + AUDIO_VOICE;
}

// Fetch generated audio and return a ready-to-insert player wrap, or throw.
async function buildAudioWrap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  if (!blob.type.startsWith('audio')) throw new Error('not audio');
  const obj = URL.createObjectURL(blob);
  const wrap = document.createElement('div'); wrap.className = 'gen-audio-wrap';
  const audio = document.createElement('audio');
  audio.className = 'gen-audio'; audio.controls = true; audio.src = obj;
  wrap.appendChild(audio);
  wrap.appendChild(document.createElement('br'));
  const dl = document.createElement('a');
  dl.href = obj; dl.download = 'a2i-audio.mp3';
  dl.innerHTML = svgIcon('download', 'ico-sm') + ' រក្សាទុក · Save audio';
  wrap.appendChild(dl);
  return wrap;
}

async function generateAudio(prompt) {
  addMsg('user', prompt);
  history.push({ role: 'user', content: prompt });
  persistChat();
  const div = addMsg('ai', 'កំពុងបង្កើតសំឡេង… (generating audio, ~10s)', 'A2I Audio');
  const body = div.querySelector('.md');
  const url = audioUrl(prompt);
  try {
    const wrap = await buildAudioWrap(url);
    body.innerHTML = '';
    body.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    history.push({ role: 'assistant', content: prompt, genAudio: url });
    persistChat();
  } catch {
    div.update('⚠ បង្កើតសំឡេងមិនបានទេ — ព្យាយាមម្តងទៀត ឬពិនិត្យអ៊ីនធឺណិត។ (Audio generation failed — try again.)');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (currentAbort) return;

  // Image generation: via the image toggle or a /image · /imagine command.
  const cmd = /^\/(image|imagine)\s+/i.exec(text);
  if ((imageMode && text) || cmd) {
    const prompt = cmd ? text.slice(cmd[0].length).trim() : text;
    if (!prompt) return;
    input.value = ''; input.style.height = 'auto';
    await generateImage(prompt);
    return;
  }

  // Audio / voice generation: via the audio toggle or a /audio · /speak · /voice command.
  const audCmd = /^\/(audio|speak|voice)\s+/i.exec(text);
  if ((audioMode && text) || audCmd) {
    const prompt = audCmd ? text.slice(audCmd[0].length).trim() : text;
    if (!prompt) return;
    input.value = ''; input.style.height = 'auto';
    await generateAudio(prompt);
    return;
  }

  if (!text && !attachedImages.length) return;
  const images = attachedImages.slice();
  input.value = '';
  input.style.height = 'auto';
  attachedImages = [];
  renderAttachPreview();
  addMsg('user', text, null, images);
  const msg = { role: 'user', content: text };
  if (images.length) msg.images = images;
  history.push(msg);
  persistChat();
  await generate();
});

regenBtn.addEventListener('click', async () => {
  if (currentAbort) return;
  if (history.at(-1)?.role !== 'assistant') return;
  history.pop();
  renderChat();
  await generate();
});

// ---- Voice in chat: dictate messages + read answers aloud --------------

const VOICE_LANG = navigator.language && navigator.language.startsWith('km') ? 'km-KH' : 'en-US';

function speakText(t) {
  if (!('speechSynthesis' in window) || !t) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t.replace(/[#*`>_~]/g, ''));
    u.lang = VOICE_LANG;
    window.speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}

const micBtn = $('mic-btn');
const SR_CHAT = window.SpeechRecognition || window.webkitSpeechRecognition;
let chatRecog = null, chatListening = false;
if (!SR_CHAT) {
  micBtn.style.display = 'none';
} else {
  micBtn.addEventListener('click', () => {
    if (chatListening) { try { chatRecog.stop(); } catch { /* */ } return; }
    chatRecog = new SR_CHAT();
    chatRecog.lang = VOICE_LANG;
    chatRecog.interimResults = true;
    chatRecog.continuous = false;
    const base = input.value.trim();
    chatRecog.onstart = () => { chatListening = true; micBtn.classList.add('rec'); };
    chatRecog.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      input.value = base ? base + ' ' + t : t;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    };
    chatRecog.onerror = () => { chatListening = false; micBtn.classList.remove('rec'); };
    chatRecog.onend = () => { chatListening = false; micBtn.classList.remove('rec'); input.focus(); };
    try { chatRecog.start(); } catch { /* already running */ }
  });
}

// textarea: Enter sends, Shift+Enter = new line, auto-grow
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
});

// ---- Settings panel ----------------------------------------------------

const overlay = $('settings-overlay');

function renderBrainList() {
  const list = $('set-brain-list');
  list.innerHTML = '';
  if (!serverBrains.length) {
    list.innerHTML = '<div class="hint" style="margin:0">No servers yet — add A2I Core below.</div>';
    return;
  }
  serverBrains.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'brain-row';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = b.name;
    const u = document.createElement('span'); u.className = 'u';
    u.textContent = b.url + (b.model ? ' · ' + b.model : '');
    const rm = document.createElement('button'); rm.className = 'rm'; rm.innerHTML = svgIcon('trash', 'ico-sm'); rm.title = 'Remove';
    rm.addEventListener('click', () => {
      serverBrains.splice(i, 1); saveBrains();
      rebuildEngineSelect(engineSel.value); refreshBar(); renderBrainList();
    });
    row.append(nm, u, rm);
    list.appendChild(row);
  });
}

function selectSettingsTab(tab = 'providers') {
  document.querySelectorAll<HTMLElement>('.set-tab').forEach((button) => {
    const current = button.dataset.tab === tab;
    button.hidden = button.dataset.tab === 'models';
    button.classList.toggle('active', current);
  });
  document.querySelectorAll<HTMLElement>('.tab-pane').forEach((pane) => {
    pane.hidden = pane.dataset.tab !== tab;
  });
}

function openSettings(_focus = '') {
  renderBrainList();
  selectSettingsTab('providers');
  overlay.hidden = false;
  refreshCorePolicy();
  refreshLocalCatalog();
  refreshKnowledgeStatus();
}
function closeSettings() { overlay.hidden = true; }

$('settings-btn').addEventListener('click', () => openSettings());
$('settings-close').addEventListener('click', closeSettings);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeSettings(); });

// "Chat with A2I Cloud" — jump straight to the server-configured engine.
const cloudGo = $('cloud-go');
if (cloudGo) cloudGo.addEventListener('click', () => {
  localStorage.setItem('a2i-engine', 'cloud');
  rebuildEngineSelect('cloud'); refreshBar();
  closeSettings();
  toast('A2I Cloud — ' + (cloudModel || T('stReady')), 'ok');
});

// Settings tabs intentionally omit remote provider setup in local-only mode.
document.querySelectorAll<HTMLElement>('.set-tab').forEach((b) => {
  b.addEventListener('click', () => {
    if (b.dataset.tab === 'models') return;
    selectSettingsTab(b.dataset.tab || 'providers');
    if (b.dataset.tab === 'safety') {
      refreshCorePolicy();
      refreshKnowledgeStatus();
    }
  });
});

function renderToolPolicy(tools) {
  const list = $('tool-policy-list');
  list.innerHTML = '';
  if (!Array.isArray(tools) || !tools.length) {
    list.innerHTML = '<div class="hint" style="margin:0">No tool policy is available from A2I Core.</div>';
    return;
  }
  tools.forEach((tool) => {
    const row = document.createElement('div');
    row.className = 'brain-row';
    const name = document.createElement('span'); name.className = 'nm';
    name.textContent = tool.title || tool.id;
    const detail = document.createElement('span'); detail.className = 'u';
    detail.textContent = (tool.enabled ? 'enabled' : 'disabled') +
      (tool.requires_confirmation ? ' · confirmation required' : '');
    const state = document.createElement('span'); state.className = 'statetag';
    state.textContent = tool.enabled ? '●' : '○';
    state.classList.toggle('on', !!tool.enabled);
    row.append(name, detail, state);
    list.appendChild(row);
  });
}

function renderKnowledgeStatus(payload) {
  const list = $('knowledge-status-list');
  list.innerHTML = '';
  if (!payload.loaded) {
    list.innerHTML = '<div class="hint" style="margin:0">No local knowledge folder is loaded. Start Core with <code>--knowledge-dir</code>.</div>';
    return;
  }
  const summary = document.createElement('div');
  summary.className = 'brain-row';
  const name = document.createElement('strong');
  name.textContent = `${payload.document_count || 0} local document(s) · ${payload.chunk_count || 0} retrieval chunk(s)`;
  summary.appendChild(name);
  list.appendChild(summary);
  (payload.documents || []).forEach((document) => {
    const row = document.createElement('div');
    row.className = 'brain-row';
    const source = document.createElement('span');
    source.className = 'nm';
    source.textContent = document.source;
    const chunks = document.createElement('span');
    chunks.className = 'muted';
    chunks.textContent = `${document.chunks} chunk(s)`;
    row.append(source, chunks);
    list.appendChild(row);
  });
  if (payload.truncated) {
    const note = document.createElement('div');
    note.className = 'hint';
    note.textContent = 'Only the first local document names are shown.';
    list.appendChild(note);
  }
}

async function refreshKnowledgeStatus() {
  const tag = $('knowledge-state');
  const core = a2iCoreBrain();
  tag.textContent = 'checking local index…'; tag.classList.remove('on');
  try {
    const response = await fetch(apiBase(core.url) + '/knowledge', { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    renderKnowledgeStatus(payload);
    tag.textContent = payload.loaded ? '● local index ready' : 'No index loaded';
    tag.classList.toggle('on', !!payload.loaded);
  } catch (error) {
    $('knowledge-status-list').innerHTML = '<div class="hint" style="margin:0">Core unavailable. Start A2I Core locally to inspect knowledge status.</div>';
    tag.textContent = 'Core unavailable'; tag.classList.remove('on');
  }
}

$('knowledge-refresh').addEventListener('click', () => refreshKnowledgeStatus());

function renderLocalCatalog(payload) {
  const list = $('local-model-catalog');
  list.innerHTML = '';
  const active = payload.active_model || {};
  const summary = document.createElement('div');
  summary.className = 'brain-row';
  const summaryName = document.createElement('strong');
  summaryName.textContent = active.valid_gguf ? 'Active GGUF model verified' : 'No active GGUF model verified';
  const summaryDetail = document.createElement('span');
  summaryDetail.className = 'muted';
  summaryDetail.textContent = active.valid_gguf
    ? `${Math.round((active.size_bytes || 0) / 1024 / 1024)} MB · SHA-256 ${String(active.sha256 || '').slice(0, 12)}…`
    : 'Run download-model.sh to install a reviewed local model.';
  summary.append(summaryName, summaryDetail);
  list.appendChild(summary);
  (payload.assets || []).forEach((asset) => {
    const row = document.createElement('div');
    row.className = 'brain-row';
    const name = document.createElement('strong');
    name.textContent = asset.name;
    const detail = document.createElement('span');
    detail.className = 'muted';
    detail.textContent = `${asset.id} · ${asset.quantization} · ${asset.approx_disk_gb} GB disk · ${asset.min_ram_gb}+ GB RAM`;
    const note = document.createElement('span');
    note.className = 'muted';
    note.textContent = asset.recommended_for;
    row.append(name, detail, note);
    list.appendChild(row);
  });
}

async function refreshLocalCatalog() {
  const tag = $('local-catalog-state');
  const core = a2iCoreBrain();
  tag.textContent = 'checking local catalog…'; tag.classList.remove('on');
  try {
    const response = await fetch(apiBase(core.url) + '/local-models', { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    renderLocalCatalog(await response.json());
    tag.textContent = '● local-only catalog'; tag.classList.add('on');
  } catch (error) {
    $('local-model-catalog').innerHTML = '<div class="hint" style="margin:0">Start A2I Core locally to view the verified model catalog.</div>';
    tag.textContent = 'Core unavailable'; tag.classList.remove('on');
  }
}

$('local-catalog-refresh').addEventListener('click', () => refreshLocalCatalog());

async function refreshCorePolicy() {
  const tag = $('router-state');
  const core = a2iCoreBrain();
  if (!core) {
    tag.textContent = 'A2I Core local endpoint is unavailable.';
    tag.classList.remove('on');
    return;
  }
  tag.textContent = 'checking local Core…'; tag.classList.remove('on');
  try {
    const base = apiBase(core.url);
    const [healthRes, toolsRes] = await Promise.all([
      fetch(core.url.replace(/\/+$/, '') + '/health', { signal: AbortSignal.timeout(8000) }),
      fetch(base + '/tools', { signal: AbortSignal.timeout(8000) }),
    ]);
    if (!healthRes.ok || !toolsRes.ok) throw new Error('Core returned HTTP ' + (!healthRes.ok ? healthRes.status : toolsRes.status));
    const health = await healthRes.json();
    const tools = await toolsRes.json();
    renderToolPolicy(tools.tools);
    tag.textContent = '● Core local-only online · ' + (health.model || 'model loading');
    tag.classList.add('on');
  } catch (error) {
    $('tool-policy-list').innerHTML = '<div class="hint" style="margin:0">Core policy unavailable. Start A2I Core locally and allow this browser origin.</div>';
    tag.textContent = 'Core unavailable'; tag.classList.remove('on');
  }
}

$('router-apply').addEventListener('click', () => {
  const index = ensureA2ICoreLocal();
  rebuildEngineSelect('server:' + index); refreshBar(); checkBrains();
  $('router-state').textContent = '● A2I Core local-only activated';
  $('router-state').classList.add('on');
  refreshCorePolicy();
  refreshLocalCatalog();
  refreshKnowledgeStatus();
});
$('router-refresh').addEventListener('click', () => { refreshCorePolicy(); refreshLocalCatalog(); refreshKnowledgeStatus(); });

$('set-gemini-save').addEventListener('click', () => {
  const key = $('set-gemini-key').value.trim();
  const model = $('set-gemini-model').value.trim() || 'gemini-2.5-flash';
  if (!key) { $('set-gemini-state').textContent = T('enterKeyFirst'); return; }
  localStorage.setItem('a2i-gemini-key', key);
  localStorage.setItem('a2i-gemini-model', model);
  localStorage.setItem('a2i-engine', 'gemini');
  rebuildEngineSelect('gemini'); refreshBar();
  const tag = $('set-gemini-state'); tag.textContent = T('savedActive'); tag.classList.add('on');
  toast(Tf('toastGemSaved', { model }), 'ok');
});
$('set-gemini-clear').addEventListener('click', () => {
  localStorage.removeItem('a2i-gemini-key');
  $('set-gemini-key').value = '';
  if (localStorage.getItem('a2i-engine') === 'gemini') localStorage.removeItem('a2i-engine');
  rebuildEngineSelect('browser'); refreshBar();
  const tag = $('set-gemini-state'); tag.textContent = 'cleared'; tag.classList.remove('on');
  toast(T('toastGemCleared'));
});

// ---- OpenCode Zen: one-click free provider --------------------------------
// The key lives in localStorage (like Gemini); saving it auto-creates/updates
// the "OpenCode Zen" server brain so the chat works with zero further steps.
// Zen API goes through the same-origin Vercel proxy (api/zen.js): opencode.ai
// answers browser CORS preflight with 404, so direct calls from this page are
// blocked ("Failed to fetch"). The proxy also works from file:// via the
// direct URL fallback.
const ZEN_URL = (location.protocol === 'http:' || location.protocol === 'https:')
  ? '/api/zen'
  : 'https://opencode.ai/zen/v1';
const ZEN_KEY = () => localStorage.getItem('a2i-zen-key') || '';
const ZEN_MODEL = () => localStorage.getItem('a2i-zen-model') || 'big-pickle';

function zenBrainIndex() {
  // Also match brains saved with the old direct URL (https://opencode.ai/zen/v1)
  // so a stale entry never causes a duplicate Zen brain.
  return serverBrains.findIndex((b) => {
    const u = (b.url || '').replace(/\/+$/, '');
    return u.startsWith(ZEN_URL) || u.includes('opencode.ai/zen');
  });
}
function ensureZenBrain() {
  const i = zenBrainIndex();
  const brain = { name: 'OpenCode Zen', url: ZEN_URL, model: ZEN_MODEL(), apiKey: ZEN_KEY() };
  if (i >= 0) serverBrains[i] = brain; else serverBrains.push(brain);
  saveBrains(); renderBrainList(); checkBrains();
  return i >= 0 ? i : serverBrains.length - 1;
}

async function testZenKey(key, tag) {
  if (LOCAL_ONLY) throw new Error('A2I local-only mode does not use Zen or API keys.');
  tag.textContent = T('testing') + '…'; tag.classList.remove('on');
  try {
    const res = await fetch(ZEN_URL + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (key || ZEN_KEY()) },
      body: JSON.stringify({ model: 'big-pickle', messages: [{ role: 'user', content: 'Reply with OK' }], max_tokens: 10 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + (res.status === 401 ? ' — ' + T('keyRejected') : ''));
    tag.textContent = '✓ ' + T('keyWorks'); tag.classList.add('on');
    toast(T('toastZenWorks'), 'ok');
    return true;
  } catch (err) {
    tag.textContent = '✗ ' + (err.message || 'failed');
    toast(Tf('toastZenTestFailed', { m: err.message || 'network error' }), 'err');
    return false;
  }
}

$('set-zen-test').addEventListener('click', () => {
  const key = $('set-zen-key').value.trim();
  if (!key) { $('set-zen-state').textContent = T('pasteKeyFirst'); return; }
  testZenKey(key, $('set-zen-state'));
});
$('set-zen-save').addEventListener('click', async () => {
  const key = $('set-zen-key').value.trim();
  if (!key) { $('set-zen-state').textContent = T('pasteKeyFirst'); return; }
  const model = ($('set-zen-model').value.trim() || 'big-pickle'); // free default; pick any from the datalist
  localStorage.setItem('a2i-zen-key', key);
  localStorage.setItem('a2i-zen-model', model);
  const tag = $('set-zen-state');
  const ok = await testZenKey(key, tag);
  if (ok) {
    ensureZenBrain();
    localStorage.setItem('a2i-engine', 'server:' + zenBrainIndex());
    rebuildEngineSelect('server:' + zenBrainIndex()); refreshBar();
    tag.textContent = '✓ ' + T('savedActive'); tag.classList.add('on');
    toast(Tf('toastZenSaved', { model }), 'ok');
  } else {
    tag.textContent += ' — ' + T('notSaved');
  }
});
$('set-zen-clear').addEventListener('click', () => {
  localStorage.removeItem('a2i-zen-key');
  localStorage.removeItem('a2i-zen-model');
  $('set-zen-key').value = '';
  const i = zenBrainIndex();
  if (i >= 0) { serverBrains.splice(i, 1); saveBrains(); renderBrainList(); }
  if (localStorage.getItem('a2i-engine') === 'server:' + i) localStorage.removeItem('a2i-engine');
  rebuildEngineSelect('browser'); refreshBar();
  const tag = $('set-zen-state'); tag.textContent = T('cleared'); tag.classList.remove('on');
  toast(T('toastZenCleared'));
});

$('set-brain-add').addEventListener('click', () => {
  const name = $('set-brain-name').value.trim();
  const url = $('set-brain-url').value.trim().replace(/\/+$/, '');
  const model = $('set-brain-model').value.trim();
  const apiKey = $('set-brain-key').value.trim();
  if (!name || !url) return;
  const brain = { name, url };
  if (model) brain.model = model;
  if (apiKey) brain.apiKey = apiKey;
  serverBrains.push(brain); saveBrains();
  ['set-brain-name', 'set-brain-url', 'set-brain-model', 'set-brain-key'].forEach((id) => { $(id).value = ''; });
  rebuildEngineSelect('server:' + (serverBrains.length - 1)); refreshBar();
  checkBrains(); renderBrainList();
});

// Free-provider quick presets: fill the form, focus the key field.
function fillProvider(name, url, model) {
  $('set-brain-name').value = name;
  $('set-brain-url').value = url;
  $('set-brain-model').value = model || '';
  $('set-brain-key').focus();
}
$('preset-groq').addEventListener('click', () =>
  fillProvider('Groq', 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile'));
// Cerebras — wafer-scale inference chips, one of the fastest free tiers.
$('preset-cerebras').addEventListener('click', () =>
  fillProvider('Cerebras', 'https://api.cerebras.ai/v1', 'qwen-3-235b-a22b-instruct-2507'));
$('preset-openrouter').addEventListener('click', () =>
  fillProvider('OpenRouter', 'https://openrouter.ai/api/v1', 'meta-llama/llama-3.3-70b-instruct:free'));
// Hugging Face's own OpenAI-compatible router — famous open models via a free
// hf_ token. The model is only a default: paste ANY repo id, e.g. the newest
// trending model from huggingface.co/models?sort=trending.
$('preset-hf').addEventListener('click', () =>
  fillProvider('Hugging Face', 'https://router.huggingface.co/v1', 'meta-llama/Llama-4-Scout-17B-16E-Instruct'));
// Api.Airforce — a single free gateway to 100+ open models.
$('preset-airforce').addEventListener('click', () =>
  fillProvider('Api.Airforce', 'https://api.airforce/v1', 'gpt-oss-120b'));
$('preset-zen').addEventListener('click', () => {
  // One click = done. If a Zen key is already saved, add/activate the brain
  // immediately; otherwise open Settings with the Zen key field focused.
  if (ZEN_KEY()) {
    ensureZenBrain();
    localStorage.setItem('a2i-engine', 'server:' + zenBrainIndex());
    rebuildEngineSelect('server:' + zenBrainIndex()); refreshBar(); renderBrainList();
    return;
  }
  fillProvider('OpenCode Zen', ZEN_URL, ZEN_MODEL() || 'big-pickle');
  openSettings('zen');
});
// Fetch the live model list from OpenCode Zen and fill the datalist so the
// user can pick any model (free or paid) straight from the input dropdown.
// Free-tier models end in -free; the count is shown right on the button.
let zenModels = [];
let zenModelsTried = false;
async function refreshZenModels() {
  if (LOCAL_ONLY) return [];
  const btn = $('preset-zen-refresh');
  btn.textContent = '↻ Loading…';
  btn.disabled = true;
  try {
    const res = await fetch(ZEN_URL + '/models', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const list = (data && (data.data || data)) || [];
    zenModels = list.map((m) => (typeof m === 'string' ? m : m.id)).filter(Boolean);
    const dl = $('zen-model-list');
    dl.innerHTML = '';
    zenModels.forEach((id) => {
      const o = document.createElement('option');
      o.value = id;
      dl.appendChild(o);
    });
    const free = zenModels.filter((id) => id.endsWith('-free') || id === 'big-pickle');
    btn.textContent = `↻ ${T('zenRefreshBtn')}: ${zenModels.length} (${free.length} free)`;
    zenModelsTried = true;
    if ($('set-brain-name').value === 'OpenCode Zen' && !$('set-brain-model').value) {
      $('set-brain-model').value = free[0] || zenModels[0] || 'big-pickle';
    }
    if (engineSel.value === 'cloud') syncModelPicker();
    return zenModels;
  } catch (err) {
    btn.textContent = `↻ ${T('zenRefreshBtn')} (${T('offline')})`;
    zenModelsTried = true;
    return [];
  } finally {
    btn.disabled = false;
  }
}
$('preset-zen-refresh').addEventListener('click', () => refreshZenModels());
// Warm the list once the chat DOM is up so the datalist + cloud model picker
// are ready before the user looks. `load` may already have fired by the time
// ChatShell injects this markup, so fall back to running immediately.
const warmZen = () => {
  if (LOCAL_ONLY) return;
  refreshZenModels();
  // Migrate brains saved with the old direct Zen URL (https://opencode.ai/zen/v1)
  // to the same-origin proxy, then recreate a missing Zen brain if a key is saved.
  let migrated = false;
  serverBrains.forEach((b, i) => {
    const u = (b.url || '').replace(/\/+$/, '');
    if (u.includes('opencode.ai/zen')) { serverBrains[i].url = ZEN_URL; migrated = true; }
  });
  if (migrated) { saveBrains(); rebuildEngineSelect(engineSel.value); }
  if (ZEN_KEY() && zenBrainIndex() < 0) ensureZenBrain();
};
if (document.readyState === 'complete') setTimeout(warmZen, 0);
else window.addEventListener('load', warmZen);
// Opencode Server bridge: A2I Core proxies oc/* models to the local
// `opencode serve` agent loop (session create + prompt). No key needed —
// a2i-core reuses the server password from OPENCODE_SERVER_PASSWORD.
$('preset-oc').addEventListener('click', () =>
  fillProvider('Opencode Server', 'http://127.0.0.1:8990', 'oc/big-pickle'));
let ocModels = [];
let ocModelsTried = false;
async function refreshOcModels() {
  const btn = $('preset-oc-refresh');
  // From a public https page the browser blocks plain-http localhost calls
  // (mixed content), so only try when the page itself is local.
  if (location.protocol !== 'http:') {
    btn.textContent = `↻ ${T('ocRefreshBtn')} (${T('localOnly')})`;
    return [];
  }
  btn.textContent = '↻ ' + T('loading');
  btn.disabled = true;
  try {
    const res = await fetch('http://127.0.0.1:8990/v1/models', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const list = (data && (data.data || data)) || [];
    ocModels = list
      .map((m) => (typeof m === 'string' ? m : m.id))
      .filter((id) => typeof id === 'string' && id.startsWith('oc/'));
    const dl = $('zen-model-list');
    ocModels.forEach((id) => {
      const o = document.createElement('option');
      o.value = id;
      dl.appendChild(o);
    });
    btn.textContent = `↻ ${T('ocRefreshBtn')}: ${ocModels.length}`;
    ocModelsTried = true;
    if ($('set-brain-name').value === 'Opencode Server' && !$('set-brain-model').value && ocModels.length) {
      $('set-brain-model').value = ocModels[0];
    }
    return ocModels;
  } catch (err) {
    btn.textContent = `↻ ${T('ocRefreshBtn')} (${T('offline')})`;
    ocModelsTried = true;
    return [];
  } finally {
    btn.disabled = false;
  }
}
$('preset-oc-refresh').addEventListener('click', () => refreshOcModels());
$('preset-a2icore').addEventListener('click', () =>
  fillProvider('A2I Core', 'http://127.0.0.1:8990', ''));
// vLLM serves /v1/chat/completions and /v1/completions on port 8000 — the
// same contract as A2I Core, but GPU-accelerated for big models.
$('preset-vllm').addEventListener('click', () =>
  fillProvider('vLLM', 'http://127.0.0.1:8000/v1', 'Qwen/Qwen2.5-Coder-7B-Instruct'));
$('preset-ollama').addEventListener('click', () =>
  fillProvider('Ollama', 'http://127.0.0.1:11434/v1', 'qwen2.5-coder'));

$('set-theme').addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

function refreshAutospeak() {
  const on = localStorage.getItem('a2i-autospeak') === '1';
  $('set-autospeak-label').textContent = on ? T('autospeakOn') : T('autospeakOff');
  $('set-autospeak').classList.toggle('primary', on);
}
$('set-autospeak').addEventListener('click', () => {
  localStorage.setItem('a2i-autospeak',
    localStorage.getItem('a2i-autospeak') === '1' ? '0' : '1');
  refreshAutospeak();
});
refreshAutospeak();

// ---- Project panel: ask about / edit a codebase via A2I Core ----------
// The browser has no filesystem, so the user loads files here and A2I Core's
// agent endpoints do the work. Edits come back as data and are shown for
// download — the app never silently rewrites anyone's files.

const projectOverlay = $('project-overlay');
const projectFiles = new Map();      // path -> content
const MAX_PROJECT_BYTES = 400_000;

function projectState(message, busy = false) {
  const el = $('project-state');
  el.textContent = message;
  el.classList.toggle('on', !busy && /✓/.test(message));
}

function renderProjectList() {
  const list = $('project-list');
  if (!projectFiles.size) { list.textContent = T('projNoFiles'); return; }
  const total = [...projectFiles.values()].reduce((n, t) => n + t.length, 0);
  list.textContent = Tf('projFilesLoaded', { n: String(projectFiles.size), kb: String(Math.round(total / 1024)) });
}

async function addProjectFiles(fileList) {
  let skipped = 0;
  for (const file of fileList) {
    if (file.size > MAX_PROJECT_BYTES) { skipped++; continue; }
    try {
      projectFiles.set(file.webkitRelativePath || file.name, await file.text());
    } catch { skipped++; }
  }
  renderProjectList();
  if (skipped) projectState(Tf('projSkipped', { n: String(skipped) }));
}

$('project-btn').addEventListener('click', () => {
  projectOverlay.hidden = false;
  renderProjectList();
  setTimeout(() => $('project-task').focus(), 50);
});
$('project-close').addEventListener('click', () => { projectOverlay.hidden = true; });
projectOverlay.addEventListener('click', (e) => {
  if (e.target === projectOverlay) projectOverlay.hidden = true;
});
$('project-pick').addEventListener('click', () => $('project-files').click());
$('project-files').addEventListener('change', (e) => addProjectFiles(e.target.files));

const dropzone = $('project-drop');
['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); dropzone.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); dropzone.classList.remove('over');
  if (ev === 'drop' && e.dataTransfer?.files?.length) addProjectFiles(e.dataTransfer.files);
}));

// The agent endpoints live on A2I Core, not on the hosted page.
function coreBaseUrl() {
  const brain = serverBrains.find((b) => b.online !== false) || serverBrains[0];
  return brain ? brain.url.replace(/\/+$/, '') : 'http://127.0.0.1:8990';
}

async function callAgent(path, body) {
  const res = await fetch(coreBaseUrl() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(Tf('errA2ICore', { s: String(res.status), detail: detail.slice(0, 160) }));
  }
  return res.json();
}

function requireProjectInput() {
  const task = $('project-task').value.trim();
  if (!projectFiles.size) { projectState(T('projLoadFirst')); return null; }
  if (!task) { projectState(T('projTaskFirst')); return null; }
  return task;
}

$('project-ask').addEventListener('click', async () => {
  const task = requireProjectInput();
  if (!task) return;
  const out = $('project-output');
  out.hidden = false;
  out.textContent = T('projThinking');
  projectState(T('projAsking'), true);
  try {
    const data = await callAgent('/v1/agent/ask', {
      question: task, files: Object.fromEntries(projectFiles),
    });
    out.innerHTML = renderMarkdown(data.answer || T('projNoAnswer'));
    projectState('✓ ' + T('projDone'));
  } catch (err) {
    out.textContent = '⚠ ' + err.message +
      '\n\n' + T('projStartCore');
    projectState(T('projFailed'));
  }
});

$('project-plan').addEventListener('click', async () => {
  const task = requireProjectInput();
  if (!task) return;
  const out = $('project-output');
  out.hidden = false;
  out.textContent = 'Creating a local review plan…';
  projectState('Planning locally…', true);
  try {
    const data = await callAgent('/v1/agent/plan', { task, files: Object.fromEntries(projectFiles) });
    out.innerHTML = '';
    const plan = document.createElement('pre');
    plan.textContent = data.plan || 'No plan returned.';
    out.appendChild(plan);
    projectState('✓ Review plan ready');
  } catch (err) {
    out.textContent = '⚠ ' + err.message + '\n\n' + T('projStartCore');
    projectState(T('projFailed'));
  }
});

$('project-edit').addEventListener('click', async () => {
  const task = requireProjectInput();
  if (!task) return;
  if (!$('project-approval').checked) {
    projectState('Confirm review-first approval before requesting edits.');
    return;
  }
  const out = $('project-output');
  out.hidden = false;
  out.textContent = T('projWorking');
  projectState(T('projEditing'), true);
  try {
    const data = await callAgent('/v1/agent/edit', {
      task, files: Object.fromEntries(projectFiles),
      a2i_approval: true,
      scope: 'Generate reviewable edit proposals for the files loaded in this Project panel.',
    });
    const changed = Object.entries(data.files || {});
    out.innerHTML = '';
    const summary = document.createElement('div');
    summary.textContent =
      `${data.applied || 0} edit(s) applied, ${data.failed || 0} failed` +
      (changed.length ? ` — ${changed.length} file(s) changed:` : ' — no files changed.');
    out.appendChild(summary);
    if (data.plan) {
      const plan = document.createElement('details');
      plan.innerHTML = '<summary>Plan</summary>';
      const body = document.createElement('pre');
      body.textContent = data.plan;
      plan.appendChild(body);
      out.appendChild(plan);
    }
    for (const [path, content] of changed) {
      const row = document.createElement('div');
      row.className = 'project-file';
      const name = document.createElement('span');
      name.className = 'nm'; name.textContent = path;
      const dl = document.createElement('button');
      dl.className = 'btn'; dl.innerHTML = svgIcon('download', 'ico-sm') + ' Download';
      dl.addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url; a.download = path.split('/').pop();
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
      row.append(name, dl);
      out.appendChild(row);
      // The proposal is not applied to the loaded project. The user must review
      // the downloaded file and decide whether to replace anything outside A2I.
    }
    projectState(changed.length ? '✓ ' + T('projDone') : T('projNoChanges'));
  } catch (err) {
    out.textContent = '⚠ ' + err.message +
      '\n\n' + T('projStartCore');
    projectState(T('projFailed'));
  }
});

// ---- PWA: installable + offline app ------------------------------------

if ('serviceWorker' in navigator) {
  const registerSw = async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.update();
    } catch { /* offline install optional */ }
  };
  if (document.readyState === 'complete') setTimeout(registerSw, 0);
  else window.addEventListener('load', registerSw);
  // When a new service worker takes control (updated code), reload once so the
  // user always ends up on the freshest version instead of stale cached code.
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloaded) return; swReloaded = true; location.reload();
  });
}
let deferredInstall = null;
const installBtn = $('install-btn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (installBtn) installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice.catch(() => {});
  deferredInstall = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { if (installBtn) installBtn.hidden = true; });

// ---- Export / share the current chat -----------------------------------

function chatToMarkdown() {
  const msgs = history.filter((m) => m.role !== 'system');
  if (!msgs.length) return '';
  const date = new Date().toLocaleString();
  let md = `# A2I chat — ${date}\n\n`;
  for (const m of msgs) {
    const who = m.role === 'user' ? 'You' : 'A2I';
    const body = m.content || (m.images?.length ? '_[image]_' : '');
    md += `### ${who}\n\n${body}\n\n`;
  }
  return md.trim() + '\n';
}

const exportBtn = $('export-btn');
const exportMenu = $('export-menu');
exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.hidden = !exportMenu.hidden;
});
document.addEventListener('click', () => { exportMenu.hidden = true; });
exportMenu.addEventListener('click', (e) => e.stopPropagation());

exportMenu.querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', async () => {
    const md = chatToMarkdown();
    exportMenu.hidden = true;
    if (!md) { addMsg('note', T('noteNothingExport')); return; }
    const act = b.dataset.act;
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(md); b.innerHTML = svgIcon('check') + ' ' + T('copied'); } catch { /* */ }
      setTimeout(() => { b.innerHTML = svgIcon('copy') + ' ' + T('copyChat'); }, 1200);
    } else if (act === 'download') {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'a2i-chat-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.md';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else if (act === 'share') {
      if (navigator.share) {
        try { await navigator.share({ title: 'A2I chat', text: md }); } catch { /* cancelled */ }
      } else {
        try { await navigator.clipboard.writeText(md); addMsg('note', T('noteShareCopied')); } catch { /* */ }
      }
    }
  });
});

// ---- Command palette (⌘K): search chats + run actions ------------------

const paletteOverlay = $('palette-overlay');
const paletteInput = $('palette-input');
const paletteList = $('palette-list');
let paletteItems = [], paletteSel = 0;

function paletteActions() {
  const list = [
    { icon: 'plus', label: T('palNewChat'), run: newChat },
    { icon: 'code', label: T(coderMode ? 'palCoderOff' : 'palCoderOn'), run: () => $('coder-btn').click() },
    { icon: 'settings', label: T('palSettings'), run: () => openSettings() },
    { icon: 'sparkles', label: T('palGemini'), run: () => openSettings('gemini') },
    { icon: 'bot', label: T('palLive'), run: () => { location.href = '/live'; } },
    { icon: 'contrast', label: T('palTheme'), run: () =>
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') },
    { icon: 'download', label: T('palCopy'), run: async () => {
      const md = chatToMarkdown(); if (md) await navigator.clipboard.writeText(md).catch(() => {}); } },
  ];
  return list;
}

function buildPalette(q) {
  q = q.trim().toLowerCase();
  const items = [];
  for (const a of paletteActions()) {
    if (!q || a.label.toLowerCase().includes(q)) items.push({ ...a, tag: 'command' });
  }
  for (const c of chats) {
    const title = c.title || 'Chat';
    const hay = (title + ' ' + (c.messages || []).map((m) => m.content || '').join(' ')).toLowerCase();
    if (!q || hay.includes(q)) {
      items.push({ icon: 'message', label: title, tag: 'chat', run: () => openChat(c.id) });
    }
    if (items.length > 50) break;
  }
  return items;
}

function renderPalette() {
  paletteItems = buildPalette(paletteInput.value);
  if (paletteSel >= paletteItems.length) paletteSel = Math.max(0, paletteItems.length - 1);
  paletteList.innerHTML = '';
  paletteItems.forEach((it, i) => {
    const row = document.createElement('button');
    row.className = 'pal-row' + (i === paletteSel ? ' sel' : '');
    const pi = document.createElement('span'); pi.className = 'pi'; pi.innerHTML = svgIcon(it.icon);
    const pl = document.createElement('span'); pl.className = 'pl'; pl.textContent = it.label;
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = it.tag;
    row.append(pi, pl, tag);
    row.addEventListener('click', () => runPalette(i));
    row.addEventListener('mousemove', () => { if (paletteSel !== i) { paletteSel = i; highlightPalette(); } });
    paletteList.appendChild(row);
  });
  if (paletteItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pal-empty';
    empty.textContent = T('palEmpty');
    paletteList.appendChild(empty);
  }
}
function highlightPalette() {
  [...paletteList.children].forEach((r, i) => {
    r.classList.toggle('sel', i === paletteSel);
    if (i === paletteSel) r.scrollIntoView({ block: 'nearest' });
  });
}
function runPalette(i) { const it = paletteItems[i]; closePalette(); it?.run?.(); }
function openPalette() {
  paletteOverlay.hidden = false; paletteInput.value = ''; paletteSel = 0; renderPalette();
  setTimeout(() => paletteInput.focus(), 40);
}
function closePalette() { paletteOverlay.hidden = true; }

paletteInput.addEventListener('input', () => { paletteSel = 0; renderPalette(); });
paletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); paletteSel = Math.min(paletteSel + 1, paletteItems.length - 1); highlightPalette(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); paletteSel = Math.max(paletteSel - 1, 0); highlightPalette(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteSel); }
  else if (e.key === 'Escape') { closePalette(); }
});
paletteOverlay.addEventListener('click', (e) => { if (e.target === paletteOverlay) closePalette(); });
$('search-btn').addEventListener('click', openPalette);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
});

// ---- Language switching (km / en) --------------------------------------

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const val = T(key);
    if (el.hasAttribute('data-i18n-html')) el.innerHTML = val;
    else el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const key = el.getAttribute('data-i18n-ph');
    if (key) el.setAttribute('placeholder', T(key));
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', T(key));
  });
  document.documentElement.lang = getLang();
}

function refreshLangUI() {
  rebuildEngineSelect(engineSel.value);
  refreshBar();
  if ($('welcome')) showWelcome();
  refreshCloudStatusUI();
  renderBrainList();
  refreshAutospeak();
  if ($('preset-zen-refresh')) $('preset-zen-refresh').textContent = `↻ ${T('zenRefreshBtn')}`;
  if ($('preset-oc-refresh')) $('preset-oc-refresh').textContent = `↻ ${T('ocRefreshBtn')}`;
  const langBtn = $('lang-btn');
  if (langBtn) langBtn.textContent = getLang() === 'km' ? 'EN' : 'ខ្មែរ';
}

$('lang-btn').addEventListener('click', () => {
  setLang(getLang() === 'km' ? 'en' : 'km');
  applyLang();
  refreshLangUI();
});
applyLang();
refreshLangUI();

// ---- Init --------------------------------------------------------------

rebuildEngineSelect(null);
refreshCoderUI();
refreshBar();
renderChat();
renderChatList();
loadKnowledge();
checkBrains();
// Local-only mode never probes or selects a hosted provider.
if (!LOCAL_ONLY) {
  checkCloud().then(() => rebuildEngineSelect(engineSel.value));
}
}
