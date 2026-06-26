'use client';

import { useEffect } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
        .catch(console.error);
    }
  }, []);
  return null;
}
