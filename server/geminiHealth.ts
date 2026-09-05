import express from 'express';
import { GoogleGenAI } from '@google/genai';

const originalGet = express.application.get;
let patched = false;

async function runGeminiCheck(): Promise<{ status: 'ok' | 'error'; configured: boolean; reachable: boolean; responseReceived?: boolean; error?: string }> {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  if (!configured) {
    return { status: 'error', configured: false, reachable: false, error: 'missing_api_key' };
  }

  try {
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'personal-ai-team-health-check' } },
    });
    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: 'Reply with OK only.',
    });
    const text = typeof result.text === 'string' ? result.text.trim() : '';
    return { status: 'ok', configured: true, reachable: true, responseReceived: Boolean(text) };
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    let category = 'provider_error';
    if (/401|403|api key|permission|unauth/i.test(message)) category = 'authentication';
    else if (/429|quota|rate limit/i.test(message)) category = 'quota';
    else if (/timeout|timed out|econn|network|fetch/i.test(message)) category = 'network';
    return { status: 'error', configured: true, reachable: false, error: category };
  }
}

async function startupGeminiCheck() {
  const result = await runGeminiCheck();
  if (result.status === 'ok') {
    console.log('[Gemini Health] OK - API key configured and Gemini API responded successfully.');
  } else {
    console.error(`[Gemini Health] FAILED - configured=${result.configured} reachable=${result.reachable} error=${result.error}`);
  }
}

if (!patched) {
  patched = true;
  express.application.get = function patchedGet(path: any, ...handlers: any[]) {
    if (path === '/api/health/gemini') {
      return originalGet.call(this, path, async (_req: any, res: any) => {
        const result = await runGeminiCheck();
        return res.status(result.status === 'ok' ? 200 : 503).json(result);
      });
    }
    return originalGet.call(this, path, ...handlers);
  } as any;
}

// Execute a real provider request once during every production process startup.
// This gives Render logs a definitive signal without exposing the API key.
void startupGeminiCheck();

export {};
