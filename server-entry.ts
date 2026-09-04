import express from 'express';
import persistenceRouter from './server/persistence';
import calendarRouter from './server/calendar';
import directAgentRouter from './server/directAgentChat';
import scheduleExecutionRouter from './server/scheduleExecution';
import { routeManagerRequest } from './server/agentTeam';
import { buildPublicRoutingInstruction, classifyPublicRequest } from './server/publicIntake';
import { buildGlobalTaskReview } from './server/globalTaskReview';
import { buildDailyReview, buildTomorrowPlan } from './server/dailyReview';
import { extractMentalTasks, formatMentalTaskSummary } from './server/mentalTaskIntake';

const originalUse = express.application.use;
let useCount = 0;
let mounted = false;
let corsMounted = false;
const DOMAIN_LABELS: Record<string, string> = { work: '工作', study: '課業／研究', personal: '個人規劃', global: '全域任務管理' };

express.application.use = function patchedUse(...args: any[]) {
  useCount += 1;
  if (!corsMounted) {
    corsMounted = true;
    originalUse.call(this, (req: any, res: any, next: any) => {
      const origin = req.headers.origin as string | undefined;
      const allowedOrigins = new Set(['https://312460040.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_ORIGIN].filter(Boolean) as string[]);
      if (origin && allowedOrigins.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Owner-Id, X-Owner-Confirmed, Authorization');
      if (req.method === 'OPTIONS') return res.status(204).end();
      next();
    });
  }
  if (!mounted && useCount >= 2) {
    mounted = true;
    originalUse.call(this, '/api/persistence', persistenceRouter);
    originalUse.call(this, '/api/calendar', calendarRouter);
    originalUse.call(this, '/api/agent/direct', directAgentRouter);
    originalUse.call(this, '/api/agent/execute-schedule', scheduleExecutionRouter);
    originalUse.call(this, '/api/agent/team', express.Router().post('/route', (req: any, res: any) => {
      const message = String(req.body?.message || '').trim();
      if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
      return res.json(routeManagerRequest(message));
    }));
  }
  return originalUse.apply(this, args as any);
};

const originalPost = express.application.post;

function isTaskArrangementRequest(message: string) {
  return /(?:幫我|請幫我|請|麻煩)?(?:安排|排定|排進|建立|新增|記下|加入|規劃).{0,40}(?:任務|待辦|工作|課業|事情|這些)/i.test(message) || /(?:這些|上面|剛才).{0,20}(?:建立|新增|安排|排定|排進|加入).{0,20}(?:任務|待辦|工作|課業)?/i.test(message);
}

function isScheduleExecutionRequest(message: string) {
  return /(?:幫我|請幫我|請|麻煩)?(?:安排|排定|規劃|排程|分配).{0,50}(?:今天|明天|明日|時間|行程|工作|課業|事情|時段)/i.test(message) || /(?:今天|明天|明日).{0,30}(?:怎麼排|幫我排|安排一下|排程|時間規劃)/i.test(message);
}

function buildMentalTaskPayloads(mentalTasks: any[], message: string, context: any) {
  const now = new Date();
  const userProjects = Array.isArray(context?.workProjects) ? context.workProjects.filter((p: any) => p?.source === 'user') : [];
  const userSubjects = Array.isArray(context?.studySubjects) ? context.studySubjects.filter((s: any) => s?.source === 'user') : [];
  const requestedDeadline = /明天/i.test(message) ? new Date(now.getTime() + 86400000) : null;
  const dateMatch = message.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  let deadlineBase = requestedDeadline || now;
  if (dateMatch) { const [y, m, d] = dateMatch[1].replace(/\//g, '-').split('-').map(Number); deadlineBase = new Date(y, m - 1, d, 18, 0, 0); }
  const deadline = deadlineBase.toISOString().replace(/\.000Z$/, '');
  const workProjectId = context?.publicIntake?.projectId || null;
  const matchedProject = workProjectId ? userProjects.find((p: any) => p.id === workProjectId) : userProjects.length === 1 ? userProjects[0] : null;
  const createdWorkTasks: any[] = [], createdStudyTasks: any[] = [], blocked: any[] = [];
  mentalTasks.forEach((task: any, index: number) => {
    const title = String(task.title || '').trim(); if (!title) return;
    const priority = /(?:高優先|緊急|最優先)/i.test(message) ? 'high' : /(?:低優先|次要)/i.test(message) ? 'low' : 'medium';
    const common = { title, status: 'todo', priority, estimatedHours: 1, startDate: now.toISOString().slice(0, 10), deadline, assignee: '本人', notes: `由 Owner 透過 Manager 對話建立。原始指令：「${message.trim()}」`, tags: ['AI-Manager-Created', 'User-Created'], isUrgent: priority === 'high', source: 'user', createdBy: 'user' };
    if (task.category === 'work') {
      if (!matchedProject) { blocked.push({ title, category: 'work', reason: '目前無法安全唯一匹配工作專案；Manager 不猜測 Project。' }); return; }
      createdWorkTasks.push({ id: `w-task-user-${now.getTime()}-${index}`, workspaceId: matchedProject.workspaceId || 'work', projectId: matchedProject.id, projectName: matchedProject.title, ...common });
    } else if (task.category === 'study') {
      if (userSubjects.length !== 1) { blocked.push({ title, category: 'study', reason: userSubjects.length === 0 ? '尚未建立 User Study Subject；需要先指定科目。' : '目前有多個 User Study Subject；需要指定科目後才能安全建立。' }); return; }
      const subject = userSubjects[0]; createdStudyTasks.push({ id: `s-task-user-${now.getTime()}-${index}`, subjectId: subject.id, subjectName: subject.name, type: 'study_task', progress: 0, ...common });
    }
  });
  return { createdWorkTasks, createdStudyTasks, blocked };
}

express.application.post = function patchedPost(path: any, ...handlers: any[]) {
  if (path === '/api/agent/chat' && handlers.length) {
    const wrappedHandlers = handlers.map((handler: any) => {
      if (typeof handler !== 'function') return handler;
      return async function publicIntakeHandler(this: any, req: any, res: any, next: any) {
        const context = req.body?.context;
        const room = context?.chatRoom;
        const isPublicRoom = room?.id === 'room-public' || room?.chatRoomId === 'room-public' || context?.chatRoomId === 'room-public' || context?.currentContext?.workspaceId === 'public';
        if (!isPublicRoom) return handler.call(this, req, res, next);
        const message = String(req.body?.message || '');
        const result = await classifyPublicRequest(message, context?.workProjects || []);
        const routingInstruction = buildPublicRoutingInstruction(result);
        const mentalTasks = result.mode === 'normal' ? await extractMentalTasks(message) : [];
        const mentalTaskSummary = formatMentalTaskSummary(mentalTasks);
        const arrangingTasks = mentalTasks.length > 0 && isTaskArrangementRequest(message);
        req.body.context = { ...context, publicIntake: { ...result, routingInstruction, mentalTasks }, currentContext: { workspaceId: result.category === 'work' ? 'work' : result.category === 'study' ? 'study' : result.category === 'global' ? 'global' : 'personal', projectId: result.category === 'work' ? result.projectId : null } };
        const originalJson = res.json.bind(res);
        res.json = (payload: any) => {
          const routedPayload = { ...payload, publicIntake: req.body.context.publicIntake };
          if (typeof routedPayload.finalSynthesisMarkdown === 'string') {
            const label = DOMAIN_LABELS[result.category];
            const projectNote = result.projectId ? `\n- 專案：已安全匹配既有專案（${result.projectId}）` : result.category === 'work' ? '\n- 專案：尚未指定，Manager 不會自行猜測' : '';
            const intakeNote = !arrangingTasks && mentalTaskSummary ? `${mentalTaskSummary}\n\n` : '';
            routedPayload.finalSynthesisMarkdown = `### 🧭 Manager 分流\n- 類別：**${label}**\n- 模式：**${result.mode}**\n- 信心：**${result.confidence}**\n- 判斷方式：**${result.method === 'ai' ? 'AI 語意理解' : '規則備援'}**\n- 判斷：${result.reason}${projectNote}\n\n${intakeNote}` + routedPayload.finalSynthesisMarkdown;
          }
          return originalJson(routedPayload);
        };
        if (result.category === 'global') {
          const report = result.mode === 'daily_review' ? buildDailyReview(context) : result.mode === 'tomorrow_plan' ? buildTomorrowPlan(context) : buildGlobalTaskReview(context);
          const executableSchedule = isScheduleExecutionRequest(message) && result.mode === 'tomorrow_plan' ? true : isScheduleExecutionRequest(message);
          if (executableSchedule) {
            return res.json({ intentType: 'HYBRID', delegatedAgents: ['work', 'study'], activityLogs: [{ id: `act-schedule-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: 'Manager 執行時間規劃', summary: '讀取 User Tasks → 依優先級／Deadline／工時建立可執行排程', detail: '這不是建議清單；排程會直接寫入 Today 工作區。', status: 'completed', durationMs: 0 }], workOutput: report, studyOutput: '', finalSynthesisMarkdown: `### ✅ Manager 已執行時間規劃\n\n我會直接替你安排，不再要求你手動「套用」。\n\n${report}`, proposedTimeBlocks: [], createdTaskPayload: null, durationTotalMs: 0, publicIntake: req.body.context.publicIntake, executeSchedule: true });
          }
          return res.json({ intentType: result.mode === 'daily_review' ? 'DAILY_REVIEW' : result.mode === 'tomorrow_plan' ? 'TOMORROW_PLAN' : 'GLOBAL_TASK_REVIEW', delegatedAgents: ['work', 'study'], activityLogs: [{ id: `act-manager-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: modeLabel, summary: '跨工作與課業整理 User Tasks', detail: 'Manager-level 唯讀分析。', status: 'completed', durationMs: 0 }], workOutput: report, studyOutput: '', finalSynthesisMarkdown: report, proposedTimeBlocks: [], createdTaskPayload: null, durationTotalMs: 0, publicIntake: req.body.context.publicIntake });
        }
        if (arrangingTasks) {
          const payloads = buildMentalTaskPayloads(mentalTasks, message, context); const totalCreated = payloads.createdWorkTasks.length + payloads.createdStudyTasks.length;
          const grouped = [payloads.createdWorkTasks.length ? `#### 💼 工作\n${payloads.createdWorkTasks.map((t: any) => `- **${t.title}**｜${t.projectName}｜${t.priority}｜截止 ${t.deadline}`).join('\n')}` : '', payloads.createdStudyTasks.length ? `#### 🎓 課業／研究\n${payloads.createdStudyTasks.map((t: any) => `- **${t.title}**｜${t.subjectName}｜${t.priority}｜截止 ${t.deadline}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
          const blockedText = payloads.blocked.length ? `\n\n### ⚠️ 尚未建立（需要你補充）\n${payloads.blocked.map((x: any) => `- **${x.title}**｜${x.category === 'work' ? '工作' : '課業／研究'}：${x.reason}`).join('\n')}` : '';
          const marker = `<!--AIT_TASK_BATCH:${JSON.stringify({ work: payloads.createdWorkTasks, study: payloads.createdStudyTasks })}-->`;
          return res.json({ intentType: 'MENTAL_TASK_INTAKE', delegatedAgents: [...new Set(mentalTasks.map((t: any) => t.category).filter((c: any) => c === 'work' || c === 'study'))], activityLogs: [{ id: `act-task-intake-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: '拆分新任務並分類後建立', summary: `Manager 建立 ${totalCreated} 筆 User Task`, detail: '依自然語言拆分為工作／課業。', status: 'completed', durationMs: 0 }], workOutput: payloads.createdWorkTasks.map((t: any) => t.title).join('\n'), studyOutput: payloads.createdStudyTasks.map((t: any) => t.title).join('\n'), finalSynthesisMarkdown: `### 📋 Manager 已安排新任務\n\n${grouped || '目前沒有可安全建立的任務。'}${blockedText}\n\n- 已建立：**${totalCreated}** 筆 User Task\n\n${marker}`, proposedTimeBlocks: [], createdWorkTasks: payloads.createdWorkTasks, createdStudyTasks: payloads.createdStudyTasks, createdTaskPayload: null, durationTotalMs: 0, publicIntake: req.body.context.publicIntake });
        }
        if (mentalTasks.length) {
          const categories = [...new Set(mentalTasks.map((task: any) => task.category))]; const delegated = categories.filter((category: any) => category === 'work' || category === 'study');
          return res.json({ intentType: 'MENTAL_TASK_INTAKE', delegatedAgents: delegated, activityLogs: [{ id: `act-mental-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: '心中任務收件匣：先拆解並分類，尚未建立正式 Task', summary: `辨識 ${mentalTasks.length} 個 Owner 明確提到的任務`, detail: '只使用本次訊息；不自動建立正式 Task。', status: 'completed', durationMs: 0 }], workOutput: mentalTasks.filter((task: any) => task.category === 'work').map((task: any) => task.title).join('\n'), studyOutput: mentalTasks.filter((task: any) => task.category === 'study').map((task: any) => task.title).join('\n'), finalSynthesisMarkdown: `${mentalTaskSummary}\n\n### 📌 下一步\n你可以直接告訴 Manager：「把這些建立成正式任務」或「幫我安排明天時間」。`, proposedTimeBlocks: [], createdTaskPayload: null, durationTotalMs: 0, publicIntake: req.body.context.publicIntake });
        }
        return handler.call(this, req, res, next);
      };
    });
    return originalPost.call(this, path, ...wrappedHandlers);
  }
  return originalPost.call(this, path, ...handlers);
};

import('./server.ts').catch(error => { console.error('Failed to start Personal AI Team server:', error); process.exitCode = 1; });
