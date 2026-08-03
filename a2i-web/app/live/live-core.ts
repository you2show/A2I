// A2I Live core — ported 1:1 from live.html.

export function initLive(): void {
const _elStub = new Proxy({}, {
  get(_t, p) {
    if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    if (p === 'style' || p === 'dataset') return {};
    if (p === 'value' || p === 'textContent') return '';
    return () => _elStub;
  },
  set() { return true; },
});
const $ = (id) => document.getElementById(id) || _elStub;
const body: HTMLElement = (document.querySelector('.live-shell') as HTMLElement) || document.body;
const capUser = $('cap-user'), capAI = $('cap-ai'), statusEl = $('status');
const micBtn = $('mic'), form = $('form'), input = $('input');
const langBtn = $('lang'), langLabel = $('lang-label'), autoBtn = $('autolisten');

const SYSTEM_PROMPT =
  'You are A2I, a friendly, futuristic voice AI assistant. Keep answers concise, ' +
  'natural and easy to speak aloud. Reply in the language of the user (Khmer or English).';

// ---- Which brain to talk to (native A2I Core by default) ----------------
// A2I Core is the robust, fully-local backend (native llama.cpp). We also try
// the A2I Cloud proxy (/api/chat) if the local server is not reachable.
// When this page is served BY A2I Core (http://127.0.0.1:8990/live) we call it
// same-origin — no mixed-content or CORS concerns. When served from the hosted
// (https) site, we call the local server directly (browsers allow localhost).
const onLocalServer = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(location.origin);
const CORE_URL = localStorage.getItem('a2i-live-url') ||
  (onLocalServer ? location.origin : 'http://127.0.0.1:8990');
const history = [{ role: 'system', content: SYSTEM_PROMPT }];

function setState(s, label) {
  body.dataset.state = s;
  if (label) statusEl.textContent = label;
}

// ---- Spline load / fallback --------------------------------------------
const spline = $('spline');
let splineOk = false;
const markSplineOk = () => { splineOk = true; body.classList.remove('spline-failed'); };
spline?.addEventListener('load', markSplineOk);
spline?.addEventListener('load-complete', markSplineOk);
// The viewer renders into a <canvas> in its shadow DOM. Poll for it: if it
// appears, the robot is live; if nothing renders in ~12s (e.g. the CDN/scene
// is blocked or offline), show the animated orb fallback instead.
let polls = 0;
const splinePoll = setInterval(() => {
  const canvas = spline && (spline.shadowRoot?.querySelector('canvas') || spline.querySelector('canvas'));
  if (canvas) { markSplineOk(); clearInterval(splinePoll); return; }
  if (++polls > 24) { clearInterval(splinePoll); if (!splineOk) body.classList.add('spline-failed'); }
}, 500);
// If the runtime script itself fails to load, fall back immediately.
window.addEventListener('error', (e) => {
  if (String(e?.target?.src || '').includes('spline')) body.classList.add('spline-failed');
}, true);

// ---- Talking to the model (OpenAI-compatible streaming) ----------------
let controller = null;

async function readSSE(res, onDelta) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let answer = '', buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const d = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
        if (d) { answer += d; onDelta(answer); }
      } catch { /* keep-alive */ }
    }
  }
  return answer;
}

// ---- Gemini (your own API key, called straight from the browser) --------
const GEMINI_KEY = () => localStorage.getItem('a2i-gemini-key') || '';
const GEMINI_MODEL = () => localStorage.getItem('a2i-gemini-model') || 'gemini-2.0-flash';

function toGeminiBody(messages, maxTokens = 512) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages.filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  return body;
}

async function askGemini(messages, onDelta, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(GEMINI_MODEL())}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_KEY())}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toGeminiBody(messages, 512)), signal,
  });
  if (!res.ok) throw new Error('Gemini error ' + res.status + ': ' + (await res.text().catch(() => '')).slice(0, 140));
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let answer = '', buf = '';
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const parts = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts || [];
        const t = parts.map((p) => p.text || '').join('');
        if (t) { answer += t; onDelta(answer); }
      } catch { /* keep-alive */ }
    }
  }
  return answer;
}

