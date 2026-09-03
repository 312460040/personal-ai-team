import express from 'express';
import persistenceRouter from './server/persistence';

// Mount after the legacy server's express.json() middleware so POST bodies are parsed.
// The router remains server-side; Supabase service credentials never reach the browser.
const originalUse = express.application.use;
let useCount = 0;
let mounted = false;

express.application.use = function patchedUse(...args: any[]) {
  useCount += 1;
  if (!mounted && useCount >= 2) {
    mounted = true;
    originalUse.call(this, '/api/persistence', persistenceRouter);
  }
  return originalUse.apply(this, args as any);
};

await import('./server.ts');
