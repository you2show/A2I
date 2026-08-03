import Link from 'next/link';

const FEATURES = [
  {
    icon: 'bolt',
    title: 'Free frontier models',
    text: 'Big Pickle, DeepSeek V4 Flash Free & more via OpenCode Zen — no credit card, free tier every day. Keys stay in your browser.',
  },
  {
    icon: 'chip',
    title: 'AI that runs on your device',
    text: 'Load a GGUF model straight from your SSD or run GPU inference with WebLLM — private, offline-capable, and no API needed.',
  },
  {
    icon: 'sparkle',
    title: 'Gemini with your key',
    text: 'Paste your free Gemini API key and chat with Gemini 2.x models — sent directly to Google, stored only in your browser.',
  },
  {
    icon: 'globe',
    title: 'Web search & RAG',
    text: 'Wikipedia (Khmer + English), arXiv, Hacker News and your own knowledge files — answers grounded in real sources.',
  },
  {
    icon: 'image',
    title: 'Image & audio generation',
    text: 'Generate images (Pollinations) and spoken audio from your answers right in the chat — all free, no key.',
  },
  {
    icon: 'mic',
    title: '3D voice assistant',
    text: 'Talk to A2I Live: speech recognition, a futuristic 3D robot, and a real-time audio visualizer. Khmer & English.',
  },
];

const ICONS: Record<string, React.ReactNode> = {
  bolt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  ),
  chip: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="10" y="10" width="4" height="4" /><line x1="9" y1="2" x2="9" y2="5" /><line x1="15" y1="2" x2="15" y2="5" /><line x1="9" y1="19" x2="9" y2="22" /><line x1="15" y1="19" x2="15" y2="22" /><line x1="2" y1="9" x2="5" y2="9" /><line x1="2" y1="15" x2="5" y2="15" /><line x1="19" y1="9" x2="22" y2="9" /><line x1="19" y1="15" x2="22" y2="15" /></svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.3L12 3z" /><path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z" /></svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
  ),
};

const STATS = [
  { n: '60+', label: 'free models' },
  { n: '6', label: 'providers' },
  { n: '0', label: 'sign-up needed' },
  { n: '100%', label: 'private, in your browser' },
];

const STEPS = [
  {
    n: '1',
    title: 'Open the chat',
    text: 'No sign-up, no download. Open the app and start typing — it works in any browser, even on your phone.',
  },
  {
    n: '2',
    title: 'Pick your brain',
    text: 'Choose OpenCode Zen (free, instant) or Gemini — or run a model on your own device. Switch anytime.',
  },
  {
    n: '3',
    title: 'Ask anything',
    text: 'Chat with streaming answers, thinking blocks, code copy, web search, images, audio and voice.',
  },
];

const FAQS = [
  {
    q: 'Is it really free?',
    a: 'Yes. OpenCode Zen offers free frontier models, image & audio generation is keyless, and everything local runs on your own hardware. If you add your own Gemini or provider key, that is your choice — the app never charges you.',
  },
  {
    q: 'Where does my data go?',
    a: 'Local models run entirely on your device — nothing leaves your machine. Web search queries go to Wikipedia/arXiv/HN only when you enable search. API keys are stored in your browser (localStorage) and sent directly to the provider you chose.',
  },
  {
    q: 'Which models can I use?',
    a: 'All free OpenCode Zen models (Big Pickle, DeepSeek V4 Flash Free, Mimo, Nemotron and more), Gemini 2.x, in-browser GGUF models from ~0.5B to 32B (CPU via wllama, GPU via WebLLM), or any OpenAI-compatible server you run yourself (Ollama, vLLM, LM Studio, A2I Core…).',
  },
  {
    q: 'How do I run models on my own computer?',
    a: 'In Settings → Providers, pick a preset (Ollama, vLLM, LM Studio, A2I Core) and start the matching server on your machine. A2I detects it automatically and streams answers from it.',
  },
  {
    q: 'Can I install it as an app?',
    a: 'Yes — A2I is a PWA. Open it in your browser and choose "Install app" (or Add to Home Screen on mobile) to use it full-screen and offline.',
  },
];

export default function HomePage() {
  return (
    <div className="home-root">
      <div className="home-hero-bg" aria-hidden="true" />

      <nav className="home-nav">
        <div className="brand">
          <div className="logo">A2</div>
          A2I
        </div>
        <div className="spacer" />
        <a className="link" href="#features">Features</a>
        <a className="link" href="#how">How it works</a>
        <a className="link" href="#faq">FAQ</a>
        <a className="link" href="/live">Live</a>
        <Link className="link cta" href="/chat">Open Chat →</Link>
      </nav>

      <header className="home-hero">
        <div className="home-badge"><span className="dot" /> 100% free · no card · គ្មានថ្លៃ</div>
        <h1>All your AI brains, <em>one chat.</em></h1>
        <p className="sub">
          A2I brings free frontier models, your own Gemini key, on-device GGUF models,
          web search, image &amp; audio generation and a 3D voice assistant into a single,
          private chat — in Khmer and English. សួរអ្វីក៏បាន ឥតគិតថ្លៃ។
        </p>
        <div className="home-cta">
          <Link className="btn-lg primary" href="/chat">Start chatting · ចាប់ផ្ដើម</Link>
          <a className="btn-lg" href="#how">See how it works</a>
        </div>
        <div className="home-chips">
          <span>⚡ OpenCode Zen free</span>
          <span>✨ Gemini ready</span>
          <span>🧠 Runs offline</span>
          <span>🗣️ 3D voice AI</span>
          <span>🔒 Keys stay in your browser</span>
        </div>

        <div className="home-stats">
          {STATS.map((s) => (
            <div key={s.label}>
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="home-preview">
        <div className="preview-card">
          <div className="preview-top">
            <span className="pdot" /><span className="pdot" /><span className="pdot" />
            <span className="ptitle">A2I · chat</span>
          </div>
          <div className="preview-body">
            <div className="pv-row">
              <div className="pv-av u">អ្នក</div>
              <div className="pv-bubble">ពន្យល់ពីរបៀប AI ដំណើរការ ជាភាសាខ្មែរសាមញ្ញ</div>
            </div>
            <div className="pv-row">
              <div className="pv-av a">A2</div>
              <div className="pv-bubble ai">
                AI គឺជាប្រព័ន្ធដែលរៀនពីទិន្នន័យធំៗ ហើយទស្សន៍ទាយចម្លើយបន្ទាប់។ ឧទាហរណ៍៖
                <div className="pv-code">def add(a, b): return a + b</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="features" className="home-section">
        <h2>One app, <span>every AI</span> you need</h2>
        <p className="h2sub">កម្មវិធីតែមួយ ដាក់ AI ទាំងអស់ក្នុងកន្លែងតែមួយ</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="fc-ico">{ICONS[f.icon]}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="home-section">
        <h2>How it <span>works</span></h2>
        <p className="h2sub">ចាប់ផ្ដើមក្នុង ១ នាទី</p>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="snum">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="home-section">
        <h2>Questions? <span>Answers.</span></h2>
        <p className="h2sub">សំណួរញឹកញាប់</p>
        <div className="faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="home-foot">
        <div className="brand"><div className="logo">A2</div> A2I — All-in-One AI</div>
        Built with Next.js + TypeScript · OpenCode Zen · your own device · <a href="/chat">Open the chat</a>
      </footer>
    </div>
  );
}