async function askModel(messages, onDelta, signal) {
  // 0) Gemini, if you've pasted a key — works anywhere, no local server needed.
  if (GEMINI_KEY()) return askGemini(messages, onDelta, signal);
  // 1) local A2I Core (or any OpenAI-compatible URL)
  try {
    const res = await fetch(CORE_URL.replace(/\/+$/, '') + '/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream: true, max_tokens: 512, temperature: 0.7 }),
      signal,
    });
    if (res.ok) return await readSSE(res, onDelta);
  } catch { /* fall through to cloud */ }
  // 2) A2I Cloud proxy (optional)
  const res = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, max_tokens: 512 }), signal,
  }).catch(() => null);
  if (res && res.ok) return await readSSE(res, onDelta);
  throw new Error(
    'មិនអាចភ្ជាប់ខួរក្បាល A2I បានទេ — ចាប់ផ្តើម A2I Core (http://127.0.0.1:8990) សិន។ ' +
    '(No A2I brain reachable — start A2I Core first.)');
}

// ---- Voice output (the robot speaks) -----------------------------------
let voices = [];
const loadVoices = () => { voices = speechSynthesis.getVoices(); };
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const want = lang === 'km' ? 'km' : 'en';
  const v = voices.find((v) => v.lang?.toLowerCase().startsWith(want))
    || voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
  if (v) u.voice = v;
  u.rate = 1; u.pitch = 1;
  u.onstart = () => setState('speaking', 'speaking…');
  u.onend = () => { setState('idle', 'tap the mic and speak'); if (autoListen) startRecog(); };
  speechSynthesis.speak(u);
}

// ---- The turn: send text → stream → caption → speak --------------------
async function handle(text) {
  if (!text.trim()) return;
  controller?.abort();
  controller = new AbortController();
  capUser.textContent = '“' + text + '”';
  capAI.textContent = '';
  history.push({ role: 'user', content: text });
  setState('thinking', 'thinking…');
  try {
    const answer = await askModel(history, (t) => { capAI.textContent = t; }, controller.signal);
    if (answer) { history.push({ role: 'assistant', content: answer }); speak(answer); }
    else setState('idle', 'tap the mic and speak');
  } catch (err) {
    capAI.textContent = '⚠ ' + err.message;
    setState('idle', 'tap the mic and speak');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const t = input.value.trim(); if (!t) return;
  input.value = ''; handle(t);
});

// ---- Voice input (you talk to the robot) -------------------------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let lang = localStorage.getItem('a2i-live-lang') || 'en';
let recog = null, listening = false, autoListen = false;
langLabel.textContent = lang.toUpperCase();

function buildRecog() {
  if (!SR) return null;
  const r = new SR();
  r.lang = lang === 'km' ? 'km-KH' : 'en-US';
  r.interimResults = true;
  r.continuous = false;
  r.onstart = () => { listening = true; setState('listening', 'listening…'); micBtn.classList.remove('off'); startMicAnalyser(); };
  r.onresult = (e) => {
    let txt = '';
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    capUser.textContent = '“' + txt + '”';
    if (e.results[e.results.length - 1].isFinal) { listening = false; handle(txt); }
  };
  r.onerror = (e) => {
    listening = false; stopMicAnalyser();
    setState('idle', e.error === 'not-allowed'
      ? 'microphone blocked — allow mic access' : 'tap the mic and speak');
  };
  r.onend = () => { listening = false; stopMicAnalyser(); if (body.dataset.state === 'listening') setState('idle', 'tap the mic and speak'); };
  return r;
}

function startRecog() {
  if (!SR) { setState('idle', 'voice input not supported — type instead'); return; }
  if (listening) return;
  recog = buildRecog();
  try { recog.start(); } catch { /* already started */ }
}
function stopRecog() { try { recog?.stop(); } catch {} listening = false; }

micBtn.addEventListener('click', () => {
  if (!SR) { input.focus(); setState('idle', 'voice not supported here — type below'); return; }
  if (listening) stopRecog(); else startRecog();
});

langBtn.addEventListener('click', () => {
  lang = lang === 'km' ? 'en' : 'km';
  localStorage.setItem('a2i-live-lang', lang);
  langLabel.textContent = lang.toUpperCase();
});

autoBtn.addEventListener('click', () => {
  autoListen = !autoListen;
  autoBtn.classList.toggle('on', autoListen);
  if (autoListen) startRecog();
});

