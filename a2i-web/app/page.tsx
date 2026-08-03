'use client';

import Link from 'next/link';
import { useLang, T, toggleLang } from './lib/i18n';

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

export default function HomePage() {
  const lang = useLang();
  const t = (k: string) => T(k);
  const toggle = () => toggleLang();

  return (
    <div className="home-root">
      <div className="home-hero-bg" aria-hidden="true" />

      <nav className="home-nav">
        <div className="brand">
          <div className="logo">A2</div>
          A2I
        </div>
        <div className="spacer" />
        <a className="link" href="#features">{t('hpFeaturesH')}</a>
        <a className="link" href="#how">{t('hpNavHow')}</a>
        <a className="link" href="#faq">{t('hpNavFaq')}</a>
        <a className="link" href="/live">{t('hpNavLive')}</a>
        <button className="link" type="button" onClick={toggle}>{lang === 'km' ? 'EN' : 'ខ្មែរ'}</button>
        <Link className="link cta" href="/chat">{t('hpNavChat')} →</Link>
      </nav>

      <header className="home-hero">
        <div className="home-badge"><span className="dot" /> {t('hpBadge')}</div>
        <h1>{t('hpTitle1')} <em>{t('hpTitle2')}</em></h1>
        <p className="sub">{t('hpSub')}</p>
        <div className="home-cta">
          <Link className="btn-lg primary" href="/chat">{t('hpCta')}</Link>
          <a className="btn-lg" href="/live">{t('hpCta2')}</a>
        </div>
        <div className="home-chips">
          <span>⚡ {t('hpChip1')}</span>
          <span>🔒 {t('hpChip2')}</span>
          <span>💳 {t('hpChip3')}</span>
          <span>📱 {t('hpChip4')}</span>
        </div>

        <div className="home-stats">
          <div><b>60+</b><span>{t('hpStatModels')}</span></div>
          <div><b>100%</b><span>{t('hpStatFree')}</span></div>
          <div><b>&lt;3</b><span>{t('hpStatSeconds')}</span></div>
          <div><b>∞</b><span>{t('hpStatLocal')}</span></div>
        </div>
      </header>

      <div className="home-preview">
        <div className="preview-card">
          <div className="preview-top">
            <span className="pdot" /><span className="pdot" /><span className="pdot" />
            <span className="ptitle">{t('hpPreviewTitle')}</span>
          </div>
          <div className="preview-body">
            <div className="pv-row">
              <div className="pv-av u">{t('hpPreviewYou')}</div>
              <div className="pv-bubble">{t('hpPreview1u')}</div>
            </div>
            <div className="pv-row">
              <div className="pv-av a">A2</div>
              <div className="pv-bubble ai">
                {t('hpPreview1a')}
                <div className="pv-code">def add(a, b): return a + b</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="features" className="home-section">
        <h2>{t('hpFeaturesH')}</h2>
        <p className="h2sub">{t('hpFeaturesSub')}</p>
        <div className="feature-grid">
          <div className="feature-card"><div className="fc-ico">{ICONS.bolt}</div><h3>{t('hpF1t')}</h3><p>{t('hpF1s')}</p></div>
          <div className="feature-card"><div className="fc-ico">{ICONS.mic}</div><h3>{t('hpF2t')}</h3><p>{t('hpF2s')}</p></div>
          <div className="feature-card"><div className="fc-ico">{ICONS.globe}</div><h3>{t('hpF3t')}</h3><p>{t('hpF3s')}</p></div>
          <div className="feature-card"><div className="fc-ico">{ICONS.image}</div><h3>{t('hpF4t')}</h3><p>{t('hpF4s')}</p></div>
          <div className="feature-card"><div className="fc-ico">{ICONS.chip}</div><h3>{t('hpF5t')}</h3><p>{t('hpF5s')}</p></div>
          <div className="feature-card"><div className="fc-ico">{ICONS.sparkle}</div><h3>{t('hpF6t')}</h3><p>{t('hpF6s')}</p></div>
        </div>
      </section>

      <section id="how" className="home-section">
        <h2>{t('hpStepsH')}</h2>
        <p className="h2sub">{t('hpStepsSub')}</p>
        <div className="steps">
          <div className="step"><div className="snum">1</div><h3>{t('hpS1t')}</h3><p>{t('hpS1s')}</p></div>
          <div className="step"><div className="snum">2</div><h3>{t('hpS2t')}</h3><p>{t('hpS2s')}</p></div>
          <div className="step"><div className="snum">3</div><h3>{t('hpS3t')}</h3><p>{t('hpS3s')}</p></div>
        </div>
      </section>

      <section id="faq" className="home-section">
        <h2>{t('hpFaqH')}</h2>
        <div className="faq">
          {[1, 2, 3, 4].map((n) => (
            <details key={n}>
              <summary>{t('hpFaq' + n + 'q')}</summary>
              <p>{t('hpFaq' + n + 'a')}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="home-foot">
        <div className="brand"><div className="logo">A2</div> A2I — All-in-One AI</div>
        {t('hpFootNote')} · <Link href="/chat">{t('hpNavChat')}</Link>
      </footer>
    </div>
  );
}
