import Link from 'next/link';

const FEATURES = [
  {
    ico: '⚡',
    title: 'Free frontier models',
    text: 'Big Pickle, DeepSeek V4 Flash Free & more via OpenCode Zen — no credit card, free tier every day. Keys stay in your browser.',
  },
  {
    ico: '🧠',
    title: 'AI that runs on your device',
    text: 'Load a GGUF model straight from your SSD or run GPU inference with WebLLM — private, offline-capable, and no API needed.',
  },
  {
    ico: '✨',
    title: 'Gemini with your key',
    text: 'Paste your free Gemini API key and chat with Gemini 2.x models — sent directly to Google, stored only in your browser.',
  },
  {
    ico: '🌐',
    title: 'Web search & RAG',
    text: 'Wikipedia (Khmer + English), arXiv, Hacker News and your own knowledge files — answers grounded in real sources.',
  },
  {
    ico: '🎨',
    title: 'Image & audio generation',
    text: 'Generate images (Pollinations) and spoken audio from your answers right in the chat — all free, no key.',
  },
  {
    ico: '🗣️',
    title: '3D voice assistant',
    text: 'Talk to A2I Live: speech recognition, a futuristic 3D robot, and a real-time audio visualizer. Khmer & English.',
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
      <nav className="home-nav">
        <div className="brand">
          <div className="logo">A2</div>
          A2I
        </div>
        <div className="spacer" />
        <a className="link" href="#features">Features</a>
        <a className="link" href="#how">How it works</a>
        <a className="link" href="#faq">FAQ</a>
        <Link className="link" href="/chat">Open Chat →</Link>
      </nav>

      <header className="home-hero">
        <div className="home-badge"><span className="dot" /> 100% free · no card · គ្មានថ្លៃ</div>
        <h1>All your AI brains, <em>one chat</em>.</h1>
        <p className="sub">
          A2I brings free frontier models, your own Gemini key, on-device GGUF models,
          web search, image & audio generation and a 3D voice assistant into a single,
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
      </header>

      <div className="home-preview">
        <div className="preview-card">
          <div className="preview-top"><span className="pdot" /><span className="pdot" /><span className="pdot" />A2I · chat</div>
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
              <div className="fc-ico">{f.ico}</div>
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
          <div className="step">
            <div className="snum">1</div>
            <h3>Open the chat</h3>
            <p>No sign-up, no download. Open the app and start typing — it works in any browser, even on your phone.</p>
          </div>
          <div className="step">
            <div className="snum">2</div>
            <h3>Pick your brain</h3>
            <p>Choose OpenCode Zen (free, instant) or Gemini — or run a model on your own device. Switch anytime.</p>
          </div>
          <div className="step">
            <div className="snum">3</div>
            <h3>Ask anything</h3>
            <p>Chat with streaming answers, thinking blocks, code copy, web search, images, audio and voice.</p>
          </div>
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
