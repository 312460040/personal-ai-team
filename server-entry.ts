import express from 'express';
import persistenceRouter from './server/persistence';
import { buildPublicRoutingInstruction, classifyPublicRequest } from './server/publicIntake';

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

// Public Area is the Manager's intake desk. We wrap the existing chat route
// instead of replacing the mature Agent/Action-Guard implementation. This
// means scattered requests get classified first, then continue through the
// same safety checks and Agent execution pipeline as normal chats.
const originalPost = express.application.post;
express.application.post = function patchedPost(path: any, ...handlers: any[]) {
  if (path === '/api/agent/chat' && handlers.length) {
    const wrappedHandlers = handlers.map((handler: any) => {
      if (typeof handler !== 'function') return handler;
      return function publicIntakeHandler(this: any, req: any, res: any, next: any) {
        const context = req.body?.context;
        const room = context?.chatRoom;
        if (room?.id === 'room-public' || room?.chatRoomId === 'room-public' || context?.currentContext?.workspaceId === 'public') {
          const result = classifyPublicRequest(req.body?.message || '', context?.workProjects || []);
          req.body.context = {
            ...context,
            publicIntake: {
              category: result.category,
              confidence: result.confidence,
              reason: result.reason,
              projectId: result.projectId,
              routingInstruction: buildPublicRoutingInstruction(result),
            },
            currentContext: {
              workspaceId: result.category === 'work' ? 'work' : result.category === 'study' ? 'study' : 'personal',
              // A work project is only selected when the classifier found a
              // unique literal match. Otherwise the existing Context Boundary
              // remains responsible for asking the Owner rather than guessing.
              projectId: result.category === 'work' ? result.projectId : null,
            },
          };
        }
        return handler.call(this, req, res, next);
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
