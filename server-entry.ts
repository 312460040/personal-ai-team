import express from 'express';
import persistenceRouter from './server/persistence';

// Keep the legacy server.ts entry point intact while injecting the persistence API
// into the same Express app. This makes the database layer available in local/server builds
// without exposing Supabase credentials to the browser.
const originalUse = express.application.use;
let mounted = false;

express.application.use = function patchedUse(...args: any[]) {
  if (!mounted) {
    mounted = true;
    originalUse.call(this, '/api/persistence', persistenceRouter);
  }
  return originalUse.apply(this, args as any);
};

await import('./server.ts');
