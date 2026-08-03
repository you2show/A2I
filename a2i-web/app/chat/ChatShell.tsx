'use client';

import { useEffect, useRef } from 'react';
import { initApp } from './chat-core';

export default function ChatShell() {
  const hostRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const host = hostRef.current;
    if (!host) return;
    fetch('/chat-shell.html')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('shell ' + r.status))))
      .then((html) => {
        host.innerHTML = html;
        try {
          initApp();
        } catch (err) {
          console.error('A2I init failed:', err);
        }
      })
      .catch((err) => {
        console.error('A2I shell load failed:', err);
      });
  }, []);

  return <div ref={hostRef} id="a2i-root" />;
}