// ---- Gemini API key ----------------------------------------------------
const geminiBtn = $('gemini-btn');
function refreshGeminiBtn() {
  const on = !!GEMINI_KEY();
  geminiBtn.classList.toggle('on', on);
  $('gemini-label').textContent = on ? 'Gemini ✓' : 'Gemini';
  geminiBtn.title = on ? 'Using Gemini (' + GEMINI_MODEL() + ') — click to change/clear' : 'Use your Gemini API key';
}
geminiBtn.addEventListener('click', () => {
  const key = prompt(
    'Paste your Gemini API key (free from https://aistudio.google.com/apikey).\n' +
    'Stored only in this browser, sent directly to Google. Leave empty to clear:',
    GEMINI_KEY());
  if (key === null) return;
  if (!key.trim()) { localStorage.removeItem('a2i-gemini-key'); refreshGeminiBtn();
    setState('idle', 'Gemini cleared — using local A2I Core'); return; }
  localStorage.setItem('a2i-gemini-key', key.trim());
  const model = prompt('Gemini model (e.g. gemini-2.0-flash, gemini-2.5-flash):', GEMINI_MODEL());
  if (model && model.trim()) localStorage.setItem('a2i-gemini-model', model.trim());
  refreshGeminiBtn();
  setState('idle', '✨ Gemini ready — tap the mic and speak');
});
refreshGeminiBtn();

// ---- Audio-reactive visualizer -----------------------------------------
// A ring of bars around the robot. While you speak it reacts to your real
// voice (Web Audio analyser); while the robot thinks/speaks it animates with a
// synthetic wave. Everything degrades gracefully if the mic/AudioContext is
// unavailable — the ring still breathes so the scene always feels alive.
const viz = $('viz');
const vctx = viz && viz.getContext ? viz.getContext('2d') : null;
let audioCtx = null, analyser = null, freqData = null, micStream = null, micLive = false;
const N = 84;
const smooth = new Float32Array(N);

function sizeViz() {
  if (!vctx) return;
  const r = viz.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viz.width = Math.max(2, r.width * dpr);
  viz.height = Math.max(2, r.height * dpr);
}
sizeViz();
addEventListener('resize', sizeViz);

async function startMicAnalyser() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    audioCtx.createMediaStreamSource(micStream).connect(analyser);
    micLive = true;
  } catch { micLive = false; }
}
function stopMicAnalyser() {
  micLive = false; analyser = null;
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
}

const STATE_COLOR = { idle: [108,140,255], listening: [74,168,255], thinking: [240,180,41], speaking: [62,207,142] };

function drawViz() {
  if (!vctx) return;
  requestAnimationFrame(drawViz);
  const W = viz.width, H = viz.height, cx = W / 2, cy = H / 2;
  vctx.clearRect(0, 0, W, H);
  const state = body.dataset.state || 'idle';
  const [r, g, b] = STATE_COLOR[state] || STATE_COLOR.idle;
  const baseR = Math.min(W, H) * 0.315;
  const maxLen = Math.min(W, H) * 0.14;

  let live = false;
  if (micLive && analyser && state === 'listening') { analyser.getByteFrequencyData(freqData); live = true; }
  const now = performance.now();
  const speed = state === 'speaking' ? 300 : state === 'thinking' ? 620 : 1400;
  const gain = state === 'speaking' ? 0.72 : state === 'thinking' ? 0.34 : state === 'listening' ? 0.5 : 0.16;

  vctx.save();
  vctx.translate(cx, cy);
  vctx.lineCap = 'round';
  vctx.shadowBlur = 18; vctx.shadowColor = `rgba(${r},${g},${b},.9)`;
  for (let i = 0; i < N; i++) {
    let target;
    if (live) target = freqData[Math.floor(i * freqData.length / N)] / 255;
    else target = gain * (0.45 + 0.55 * Math.abs(Math.sin(now / speed + i * 0.4)));
    smooth[i] += (target - smooth[i]) * 0.28;
    const len = maxLen * (0.12 + smooth[i]);
    const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
    const x1 = Math.cos(ang) * baseR, y1 = Math.sin(ang) * baseR;
    const x2 = Math.cos(ang) * (baseR + len), y2 = Math.sin(ang) * (baseR + len);
    vctx.strokeStyle = `rgba(${r},${g},${b},${0.35 + smooth[i] * 0.6})`;
    vctx.lineWidth = Math.max(2, W * 0.004);
    vctx.beginPath(); vctx.moveTo(x1, y1); vctx.lineTo(x2, y2); vctx.stroke();
  }
  vctx.restore();
}
requestAnimationFrame(drawViz);

// ---- Init --------------------------------------------------------------
$('foot').innerHTML = SR
  ? 'និយាយ ឬវាយ — ភ្ជាប់ A2I Core មូលដ្ឋាន · talk or type · powered by your local A2I Core. ' +
    '<span style="opacity:.7">(Voice recognition uses your browser\'s speech service.)</span>'
  : 'Browser នេះមិនគាំទ្រការនិយាយទេ — សូមវាយសួរ · this browser has no speech input — type to chat.';
if (!SR) micBtn.classList.add('off');
}
