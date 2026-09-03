import express from 'express';
import persistenceRouter from './server/persistence';
import { buildPublicRoutingInstruction, classifyPublicRequest } from './server/publicIntake';

// Mount after the legacy server's express.json() middleware so POST bodies are parsed.
// The router remains server-side; Supabase service credentials never reach the browser.
const originalUse = express.application.use;
let useCount = 0;
let mounted = false;
let corsMounted = false;

express.application.use = function patchedUse(...args: any[]) {
  useCount += 1;

  // GitHub Pages and local development are separate origins from Render.
  // Keep the API credentials server-side while allowing the browser to call the API.
  if (!corsMounted) {
    corsMounted = true;
    originalUse.call(this, (req: any, res: any, next: any) => {
      const origin = req.headers.origin as string | undefined;
      const allowedOrigins = new Set([
        'https://312460040.github.io',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_ORIGIN,
      ].filter(Boolean) as string[]);

      if (origin && allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Owner-Id, Authorization');

      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      next();
    });
  }

  if (!mounted && useCount >= 2) {
    mounted = true;
    originalUse.call(this, '/api/persistence', persistenceRouter);
  }
  return originalUse.apply(this, args as any);
};

// Public Area is the Manager's intake desk. We wrap the existing chat route
// instead of replacing the mature Agent/Action-Guard implementation. This
// means scattered requests get classified first, then continue through the
// same safety checks and Agent execution pipeline as normal chats.
const originalPost = express.application.post;
express.application.post = function patchedPost(path: any, ...handlers: any[]) {
  if (path === '/api/agent/chat' && handlers.length) {
    const wrappedHandlers = handlers.map((handler: any) => {
      if (typeof handler !== 'function') return handler;
      return async function publicIntakeHandler(this: any, req: any, res: any, next: any) {
        const context = req.body?.context;
        const room = context?.chatRoom;
        const isPublicRoom =
          room?.id === 'room-public' ||
          room?.chatRoomId === 'room-public' ||
          context?.chatRoomId === 'room-public' ||
          context?.currentContext?.workspaceId === 'public';

        if (!isPublicRoom) {
          return handler.call(this, req, res, next);
        }

        const result = await classifyPublicRequest(req.body?.message || '', context?.workProjects || []);
        const routingInstruction = buildPublicRoutingInstruction(result);

        req.body.context = {
          ...context,
          publicIntake: {
            category: result.category,
            confidence: result.confidence,
            reason: result.reason,
            projectId: result.projectId,
            method: result.method,
            routingInstruction,
          },
          currentContext: {
            workspaceId: result.category === 'work' ? 'work' : result.category === 'study' ? 'study' : 'personal',
            // A work project is only selected when the classifier found a
            // unique literal match. Otherwise the existing Context Boundary
            // remains responsible for asking the Owner rather than guessing.
            projectId: result.category === 'work' ? result.projectId : null,
          },
        };

        // Keep the classifier result in the API response so the frontend can
        // display the Manager's routing decision without needing another LLM call.
        const originalJson = res.json.bind(res);
        res.json = (payload: any) => {
          const routedPayload = { ...payload, publicIntake: req.body.context.publicIntake };
          if (typeof routedPayload.finalSynthesisMarkdown === 'string') {
            const label = result.category === 'work' ? '工作' : result.category === 'study' ? '課業／研究' : '個人規劃';
            const projectNote = result.projectId
              ? `\n- 專案：已安全匹配既有專案（${result.projectId}）`
              : result.category === 'work'
                ? '\n- 專案：尚未指定，Manager 不會自行猜測專案'
                : '';
            routedPayload.finalSynthesisMarkdown =
              `### 🧭 Manager 分流\n- 類別：**${label}**\n- 信心：**${result.confidence}**\n- 判斷方式：**${result.method === 'ai' ? 'AI 語意理解' : '規則備援'}**\n- 判斷：${result.reason}${projectNote}\n\n` +
              routedPayload.finalSynthesisMarkdown;
          }
          return originalJson(routedPayload);
        };

        try {
          return await handler.call(this, req, res, next);
        } catch (error) {
          return next(error);
        }
      };
    });
    return originalPost.call(this, path, ...wrappedHandlers);
  }
  return originalPost.call(this, path, ...handlers);
};

import('./server.ts').catch(error => {
  console.error('Failed to start Personal AI Team server:', error);
  process.exitCode = 1;
});
