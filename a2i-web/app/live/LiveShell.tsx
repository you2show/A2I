'use client';

import { useEffect, useRef } from 'react';
import { initLive } from './live-core';

export default function LiveShell() {
  const hostRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const host = hostRef.current;
    if (!host) return;
    fetch('/live-shell.html')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('shell ' + r.status))))
      .then((html) => {
        host.innerHTML = html;
        // Spline viewer is a <script type="module"> in the original page;
        // scripts injected via innerHTML do not execute, so load it manually.
        const s = document.createElement('script');
        s.type = 'module';
        s.src = 'https://unpkg.com/@splinetool/viewer@1/build/spline-viewer.js';
        s.onerror = () => host.classList.add('spline-failed');
        document.head.appendChild(s);
        try {
          initLive();
        } catch (err) {
          console.error('A2I Live init failed:', err);
        }
      })
      .catch((err) => {
        console.error('A2I Live shell load failed:', err);
      });
  }, []);

  return <div ref={hostRef} className="live-shell" />;
}
