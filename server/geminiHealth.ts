import express from 'express';
import { GoogleGenAI } from '@google/genai';

const originalGet = express.application.get;
let patched = false;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

type GeminiHealthResult = {
  status: 'ok' | 'error';
  configured: boolean;
  reachable: boolean;
  model?: string;
  modelAvailable?: boolean;
  responseReceived?: boolean;
  error?: string;
  providerStatus?: number;
};

function classifyGeminiError(error: any): { category: string; providerStatus?: number } {
  const raw = String(error?.message || error || '');
  const status = Number(error?.status ?? error?.response?.status ?? error?.error?.code);
  const message = raw.toLowerCase();

  if (status === 401 || status === 403 || /api key|permission|unauth/i.test(message)) {
    return { category: 'authentication', providerStatus: Number.isFinite(status) ? status : undefined };
  }
  if (status === 429 || /quota|rate limit|resource_exhausted/i.test(message)) {
    return { category: 'quota', providerStatus: Number.isFinite(status) ? status : undefined };
  }
  if (status === 404 || /not found|no longer available|unknown model/i.test(message)) {
    return { category: 'model_unavailable', providerStatus: Number.isFinite(status) ? status : undefined };
  }
  if (status >= 500 || /timeout|timed out|econn|network|fetch|unavailable/i.test(message)) {
    return { category: 'network_or_provider', providerStatus: Number.isFinite(status) ? status : undefined };
  }
  return { category: 'provider_error', providerStatus: Number.isFinite(status) ? status : undefined };
}

async function runGeminiCheck(): Promise<GeminiHealthResult> {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  if (!configured) {
    return { status: 'error', configured: false, reachable: false, model: GEMINI_MODEL, error: 'missing_api_key' };
  }

  try {
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'personal-ai-team-health-check' } },
    });

    // Health checks must not consume generate-content quota. The Models API
    // verifies the API key and model availability without generating tokens.
    const modelInfo = await client.models.get({ model: GEMINI_MODEL });
    const supported = Array.isArray(modelInfo?.supportedGenerationMethods)
      ? modelInfo.supportedGenerationMethods.includes('generateContent')
      : true;

    if (!supported) {
      return {
        status: 'error',
        configured: true,
        reachable: true,
        model: GEMINI_MODEL,
        modelAvailable: true,
        error: 'model_does_not_support_generate_content',
      };
    }

    return {
      status: 'ok',
      configured: true,
      reachable: true,
      model: GEMINI_MODEL,
      modelAvailable: true,
      responseReceived: true,
    };
  } catch (error: any) {
    const classified = classifyGeminiError(error);
    return {
      status: 'error',
      configured: true,
      reachable: false,
      model: GEMINI_MODEL,
      modelAvailable: classified.category !== 'model_unavailable' ? undefined : false,
      error: classified.category,
      providerStatus: classified.providerStatus,
    };
  }
}

async function startupGeminiCheck() {
  const result = await runGeminiCheck();
  if (result.status === 'ok') {
    console.log(`[Gemini Health] OK - API key valid, model=${result.model}, Models API reachable. No generation quota consumed.`);
  } else {
    console.error(`[Gemini Health] FAILED - configured=${result.configured} reachable=${result.reachable} model=${result.model} error=${result.error}${result.providerStatus ? ` providerStatus=${result.providerStatus}` : ''}`);
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

// Verify credentials/model availability at process startup without spending
// the account's generateContent request quota.
void startupGeminiCheck();

export {};
