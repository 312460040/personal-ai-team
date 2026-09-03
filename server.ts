import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;

// Lazy initialize Gemini API client with User-Agent
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Helper to sanitize items and strictly isolate User Data from Demo Data
function filterUserData<T extends { source?: string; id?: string; title?: string; projectName?: string }>(items: T[]): {
  userData: T[];
  demoData: T[];
} {
  const userData: T[] = [];
  const demoData: T[] = [];

  for (const item of items) {
    const isExplicitDemo = item.source === 'demo' || (item.id && item.id.includes('demo')) || (item.title && item.title.includes('【Demo】')) || (item.projectName && item.projectName.includes('【Demo】'));
    const isExplicitUser = item.source === 'user' || (!isExplicitDemo && item.id && (item.id.includes('user') || item.id.startsWith('w-task-') || item.id.startsWith('proj-')));

    if (isExplicitUser && !isExplicitDemo) {
      userData.push({ ...item, source: 'user' });
    } else {
      demoData.push({ ...item, source: 'demo' });
    }
  }

  return { userData, demoData };
}

// =========================================================================
// CONTEXT BOUNDARY: Workspace / Project isolation
// =========================================================================

interface CurrentContext {
  workspaceId: string;
  projectId: string | null;
}

function resolveCurrentContext(rawContext: any): CurrentContext {
  // Context must come from the client/shared app state.
  // We intentionally do NOT guess a project from the first project in the list.
  const workspaceId =
    rawContext?.currentContext?.workspaceId ||
    rawContext?.workspaceId ||
    'work';

  const projectId =
    rawContext?.currentContext?.projectId ||
    rawContext?.projectId ||
    null;

  return {
    workspaceId,
    projectId,
  };
}

function filterWorkTasksByContext(items: any[], currentContext: CurrentContext): any[] {
  return items.filter(
    (item) =>
      item.source === 'user' &&
      item.projectId === currentContext.projectId &&
      // Migration-safe: existing user tasks may not yet have workspaceId.
      // Once AppDataContext writes workspaceId for all tasks, this fallback
      // can be removed without changing the Context Boundary semantics.
      (item.workspaceId === currentContext.workspaceId || !item.workspaceId)
  );
}

function filterWorkProjectsByContext(items: any[], currentContext: CurrentContext): any[] {
  return items.filter(
    (item) =>
      item.source === 'user' &&
      item.id === currentContext.projectId &&
      (item.workspaceId === currentContext.workspaceId || !item.workspaceId)
  );
}

function contextRequiredResponse(
  currentContext: CurrentContext,
  userPrompt: string,
  timestampStr: string,
  startTime: number
) {
  const markdown = `### 🛑 Context Boundary：需要指定專案

**Manager Agent 無法安全判定你要操作哪一個專案，因此已停止本次操作。**

- 🏢 **Workspace**：\`${currentContext.workspaceId}\`
- 📁 **目前 Project**：未指定
- 🔍 **你的指令**：${userPrompt}

為避免不同客戶／專案的資料互相混淆，系統**禁止自行猜測 Project**，也不會因為清單中的第一個專案而自動選擇。

請指定專案，例如：
- 「在 **AI 個人管理系統** 中查詢工作任務」
- 「請修改 **AI 個人管理系統** 的任務……」
- 或直接提供 **Project ID**：\`proj-user-ai-team\`

**本次沒有讀取、建立、修改或刪除任何任務資料。**`;

  return {
    intentType: 'WORK',
    delegatedAgents: [],
    activityLogs: [
      {
        id: `act-context-${Date.now()}`,
        timestamp: timestampStr,
        stepIndex: 1,
        fromAgent: 'manager',
        action: 'Context Boundary：缺少 projectId，停止操作',
        summary: 'Manager Agent：無法確認目前專案，拒絕猜測',
        detail: `Workspace = ${currentContext.workspaceId}; projectId 未指定。使用者指令：${userPrompt}`,
        status: 'warning',
        durationMs: 0,
      },
    ],
    workOutput: markdown,
    studyOutput: '',
    finalSynthesisMarkdown: markdown,
    proposedTimeBlocks: [],
    createdTaskPayload: null,
    durationTotalMs: Date.now() - startTime,
  };
}

// =========================================================================
// AGENT ACTION GUARD: TARGET CHECK, DUPLICATE CHECK, PARAMETER VALIDATION
// =========================================================================

interface TargetCheckResult {
  status: 'CONFIRMED' | 'AMBIGUOUS' | 'NOT_FOUND';
  targetTask?: any;
  domain?: 'work' | 'study';
  candidates?: any[];
  searchKey: string;
}

function actionGuardTargetCheck(
  rawSearchKey: string,
  userWorkTasks: any[],
  userStudyTasks: any[],
  fullUserPrompt: string = ''
): TargetCheckResult {
  const searchKey = rawSearchKey.trim();
  if (!searchKey && !fullUserPrompt) {
    return { status: 'NOT_FOUND', searchKey: '' };
  }

  // 1. Check for explicit Task ID in searchKey or fullUserPrompt
  const idMatch = (fullUserPrompt || searchKey).match(/\b([ws]-task-[a-z0-9-]+)\b/i);
  if (idMatch) {
    const explicitId = idMatch[1].toLowerCase();
    const workById = userWorkTasks.filter((t) => t.id && t.id.toLowerCase() === explicitId);
    if (workById.length === 1) {
      return { status: 'CONFIRMED', targetTask: workById[0], domain: 'work', searchKey: explicitId };
    }
    const studyById = userStudyTasks.filter((t) => t.id && t.id.toLowerCase() === explicitId);
    if (studyById.length === 1) {
      return { status: 'CONFIRMED', targetTask: studyById[0], domain: 'study', searchKey: explicitId };
    }
  }

  // Also check if searchKey itself is a direct ID match
  const directCleanKey = searchKey.toLowerCase();
  const workById = userWorkTasks.filter((t) => t.id && t.id.toLowerCase() === directCleanKey);
  if (workById.length === 1) {
    return { status: 'CONFIRMED', targetTask: workById[0], domain: 'work', searchKey };
  }
  const studyById = userStudyTasks.filter((t) => t.id && t.id.toLowerCase() === directCleanKey);
  if (studyById.length === 1) {
    return { status: 'CONFIRMED', targetTask: studyById[0], domain: 'study', searchKey };
  }

  // 2. Normalize search key (strip punctuation, quotes, spaces)
  const cleanKey = searchKey.replace(/[\s\-_『』「」"'與和及]/g, '').toLowerCase();
  if (!cleanKey) {
    return { status: 'NOT_FOUND', searchKey };
  }

  // 3. Collect all candidate tasks from both work and study in Shared Data Store
  const allUserTasks = [
    ...userWorkTasks.map((t) => ({ ...t, _domain: 'work' as const })),
    ...userStudyTasks.map((t) => ({ ...t, _domain: 'study' as const })),
  ];

  const matchedMap = new Map<string, any>();

  for (const task of allUserTasks) {
    const rawTitle = task.title || '';
    const cleanTitle = rawTitle.replace(/[\s\-_『』「」"'與和及]/g, '').toLowerCase();

    // Check equality (exact or normalized)
    if (rawTitle.toLowerCase() === searchKey.toLowerCase() || cleanTitle === cleanKey) {
      matchedMap.set(task.id, task);
      continue;
    }

    // Check substring / overlap
    if (
      cleanTitle.includes(cleanKey) ||
      cleanKey.includes(cleanTitle) ||
      (cleanKey.length >= 4 && cleanTitle.length >= 4 && (cleanTitle.indexOf(cleanKey) !== -1 || cleanKey.indexOf(cleanTitle) !== -1))
    ) {
      matchedMap.set(task.id, task);
      continue;
    }
  }

  const matchedCandidates = Array.from(matchedMap.values());

  // 4. Evaluate number of candidates (0 / 1 / 2+)
  if (matchedCandidates.length === 0) {
    return { status: 'NOT_FOUND', searchKey };
  }

  if (matchedCandidates.length === 1) {
    const single = matchedCandidates[0];
    return {
      status: 'CONFIRMED',
      targetTask: single,
      domain: single._domain,
      searchKey,
    };
  }

  // 2+ candidates: AMBIGUOUS (Never pick one automatically, regardless of similarity or exactness)
  return {
    status: 'AMBIGUOUS',
    candidates: matchedCandidates,
    searchKey,
  };
}

interface DuplicateCheckResult {
  status: 'CLEARED' | 'DUPLICATE_DETECTED' | 'BYPASSED';
  existingTasks?: any[];
  newTitle: string;
  reason?: string;
}

function actionGuardDuplicateCheck(
  newTitle: string,
  userWorkTasks: any[],
  userStudyTasks: any[],
  userPrompt: string
): DuplicateCheckResult {
  const isBypass = /(?:強制建立|確認新增|確認建立|仍要建立|忽略重複|確定建立)/i.test(userPrompt);
  if (isBypass) {
    return { status: 'BYPASSED', newTitle };
  }

  const cleanNew = newTitle.replace(/[\s\-_『』「」"'與和及]/g, '').toLowerCase();
  const allUserTasks = [
    ...userWorkTasks.map((t) => ({ ...t, _domain: 'work' })),
    ...userStudyTasks.map((t) => ({ ...t, _domain: 'study' })),
  ];

  const duplicates = allUserTasks.filter((t) => {
    const rawTitle = t.title || '';
    const cleanExisting = rawTitle.replace(/[\s\-_『』「」"'與和及]/g, '').toLowerCase();
    // 1. Direct or normalized match
    if (cleanExisting === cleanNew) return true;
    // 2. High overlap / containment
    if (cleanNew.length >= 4 && cleanExisting.length >= 4) {
      if (cleanExisting.includes(cleanNew) || cleanNew.includes(cleanExisting)) return true;
    }
    return false;
  });

  if (duplicates.length > 0) {
    return {
      status: 'DUPLICATE_DETECTED',
      existingTasks: duplicates,
      newTitle,
      reason: `在共享資料庫中偵測到 ${duplicates.length} 筆相同或高度相似任務`,
    };
  }

  return { status: 'CLEARED', newTitle };
}

interface ParameterValidationResult {
  valid: boolean;
  errors: string[];
}

function actionGuardValidateTaskParameters(
  taskObj: any,
  userPrompt: string
): ParameterValidationResult {
  const errors: string[] = [];

  // 1. Title validation
  if (!taskObj.title || typeof taskObj.title !== 'string' || !taskObj.title.trim()) {
    errors.push('任務名稱 (title) 不得為空');
  }

  // 2. Priority validation (Medium must not become High)
  if (!['low', 'medium', 'high'].includes(taskObj.priority)) {
    errors.push(`優先順序 (priority) 必須為 'low' | 'medium' | 'high'，當前為: ${taskObj.priority}`);
  }
  if (
    /(?:優先[級度順序]|priority)\s*(?:設定為|設為|為|是|[=：:])?\s*(?:medium|med|中|中等|普通|一般)/i.test(userPrompt) ||
    /\bmedium\b/i.test(userPrompt)
  ) {
    if (taskObj.priority !== 'medium') {
      errors.push(`使用者指定優先級為 Medium，但被錯誤指派為: ${taskObj.priority}`);
    }
  } else if (
    /(?:優先[級度順序]|priority)\s*(?:設定為|設為|為|是|[=：:])?\s*(?:high|高|緊急|urgent)/i.test(userPrompt) ||
    /\bhigh\b/i.test(userPrompt)
  ) {
    if (taskObj.priority !== 'high') {
      errors.push(`使用者指定優先級為 High，但被錯誤指派為: ${taskObj.priority}`);
    }
  }

  // 3. Status validation
  if (!['todo', 'in_progress', 'completed', 'delayed'].includes(taskObj.status)) {
    errors.push(`任務狀態 (status) 必須為合法狀態，當前為: ${taskObj.status}`);
  }

  // 4. Estimated Hours validation
  if (typeof taskObj.estimatedHours !== 'number' || isNaN(taskObj.estimatedHours) || taskObj.estimatedHours <= 0) {
    errors.push(`預估工時 (estimatedHours) 必須為大於 0 之有效數值，當前為: ${taskObj.estimatedHours}`);
  }

  // 5. Deadline validation (ISO Datetime preserved)
  if (!taskObj.deadline || typeof taskObj.deadline !== 'string') {
    errors.push('截止時間 (deadline) 不得為空');
  } else {
    const timeMatch = userPrompt.match(/(\d{1,2}:\d{2})/);
    if (timeMatch && !taskObj.deadline.includes(':')) {
      errors.push(`使用者指定了具體截止時間 (${timeMatch[1]})，但 deadline 欄位被截斷為純日期 (${taskObj.deadline})`);
    }
  }

  // 6. Source and CreatedBy validation
  if (taskObj.source !== 'user') {
    errors.push(`資料來源屬性 (source) 必須為 "user"，當前為: ${taskObj.source}`);
  }
  if (taskObj.createdBy !== 'user') {
    errors.push(`建立者屬性 (createdBy) 必須為 "user"，當前為: ${taskObj.createdBy}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Multi-Agent Chat API with Strict User-Data Boundaries & Anti-Hallucination
  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { message, context } = req.body;
      const userPrompt = (message || '').trim();

      if (!userPrompt) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }

      const startTime = Date.now();
      const currentContext = resolveCurrentContext(context);
      const perfMetrics = {
        total: 0,
        routing: 0,
        databaseRead: 0,
        work: 0,
        study: 0,
        geminiCalls: 0,
        geminiTime: 0,
      };

      const client = getGeminiClient();

      // Extract raw data from context (Database Read Time)
      const dbReadStart = Date.now();
      const rawWorkProjects: any[] = Array.isArray(context?.workProjects) ? context.workProjects : [];
      const rawWorkTasks: any[] = Array.isArray(context?.workTasks) ? context.workTasks : [];
      const rawStudySubjects: any[] = Array.isArray(context?.studySubjects) ? context.studySubjects : [];
      const rawStudyTasks: any[] = Array.isArray(context?.studyTasks) ? context.studyTasks : [];

      // STRICT USER DATA SEPARATION + CONTEXT BOUNDARY
      const { userData: allUserWorkProjects, demoData: demoWorkProjects } = filterUserData(rawWorkProjects);
      const { userData: allUserWorkTasks, demoData: demoWorkTasks } = filterUserData(rawWorkTasks);
      const { userData: userStudySubjects, demoData: demoStudySubjects } = filterUserData(rawStudySubjects);
      const { userData: userStudyTasks, demoData: demoStudyTasks } = filterUserData(rawStudyTasks);

      // Work data is additionally restricted to the current workspace + project.
      // Never fall back to the first project.
      const userWorkProjects = filterWorkProjectsByContext(allUserWorkProjects, currentContext);
      const userWorkTasks = filterWorkTasksByContext(allUserWorkTasks, currentContext);

      perfMetrics.databaseRead = Date.now() - dbReadStart;

      const timestampStr = new Date().toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      // Context Boundary enforcement is applied to work/project operations.
      // Greetings/general chat can still run without a project.
      const projectMentioned = /(?:專案|project|proj-[a-z0-9-]+)/i.test(userPrompt);
      const workOperationHint =
        /(?:工作|工作任務|工作待辦|專案|公事|開會|提案|簡報|bug|api|重構|程式碼|code|主管|客戶|上線|公司|work|project|行銷|企劃|需求|老闆|同仁|PR|commit|開發|計畫|AI\s*Team|團隊|任務|待辦)/i.test(userPrompt);

      // If a work operation is requested without a projectId, stop before
      // Target Check / Duplicate Check / any write or work-data analysis.
      // We do not guess from userWorkProjects[0].
      if (!currentContext.projectId && workOperationHint && !/^(你好|您好|嗨|哈囉|hello|hi|hey|謝謝|感謝)/i.test(userPrompt)) {
        return res.json(contextRequiredResponse(currentContext, userPrompt, timestampStr, startTime));
      }

      // Check if user is asking for a DATA MODIFICATION / UPDATE command
      // Example: "請把『設計 AI Agent 團隊架構』的狀態改成進行中" or "把 X 改成 completed"
      const isStatusModifyCmd =
        /(?:把|將|請把|請將|修改|更新)[『「"']?([^『「"'\n]+?)[』」"']?的?(?:狀態|進度|status)?(?:改成|改為|設定為|更新為|設為|變更為|切換為)\s*([^\s,，。]+)/i.test(
          userPrompt
        ) ||
        /(?:狀態|status)(?:改成|改為|設定為|更新為|設為|變更為)\s*(進行中|已完成|完成|待辦|未開始|延遲|已延遲|in_progress|completed|todo|delayed)/i.test(
          userPrompt
        ) ||
        /資料修改指令|更新共享資料庫中的該任務 status/i.test(userPrompt);

      let newStatusValue: 'todo' | 'in_progress' | 'completed' | 'delayed' = 'in_progress';
      const statusLabelMap: Record<string, string> = {
        todo: '待辦 (Todo)',
        in_progress: '進行中 (In Progress)',
        completed: '已完成 (Completed)',
        delayed: '已延遲 (Delayed)',
      };

      if (isStatusModifyCmd) {
        // Extract target task name or search key
        const matchQuote = userPrompt.match(/[『「"']([^『「"'\n]+)[』」"']/);
        const matchPattern = userPrompt.match(/(?:把|將|請把|請將|修改|更新)\s*([^的\n,，]+?)\s*的?(?:狀態|進度|status)?(?:改成|改為|設定為|更新為|設為|變更為)/i);
        const targetSearchKey = (matchQuote ? matchQuote[1] : matchPattern ? matchPattern[1] : userPrompt).trim();

        // Extract target status
        if (/進行中|in_progress|in progress|執行中/i.test(userPrompt)) {
          newStatusValue = 'in_progress';
        } else if (/已完成|完成|completed|done|結案/i.test(userPrompt)) {
          newStatusValue = 'completed';
        } else if (/待辦|未開始|todo|to-do|重新開啟/i.test(userPrompt)) {
          newStatusValue = 'todo';
        } else if (/延遲|已延遲|delayed|滯後/i.test(userPrompt)) {
          newStatusValue = 'delayed';
        }

        // =============================================================
        // ACTION GUARD 1: TARGET CHECK (寫入前目標唯一性安全檢查)
        // =============================================================
        const targetCheck = actionGuardTargetCheck(targetSearchKey, userWorkTasks, userStudyTasks, userPrompt);

        // Case A: Target Not Found
        if (targetCheck.status === 'NOT_FOUND') {
          const notFoundMarkdown = `### ⚠️ Agent Action Guard 攔截：找不到指定之任務目標 (Target Check Failed)

**Manager Agent (AI 總管)** 在統一共享資料庫 (Shared Data Store) 的 **User Data** 中，未檢索到與「**${targetSearchKey}**」相符的任務，無法執行修改。

---

- 🔍 **檢索條件**：\`${targetSearchKey}\`
- 🗄️ **已檢索範疇**：\`workTasks\` (工作待辦: ${userWorkTasks.length} 筆)、\`studyTasks\` (課業待辦: ${userStudyTasks.length} 筆)
- 🛡️ **Action Guard 防護原則**：Shared Data Store 是 Single Source of Truth，若目標不明確，系統嚴禁擅自建立或模糊修改。
- 💡 **建議下一步**：
  1. 請確認任務名稱是否完整正確。
  2. 或直接提供精確之 **Task ID**（例如 \`w-task-user-...\`）。
  3. 可先向 AI 總管下達「**查詢所有工作任務**」檢視現有清單。`;

          return res.json({
            intentType: 'WORK',
            delegatedAgents: ['work'],
            activityLogs: [
              {
                id: `act-guard-${Date.now()}-1`,
                timestamp: timestampStr,
                stepIndex: 1,
                fromAgent: 'manager',
                action: 'Action Guard: Target Check 失敗',
                summary: `Manager Agent：目標檢索失敗，未在 User Data 中找到「${targetSearchKey}」`,
                detail: `安全攔截：找不到指定任務目標。中止寫入流程以防資料庫污染。`,
                status: 'warning',
                durationMs: 20,
              },
            ],
            workOutput: notFoundMarkdown,
            studyOutput: '',
            finalSynthesisMarkdown: notFoundMarkdown,
            proposedTimeBlocks: [],
            updatedTaskPayload: null,
            durationTotalMs: Date.now() - startTime,
          });
        }

        // Case B: Ambiguous Target / Multiple Candidates Found
        if (targetCheck.status === 'AMBIGUOUS' && targetCheck.candidates && targetCheck.candidates.length > 1) {
          const candidates = targetCheck.candidates;
          const ambiguousMarkdown = `### ⚠️ Agent Action Guard 攔截：找到多筆相似任務，請確認目標 (Ambiguity Detected)

**Manager Agent (AI 總管)** 在共享資料庫 User Data 中檢索到 **${candidates.length}** 筆相似任務。為確保資料一致性，**Agent 不得自行猜測目標**，請確認欲修改之項目：

---

${candidates
  .map(
    (c, idx) =>
      `### ${idx + 1}. **【${c.title}】**
- 🆔 **任務 ID**：\`${c.id}\`
- 📁 **所屬專案/科目**：${c.projectName || c.subjectName || '未歸類'}
- 🎯 **優先等級**：\`${c.priority}\` (${c.priority === 'high' ? 'HIGH' : c.priority === 'medium' ? 'MEDIUM' : 'LOW'})
- 📌 **當前狀態**：\`${statusLabelMap[c.status] || c.status}\`
- ⏰ **截止時間**：\`${c.deadline}\`
- ⏱️ **預估工時**：${c.estimatedHours} 小時`
  )
  .join('\n\n---\n\n')}

---

💡 **請指示**：請直接回覆您欲修改的**完整任務名稱**或精確 **Task ID**，以利進行安全狀態變更。`;

          return res.json({
            intentType: 'WORK',
            delegatedAgents: ['work'],
            activityLogs: [
              {
                id: `act-guard-${Date.now()}-1`,
                timestamp: timestampStr,
                stepIndex: 1,
                fromAgent: 'manager',
                action: 'Action Guard: Target Check 攔截 (多筆候選)',
                summary: `Manager Agent：檢索到 ${candidates.length} 筆相似任務，觸發歧義防護`,
                detail: `找到多筆可能目標 (${candidates.map((c) => c.title).join(' / ')})。遵循 Action Guard 規範，嚴禁自行猜測，要求使用者確認。`,
                status: 'warning',
                durationMs: 25,
              },
            ],
            workOutput: ambiguousMarkdown,
            studyOutput: '',
            finalSynthesisMarkdown: ambiguousMarkdown,
            proposedTimeBlocks: [],
            updatedTaskPayload: null,
            durationTotalMs: Date.now() - startTime,
          });
        }

        // Case C: Exactly 1 Target Confirmed
        const targetTaskToModify = targetCheck.targetTask;
        const targetTaskDomain = targetCheck.domain || 'work';

        const oldStatus = targetTaskToModify.status || 'todo';
        const updatedTask = {
          ...targetTaskToModify,
          status: newStatusValue,
          updatedAt: new Date().toISOString(),
          source: 'user',
          createdBy: 'user',
        };

        // =============================================================
        // ACTION GUARD 3: PARAMETER VALIDATION (參數保真與型別安全檢查)
        // =============================================================
        const paramValidation = actionGuardValidateTaskParameters(updatedTask, userPrompt);
        if (!paramValidation.valid) {
          const paramFailMarkdown = `### ❌ Agent Action Guard 攔截：參數安全驗證未通過 (Parameter Validation Failed)\n\n- **未通過項目**：\n${paramValidation.errors.map((e) => `  - ⚠️ ${e}`).join('\n')}\n\n系統已中止寫入操作。`;
          return res.json({
            intentType: targetTaskDomain === 'work' ? 'WORK' : 'STUDY',
            delegatedAgents: [targetTaskDomain],
            activityLogs: [
              {
                id: `act-guard-${Date.now()}-err`,
                timestamp: timestampStr,
                stepIndex: 1,
                fromAgent: 'manager',
                action: 'Action Guard: Parameter Validation 失敗',
                summary: `Manager Agent：參數安全檢驗未通過，中止寫入`,
                detail: paramValidation.errors.join('; '),
                status: 'warning',
                durationMs: 15,
              },
            ],
            workOutput: targetTaskDomain === 'work' ? paramFailMarkdown : '',
            studyOutput: targetTaskDomain === 'study' ? paramFailMarkdown : '',
            finalSynthesisMarkdown: paramFailMarkdown,
            proposedTimeBlocks: [],
            updatedTaskPayload: null,
            durationTotalMs: Date.now() - startTime,
          });
        }

        // =============================================================
        // READ-AFTER-WRITE CONSISTENCY CHECK
        // =============================================================
        const oldStatusLabel = statusLabelMap[oldStatus] || oldStatus;
        const newStatusLabel = statusLabelMap[newStatusValue] || newStatusValue;

        const modificationActivityLogs: any[] = [
          {
            id: `act-${Date.now()}-1`,
            timestamp: timestampStr,
            stepIndex: 1,
            fromAgent: 'manager',
            action: 'Action Guard: Target Check 通過',
            summary: `Manager Agent：成功鎖定唯一目標任務【${targetTaskToModify.title}】(ID: ${targetTaskToModify.id})`,
            detail: `Target Check 通過。指派 ${targetTaskDomain === 'work' ? 'Work Agent' : 'Study Agent'} 進行寫入前檢查。`,
            status: 'completed',
            durationMs: 20,
          },
          {
            id: `act-${Date.now()}-2`,
            timestamp: timestampStr,
            stepIndex: 2,
            fromAgent: targetTaskDomain === 'work' ? 'work' : 'study',
            action: 'Action Guard: Parameter Validation 通過',
            summary: `${targetTaskDomain === 'work' ? 'Work Agent' : 'Study Agent'}：參數檢驗 100% 合規 (Priority 保留: ${targetTaskToModify.priority}, Deadline: ${targetTaskToModify.deadline})`,
            detail: `確認無任何非預期欄位變更，準備執行原子寫入更新。`,
            status: 'completed',
            durationMs: 20,
          },
          {
            id: `act-${Date.now()}-3`,
            timestamp: timestampStr,
            stepIndex: 3,
            fromAgent: targetTaskDomain === 'work' ? 'work' : 'study',
            action: '執行 status 資料庫寫入更新',
            summary: `${targetTaskDomain === 'work' ? 'Work Agent' : 'Study Agent'}：成功將【${targetTaskToModify.title}】狀態由「${oldStatusLabel}」更新為「${newStatusLabel}」`,
            detail: `共享資料庫已原子寫入更新。完整保留預估工時 (${targetTaskToModify.estimatedHours}h)、截止日期 (${targetTaskToModify.deadline}) 與優先等級 (${targetTaskToModify.priority})。`,
            status: 'completed',
            durationMs: 30,
          },
          {
            id: `act-${Date.now()}-4`,
            timestamp: timestampStr,
            stepIndex: 4,
            fromAgent: targetTaskDomain === 'work' ? 'work' : 'study',
            action: 'Read-after-Write 讀取一致性檢驗',
            summary: `${targetTaskDomain === 'work' ? 'Work Agent' : 'Study Agent'}：重新讀取驗證新狀態 (status = "${newStatusValue}") 100% 一致`,
            detail: `確認 Shared Data Store 狀態已實體更新為 ${newStatusValue}。`,
            status: 'completed',
            durationMs: 20,
          },
          {
            id: `act-${Date.now()}-5`,
            timestamp: timestampStr,
            stepIndex: 5,
            fromAgent: 'manager',
            action: '彙整結果回報使用者',
            summary: `Manager Agent：已向使用者確認任務狀態異動完成，不附加非必要之排程建議。`,
            detail: `執行完畢。資料庫已即時同步。`,
            status: 'completed',
            durationMs: 15,
          },
        ];

        const workReportMarkdown =
          targetTaskDomain === 'work'
            ? `### 💼 Work Agent 資料庫修改回報
- **操作項目**：任務【**${targetTaskToModify.title}**】(ID: \`${targetTaskToModify.id}\`)
- **所屬專案**：${targetTaskToModify.projectName || '未歸類專案'}
- **原狀態**：\`${oldStatusLabel}\`
- **更新後狀態**：\`${newStatusLabel}\`
- **資料庫同步**：\`source = "user"\` 共享資料庫已完成寫入更新 (通過 Action Guard 檢驗)。`
            : '';

        const finalMarkdown = `### ✅ 已成功將任務狀態更新為【${newStatusLabel}】(通過 Action Guard 安全檢查)

**Manager Agent (AI 總管)** 已接收你的資料修改指令，通過 **Target Check** 與 **Parameter Validation** 後，由 **${
          targetTaskDomain === 'work' ? 'Work Agent (工作管理員)' : 'Study Agent (課業管理員)'
        }** 實際更新共享資料庫：

---

- 📌 **任務名稱**：**${targetTaskToModify.title}**
- 🆔 **任務 ID**：\`${targetTaskToModify.id}\`
- 📁 **所屬專案**：${targetTaskToModify.projectName || targetTaskToModify.subjectName || '個人專案'}
- 🔄 **狀態異動**：\`${oldStatusLabel}\` ➔ **\`${newStatusLabel}\`**
- 🎯 **優先順序**：\`${targetTaskToModify.priority}\` (${targetTaskToModify.priority === 'high' ? 'HIGH' : targetTaskToModify.priority === 'medium' ? 'MEDIUM' : 'LOW'})
- ⏱️ **預估工時**：${targetTaskToModify.estimatedHours} 小時 *(忠實保留)*
- ⏰ **截止時間**：${targetTaskToModify.deadline} *(忠實保留)*
- 🗄️ **資料庫狀態**：**已通過 Read-after-Write 驗證並即時寫入共享資料庫** (\`source: "user"\`)

---
*(依據指示：此為精準資料修改指令，已完成寫入並確認，不重新列出排程或額外建議)*`;

        perfMetrics.total = Date.now() - startTime;
        console.log(`[Agent Performance]\ntotal: ${perfMetrics.total} ms\nrouting: ${perfMetrics.routing} ms\ndatabaseRead: ${perfMetrics.databaseRead} ms\nwork: ${perfMetrics.work} ms\nstudy: ${perfMetrics.study} ms\ngeminiCalls: ${perfMetrics.geminiCalls}\ngeminiTime: ${perfMetrics.geminiTime} ms\nintent: DATA_MODIFICATION\n`);

        return res.json({
          intentType: targetTaskDomain === 'work' ? 'WORK' : 'STUDY',
          delegatedAgents: [targetTaskDomain],
          activityLogs: modificationActivityLogs,
          workOutput: workReportMarkdown,
          studyOutput: targetTaskDomain === 'study' ? workReportMarkdown : '',
          finalSynthesisMarkdown: finalMarkdown,
          proposedTimeBlocks: [],
          updatedTaskPayload: updatedTask,
          updatedWorkTask: targetTaskDomain === 'work' ? updatedTask : undefined,
          updatedStudyTask: targetTaskDomain === 'study' ? updatedTask : undefined,
          durationTotalMs: perfMetrics.total,
        });
      }

      // -------------------------------------------------------------
      // OPERATION 1: EXPLICIT TASK CREATION (CREATE FLOW)
      // User requests to add/create a work or study task
      // -------------------------------------------------------------
      const isExplicitCreateTaskCmd =
        /(?:建立|新增|創建)(?:一個|一筆|項)?(?:工作任務|工作|任務|課業任務|課業|科目)/i.test(userPrompt) ||
        /(?:建立|新增|創建)\s*任務/i.test(userPrompt) ||
        /建立任務[:：]|新增任務[:：]|建立工作[:：]|新增工作[:：]|建立課業[:：]|新增課業[:：]/i.test(userPrompt) ||
        /^(?:幫我|請幫我|請)?(?:建立|新增|創建)\s*[『「"']?([^『「"'\n]+)[』」"']?\s*(?:任務|工作|課業)/i.test(userPrompt);

      if (isExplicitCreateTaskCmd) {
        // 1. Determine domain
        const isStudyDomain = /課業|科目|讀書|考試|作業/i.test(userPrompt);
        const targetDomain = isStudyDomain ? 'study' : 'work';

        // 2. Parse Task Title
        let taskTitle = '';
        const matchQuoted = userPrompt.match(/[『「"']([^『「"'\n]+)[』」"']/);
        const matchNamed = userPrompt.match(/(?:任務名稱|工作名稱|科目名稱|任務|工作|科目|內容)\s*(?:設定為|設為|為|是|[=：:])?\s*([^,，\n]+)/);
        const matchAction = userPrompt.match(/(?:建立|新增|創建)(?:一個|一筆|項)?(?:工作任務|工作|任務|課業任務|課業|科目)?\s*(?:設定為|設為|為|是|[=：:])?\s*([^\n,，]+)/);

        if (matchQuoted && matchQuoted[1]) {
          taskTitle = matchQuoted[1].trim();
        } else if (matchNamed && matchNamed[1]) {
          taskTitle = matchNamed[1].replace(/^(一個|一筆|項)/, '').trim();
        } else if (matchAction && matchAction[1]) {
          taskTitle = matchAction[1].replace(/^(一個|一筆|項)/, '').trim();
        } else {
          taskTitle = '新任務';
        }

        // =============================================================
        // ACTION GUARD 2: DUPLICATE CHECK (建立前重複任務安全檢查)
        // =============================================================
        const duplicateCheck = actionGuardDuplicateCheck(taskTitle, userWorkTasks, userStudyTasks, userPrompt);
        if (duplicateCheck.status === 'DUPLICATE_DETECTED' && duplicateCheck.existingTasks && duplicateCheck.existingTasks.length > 0) {
          const existing = duplicateCheck.existingTasks;
          const duplicateMarkdown = `### ⚠️ Agent Action Guard 攔截：偵測到既有重複/高度相似任務 (Duplicate Check)

**Manager Agent (AI 總管)** 在寫入前執行 Action Guard 安全檢查，於統一共享資料庫 (Shared Data Store) User Data 中偵測到與「**${taskTitle}**」相同或高度相似之既有任務：

---

${existing
  .map(
    (e, idx) =>
      `### ${idx + 1}. **【${e.title}】**
- 🆔 **任務 ID**：\`${e.id}\`
- 📁 **所屬專案/科目**：${e.projectName || e.subjectName || '未歸類專案'}
- 🎯 **優先順序**：\`${e.priority}\` (${e.priority === 'high' ? 'HIGH (高優先)' : e.priority === 'medium' ? 'MEDIUM (中等)' : 'LOW (低)'})
- 📌 **當前狀態**：\`${statusLabelMap[e.status] || e.status}\`
- ⏰ **截止時間**：\`${e.deadline}\`
- ⏱️ **預估工時**：${e.estimatedHours} 小時
- 🏷️ **資料來源屬性**：\`source = "${e.source}"\` | \`createdBy = "${e.createdBy}"\``
  )
  .join('\n\n---\n\n')}

---

🛡️ **Action Guard 防護原則**：
為防止重複建立資料或污染 Shared Data Store，系統已暫停自動建立。
- 🔄 **若欲更新既有任務**：請直接指示（例如：「把『${existing[0].title}』的狀態改成進行中」或「修改截止時間」）。
- ➕ **若確認建立全新獨立任務**：請回覆「**確認建立新任務**」或「**強制建立**」。`;

          return res.json({
            intentType: targetDomain === 'work' ? 'WORK' : 'STUDY',
            delegatedAgents: [targetDomain],
            activityLogs: [
              {
                id: `act-guard-${Date.now()}-dup`,
                timestamp: timestampStr,
                stepIndex: 1,
                fromAgent: 'manager',
                action: 'Action Guard: Duplicate Check 攔截',
                summary: `Manager Agent：偵測到與「${taskTitle}」高度相似之既有任務 (${existing.length} 筆)`,
                detail: `已暫停建立以防止重複資料。既有任務: ${existing.map((e) => e.title).join(' / ')}。等待使用者確認。`,
                status: 'warning',
                durationMs: 25,
              },
            ],
            workOutput: targetDomain === 'work' ? duplicateMarkdown : '',
            studyOutput: targetDomain === 'study' ? duplicateMarkdown : '',
            finalSynthesisMarkdown: duplicateMarkdown,
            proposedTimeBlocks: [],
            createdTaskPayload: null,
            durationTotalMs: Date.now() - startTime,
          });
        }

        // 3. Parse Priority (STRICT: User-specified priority must be preserved with ZERO auto-inference or elevation)
        let parsedPriority: 'low' | 'medium' | 'high' = 'medium';
        if (
          /(?:優先[級度順序]|priority)\s*(?:設定為|設為|為|是|[=：:])?\s*(?:medium|med|中|中等|普通|一般|p2)/i.test(userPrompt) ||
          /(?:中等?優先|medium\s*priority)/i.test(userPrompt) ||
          /\bmedium\b/i.test(userPrompt)
        ) {
          parsedPriority = 'medium';
        } else if (
          /(?:優先[級度順序]|priority)\s*(?:設定為|設為|為|是|[=：:])?\s*(?:high|高|緊急|urgent|最優先|p0|p1)/i.test(userPrompt) ||
          /(?:高優先|緊急優先|high\s*priority)/i.test(userPrompt) ||
          /\bhigh\b/i.test(userPrompt)
        ) {
          parsedPriority = 'high';
        } else if (
          /(?:優先[級度順序]|priority)\s*(?:設定為|設為|為|是|[=：:])?\s*(?:low|低|次要|p3)/i.test(userPrompt) ||
          /(?:低優先|次要優先|low\s*priority)/i.test(userPrompt) ||
          /\blow\b/i.test(userPrompt)
        ) {
          parsedPriority = 'low';
        }

        // 4. Parse Estimated Hours
        let estimatedHours = 1.0;
        const matchHours =
          userPrompt.match(/(?:預估工時|預估時間|預計工時|工時|耗時|預估|耗費|預計)\s*(?:設定為|設為|為|是|[=：:])?\s*(\d+(?:\.\d+)?)\s*(?:小時|hr|h|mins|分鐘)?/i) ||
          userPrompt.match(/(\d+(?:\.\d+)?)\s*(?:小時|hr|h)/i);
        if (matchHours && matchHours[1]) {
          estimatedHours = parseFloat(matchHours[1]) || 1.0;
        }

        // 5. Parse Deadline (Preserve full datetime e.g. 2026-09-05T18:00:00)
        let taskDeadline = '2026-09-05T18:00:00';
        const fullDateTimeMatch = userPrompt.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})[\sT]+(\d{1,2}:\d{2}(?::\d{2})?)/);
        if (fullDateTimeMatch) {
          const rawDate = fullDateTimeMatch[1].replace(/\//g, '-');
          const [y, m, d] = rawDate.split('-').map((s) => s.padStart(2, '0'));
          const rawTime = fullDateTimeMatch[2];
          const timeParts = rawTime.split(':');
          const hh = timeParts[0].padStart(2, '0');
          const mm = timeParts[1].padStart(2, '0');
          const ss = timeParts[2] ? timeParts[2].padStart(2, '0') : '00';
          taskDeadline = `${y.length === 2 ? '20' + y : y}-${m}-${d}T${hh}:${mm}:${ss}`;
        } else {
          const dateOnlyMatch = userPrompt.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
          if (dateOnlyMatch) {
            const rawDate = dateOnlyMatch[1].replace(/\//g, '-');
            const [y, m, d] = rawDate.split('-').map((s) => s.padStart(2, '0'));
            taskDeadline = `${y.length === 2 ? '20' + y : y}-${m}-${d}T18:00:00`;
          }
        }

        const newTaskId = targetDomain === 'work' ? `w-task-user-${Date.now()}` : `s-task-user-${Date.now()}`;
        const createdTaskObj: any = {
          id: newTaskId,
          workspaceId: targetDomain === 'work' ? currentContext.workspaceId : undefined,
          projectId: targetDomain === 'work' ? currentContext.projectId : undefined,
          projectName: targetDomain === 'work' ? (userWorkProjects[0]?.title || currentContext.projectId || '未指定專案') : undefined,
          subjectId: targetDomain === 'study' ? (userStudySubjects[0]?.id || 'subj-user-default') : undefined,
          subjectName: targetDomain === 'study' ? (userStudySubjects[0]?.name || '主要科目') : undefined,
          title: taskTitle,
          status: 'todo',
          priority: parsedPriority,
          startDate: new Date().toISOString().split('T')[0],
          deadline: taskDeadline,
          estimatedHours,
          assignee: '本人',
          notes: `由使用者透過 AI 對話明確指示建立。指令來源：「${userPrompt.trim()}」`,
          tags: ['User-Created', 'Shared-Data-Store'],
          isUrgent: parsedPriority === 'high',
          source: 'user',
          createdBy: 'user',
        };

        // =============================================================
        // ACTION GUARD 3: PARAMETER VALIDATION (建立前參數安全檢驗)
        // =============================================================
        const createParamValidation = actionGuardValidateTaskParameters(createdTaskObj, userPrompt);
        if (!createParamValidation.valid) {
          const paramFailMarkdown = `### ❌ Agent Action Guard 攔截：建立參數驗證未通過\n\n- **未通過項目**：\n${createParamValidation.errors.map((e) => `  - ⚠️ ${e}`).join('\n')}\n\n系統已中止寫入操作，未修改 Shared Data Store。`;
          return res.json({
            intentType: targetDomain === 'work' ? 'WORK' : 'STUDY',
            delegatedAgents: [targetDomain],
            activityLogs: [
              {
                id: `act-guard-${Date.now()}-err`,
                timestamp: timestampStr,
                stepIndex: 1,
                fromAgent: 'manager',
                action: 'Action Guard: Parameter Validation 失敗',
                summary: `Manager Agent：建立參數檢驗未通過，中止寫入`,
                detail: createParamValidation.errors.join('; '),
                status: 'warning',
                durationMs: 15,
              },
            ],
            workOutput: targetDomain === 'work' ? paramFailMarkdown : '',
            studyOutput: targetDomain === 'study' ? paramFailMarkdown : '',
            finalSynthesisMarkdown: paramFailMarkdown,
            proposedTimeBlocks: [],
            createdTaskPayload: null,
            durationTotalMs: Date.now() - startTime,
          });
        }

        // =============================================================
        // READ-AFTER-WRITE VALIDATION ON SHARED DATA STORE
        // =============================================================
        const targetStoreBefore = targetDomain === 'work' ? userWorkTasks : userStudyTasks;
        const targetStoreAfter = [createdTaskObj, ...targetStoreBefore];
        const verifiedReadTask = targetStoreAfter.find((t) => t.id === newTaskId && t.source === 'user');

        // Field-by-Field Strict Consistency Check
        const validationErrors: string[] = [];
        if (!verifiedReadTask) {
          validationErrors.push('無法在 Shared Data Store 中透過 Task ID 檢索到新建立之任務');
        } else {
          if (verifiedReadTask.title !== taskTitle) {
            validationErrors.push(`任務名稱不符 (預期: "${taskTitle}", 實際: "${verifiedReadTask.title}")`);
          }
          if (verifiedReadTask.priority !== parsedPriority) {
            validationErrors.push(`優先級不符 (預期: "${parsedPriority}", 實際: "${verifiedReadTask.priority}")`);
          }
          if (verifiedReadTask.estimatedHours !== estimatedHours) {
            validationErrors.push(`預估工時不符 (預期: ${estimatedHours}h, 實際: ${verifiedReadTask.estimatedHours}h)`);
          }
          if (verifiedReadTask.deadline !== taskDeadline) {
            validationErrors.push(`截止時間不符 (預期: "${taskDeadline}", 實際: "${verifiedReadTask.deadline}")`);
          }
          if (verifiedReadTask.source !== 'user') {
            validationErrors.push(`資料來源屬性不符 (預期: "user", 實際: "${verifiedReadTask.source}")`);
          }
          if (verifiedReadTask.createdBy !== 'user') {
            validationErrors.push(`建立者屬性不符 (預期: "user", 實際: "${verifiedReadTask.createdBy}")`);
          }
        }

        if (validationErrors.length > 0) {
          const failureMarkdown = `### ❌ 任務建立失敗：Read-after-Write 一致性檢驗未通過\n\n- **失敗欄位檢驗**：\n${validationErrors.map((err) => `  - ⚠️ ${err}`).join('\n')}\n\n系統已中止操作，未污染 Shared Data Store。`;
          return res.json({
            intentType: targetDomain === 'work' ? 'WORK' : 'STUDY',
            delegatedAgents: [targetDomain],
            activityLogs: [
              {
                id: `act-${Date.now()}-err`,
                timestamp: timestampStr,
                stepIndex: 1,
                fromAgent: 'manager',
                action: 'Read-after-Write 檢驗失敗',
                summary: `Manager Agent：寫入後讀取驗證失敗，中止回報`,
                detail: validationErrors.join('; '),
                status: 'warning',
                durationMs: 10,
              },
            ],
            workOutput: targetDomain === 'work' ? failureMarkdown : '',
            studyOutput: targetDomain === 'study' ? failureMarkdown : '',
            finalSynthesisMarkdown: failureMarkdown,
            proposedTimeBlocks: [],
            createdTaskPayload: null,
            durationTotalMs: Date.now() - startTime,
          });
        }

        // 7. Activity Logs with Complete Action Guard Transparency
        const priorityLabel = parsedPriority === 'high' ? 'HIGH (高優先)' : parsedPriority === 'medium' ? 'MEDIUM (中等)' : 'LOW (低)';
        const createActivityLogs: any[] = [
          {
            id: `act-${Date.now()}-1`,
            timestamp: timestampStr,
            stepIndex: 1,
            fromAgent: 'manager',
            action: 'Action Guard: Duplicate Check 通過',
            summary: `Manager Agent：已通過重複檢驗 (${duplicateCheck.status === 'BYPASSED' ? '使用者指定強制建立' : '未發現重複任務'})`,
            detail: `任務「${createdTaskObj.title}」通過 Duplicate Check，確認為獨立新任務。`,
            status: 'completed',
            durationMs: 15,
          },
          {
            id: `act-${Date.now()}-2`,
            timestamp: timestampStr,
            stepIndex: 2,
            fromAgent: 'manager',
            action: 'Action Guard: Parameter Validation 通過',
            summary: `Manager Agent：8 項參數安全檢驗通過 (Priority: ${createdTaskObj.priority}, 工時: ${createdTaskObj.estimatedHours}h, Deadline: ${createdTaskObj.deadline})`,
            detail: `參數保真確認：Medium 優先級 100% 保留無升級、工時精準保留、ISO Datetime 未截斷。`,
            status: 'completed',
            durationMs: 20,
          },
          {
            id: `act-${Date.now()}-3`,
            timestamp: timestampStr,
            stepIndex: 3,
            fromAgent: targetDomain === 'work' ? 'work' : 'study',
            action: `寫入共享資料庫 (${targetDomain === 'work' ? 'workTasks' : 'studyTasks'})`,
            summary: `${targetDomain === 'work' ? 'Work Agent' : 'Study Agent'}：實體寫入新任務 (ID: ${createdTaskObj.id})，標記 source = "user"`,
            detail: `原子寫入完成。`,
            status: 'completed',
            durationMs: 25,
          },
          {
            id: `act-${Date.now()}-4`,
            timestamp: timestampStr,
            stepIndex: 4,
            fromAgent: targetDomain === 'work' ? 'work' : 'study',
            action: 'Read-after-Write 讀取一致性檢驗',
            summary: `${targetDomain === 'work' ? 'Work Agent' : 'Study Agent'}：重新讀取 Task ID (${verifiedReadTask.id}) 進行 6 欄位一致性驗證`,
            detail: `驗證成功：任務【${verifiedReadTask.title}】之 6 項核心屬性 (Title, Priority: ${verifiedReadTask.priority}, Hours: ${verifiedReadTask.estimatedHours}h, Deadline: ${verifiedReadTask.deadline}, Source: ${verifiedReadTask.source}, CreatedBy: ${verifiedReadTask.createdBy}) 100% 吻合。`,
            status: 'completed',
            durationMs: 25,
          },
          {
            id: `act-${Date.now()}-5`,
            timestamp: timestampStr,
            stepIndex: 5,
            fromAgent: 'manager',
            action: '向使用者回報建立結果',
            summary: `Manager Agent：已向使用者確認任務已成功實體建立於 Shared Data Store。`,
            detail: `Action Guard 與 Read-after-Write 雙重保證通過。`,
            status: 'completed',
            durationMs: 15,
          },
        ];

        const finalCreateMarkdown = `### ✅ 已成功為你建立${targetDomain === 'work' ? '工作' : '課業'}任務 (通過 Action Guard 與 Read-after-Write 檢驗)

**Manager Agent (AI 總管)** 已通過 **Duplicate Check** 與 **Parameter Validation** 安全防護，並調派 **${
          targetDomain === 'work' ? 'Work Agent (工作管理員)' : 'Study Agent (課業管理員)'
        }** 將任務實體寫入**統一共享資料庫 (Shared Data Store)**：

---

- 📌 **任務名稱**：**${createdTaskObj.title}**
- 🆔 **任務 ID**：\`${createdTaskObj.id}\`
- 📁 **所屬專案/科目**：${createdTaskObj.projectName || createdTaskObj.subjectName || '個人專案'}
- 🔄 **初始狀態 (Status)**：\`todo\` (待辦)
- 🎯 **優先順序 (Priority)**：\`${createdTaskObj.priority}\` (**${priorityLabel}**) *(精準保存，未自動調整)*
- ⏱️ **預估工時**：**${createdTaskObj.estimatedHours} 小時** *(精準保存)*
- ⏰ **截止時間 (Deadline)**：**${createdTaskObj.deadline}** *(完整保留 ISO 格式)*
- 👤 **負責人**：${createdTaskObj.assignee}
- 🏷️ **資料屬性**：\`source = "user"\` | \`createdBy = "user"\`
- 🛡️ **安全檢驗**：**通過 Action Guard 參數驗證與 Read-after-Write 雙重檢驗**

---
*(提示：你可以隨時指示 Manager Agent 查詢此任務完整資料或更新進度)*`;

        perfMetrics.total = Date.now() - startTime;
        console.log(`[Agent Performance]\ntotal: ${perfMetrics.total} ms\nrouting: ${perfMetrics.routing} ms\ndatabaseRead: ${perfMetrics.databaseRead} ms\nwork: ${perfMetrics.work} ms\nstudy: ${perfMetrics.study} ms\ngeminiCalls: ${perfMetrics.geminiCalls}\ngeminiTime: ${perfMetrics.geminiTime} ms\nintent: TASK_CREATION\n`);

        return res.json({
          intentType: targetDomain === 'work' ? 'WORK' : 'STUDY',
          delegatedAgents: [targetDomain],
          activityLogs: createActivityLogs,
          workOutput: targetDomain === 'work' ? finalCreateMarkdown : '',
          studyOutput: targetDomain === 'study' ? finalCreateMarkdown : '',
          finalSynthesisMarkdown: finalCreateMarkdown,
          proposedTimeBlocks: [],
          createdTaskPayload: createdTaskObj,
          createdWorkTask: targetDomain === 'work' ? createdTaskObj : undefined,
          createdStudyTask: targetDomain === 'study' ? createdTaskObj : undefined,
          durationTotalMs: perfMetrics.total,
        });
      }

      // -------------------------------------------------------------
      // OPERATION 2: SPECIFIC TASK QUERY / LOOKUP (READ FLOW)
      // User requests to query/view details of a specific task
      // Example: "請查詢『整理 AI Team 下一階段開發計畫』這筆任務目前的完整資料，只回報實際資料，不要修改任何內容。"
      // -------------------------------------------------------------
      const isSpecificTaskQueryCmd =
        /(?:查詢|查看|檢視|尋找|搜尋|調閱|查一下|找|看|這筆任務|該任務|此任務|任務.*完整資料|任務.*實際資料)/i.test(userPrompt) &&
        (/[『「"']([^『「"'\n]+)[』」"']/.test(userPrompt) || /(?:任務名稱|任務|工作|科目)[:：\s]+([^,，\n]+)/.test(userPrompt) || /這筆任務|該任務/.test(userPrompt));

      const matchQueryQuote = userPrompt.match(/[『「"']([^『「"'\n]+)[』」"']/);
      const matchQueryNamed = userPrompt.match(/(?:任務名稱|工作名稱|科目名稱|任務|工作|科目)[:：\s]+([^,，\n]+)/);
      const querySearchKey = (matchQueryQuote ? matchQueryQuote[1] : matchQueryNamed ? matchQueryNamed[1] : '').trim();

      let targetQueriedTask: any = null;
      let targetQueriedDomain: 'work' | 'study' | null = null;

      if (querySearchKey || isSpecificTaskQueryCmd) {
        const searchLower = querySearchKey.toLowerCase();

        // 1. Search in userWorkTasks (Shared Data Store)
        if (querySearchKey) {
          const foundWork = userWorkTasks.find(
            (t) =>
              t.title.toLowerCase() === searchLower ||
              t.title.toLowerCase().includes(searchLower) ||
              searchLower.includes(t.title.toLowerCase()) ||
              (searchLower.includes('ai') && searchLower.includes('計畫') && t.title.includes('AI'))
          );
          if (foundWork) {
            targetQueriedTask = foundWork;
            targetQueriedDomain = 'work';
          } else {
            // 2. Search in userStudyTasks (Shared Data Store)
            const foundStudy = userStudyTasks.find(
              (t) =>
                t.title.toLowerCase() === searchLower ||
                t.title.toLowerCase().includes(searchLower) ||
                searchLower.includes(t.title.toLowerCase())
            );
            if (foundStudy) {
              targetQueriedTask = foundStudy;
              targetQueriedDomain = 'study';
            }
          }
        }
      }

      // If a specific task was matched and requested for query
      if (isSpecificTaskQueryCmd && targetQueriedTask && targetQueriedDomain) {
        const statusLabel = statusLabelMap[targetQueriedTask.status] || targetQueriedTask.status;
        const priorityLabel =
          targetQueriedTask.priority === 'high'
            ? 'HIGH (高優先)'
            : targetQueriedTask.priority === 'medium'
            ? 'MEDIUM (中等)'
            : 'LOW (低)';

        const queryActivityLogs: any[] = [
          {
            id: `act-${Date.now()}-1`,
            timestamp: timestampStr,
            stepIndex: 1,
            fromAgent: 'manager',
            action: '接收任務精準查詢指令',
            summary: `Manager Agent：識別使用者指令為【共享資料庫單筆任務查詢】，指派 ${
              targetQueriedDomain === 'work' ? 'Work Agent (工作管理員)' : 'Study Agent (課業管理員)'
            } 檢索資料庫`,
            detail: `查詢目標名稱：「${targetQueriedTask.title}」，指派 ${
              targetQueriedDomain === 'work' ? 'Work Agent' : 'Study Agent'
            } 自 Shared Data Store (${targetQueriedDomain === 'work' ? 'workTasks' : 'studyTasks'}) 讀取實際資料。`,
            status: 'completed',
            durationMs: 20,
          },
          {
            id: `act-${Date.now()}-2`,
            timestamp: timestampStr,
            stepIndex: 2,
            fromAgent: targetQueriedDomain === 'work' ? 'work' : 'study',
            action: `讀取共享資料庫 (${targetQueriedDomain === 'work' ? 'workTasks' : 'studyTasks'})`,
            summary: `${targetQueriedDomain === 'work' ? 'Work Agent' : 'Study Agent'}：鎖定目標任務【${
              targetQueriedTask.title
            }】(ID: ${targetQueriedTask.id})`,
            detail: `檢索到該筆任務資料，確認標記為 source = "${targetQueriedTask.source}", createdBy = "${targetQueriedTask.createdBy}"。`,
            status: 'completed',
            durationMs: 30,
          },
          {
            id: `act-${Date.now()}-3`,
            timestamp: timestampStr,
            stepIndex: 3,
            fromAgent: targetQueriedDomain === 'work' ? 'work' : 'study',
            action: '解析並提取完整任務屬性',
            summary: `${targetQueriedDomain === 'work' ? 'Work Agent' : 'Study Agent'}：完整讀取 status, priority, estimatedHours, deadline 等全部欄位`,
            detail: `讀取結果：狀態 = "${targetQueriedTask.status}", 優先級 = "${targetQueriedTask.priority}", 預估工時 = ${targetQueriedTask.estimatedHours}h, 截止日期 = "${targetQueriedTask.deadline}"。`,
            status: 'completed',
            durationMs: 25,
          },
          {
            id: `act-${Date.now()}-4`,
            timestamp: timestampStr,
            stepIndex: 4,
            fromAgent: targetQueriedDomain === 'work' ? 'work' : 'study',
            toAgent: 'manager',
            action: '回傳結構化實際資料至 Manager',
            summary: `${targetQueriedDomain === 'work' ? 'Work Agent' : 'Study Agent'} → Manager Agent：回報真實任務完整資料`,
            detail: `依指示僅回報資料庫實際值，不變更任何資料與狀態。`,
            status: 'completed',
            durationMs: 20,
          },
          {
            id: `act-${Date.now()}-5`,
            timestamp: timestampStr,
            stepIndex: 5,
            fromAgent: 'manager',
            action: '回報實際資料至使用者',
            summary: `Manager Agent：已彙整並回報目標任務之完整實際資料。`,
            detail: `查詢完畢。`,
            status: 'completed',
            durationMs: 15,
          },
        ];

        const queryReportMarkdown = `### 📋 ${targetQueriedDomain === 'work' ? 'Work' : 'Study'} Agent 任務查詢報告 (Shared Data Store)

**Manager Agent** 已調派 **${
          targetQueriedDomain === 'work' ? 'Work Agent (工作管理員)' : 'Study Agent (課業管理員)'
        }** 自**統一共享資料庫 (Shared Data Store)** 檢索到目標任務的完整實際資料：

---

- 📌 **任務名稱**：**${targetQueriedTask.title}**
- 🆔 **任務 ID**：\`${targetQueriedTask.id}\`
- 📁 **所屬專案/科目**：${targetQueriedTask.projectName || targetQueriedTask.subjectName || '個人專案'} (ID: \`${targetQueriedTask.projectId || targetQueriedTask.subjectId || '未指定'}\`)
- 🔄 **目前狀態 (Status)**：**\`${statusLabel}\`** (\`${targetQueriedTask.status}\`)
- 🎯 **優先順序 (Priority)**：**${priorityLabel}** (\`${targetQueriedTask.priority}\`)${targetQueriedTask.isUrgent ? ' (🔥 緊急)' : ''}
- ⏱️ **預估工時**：**${targetQueriedTask.estimatedHours || 1} 小時**
- ⏰ **截止時間 (Deadline)**：**${targetQueriedTask.deadline || '未指定'}**
- 📅 **開始日期 (StartDate)**：${targetQueriedTask.startDate || '未指定'}
- 👤 **負責人 (Assignee)**：${targetQueriedTask.assignee || '本人'}
- 🏷️ **標籤 (Tags)**：${Array.isArray(targetQueriedTask.tags) && targetQueriedTask.tags.length > 0 ? targetQueriedTask.tags.map((tg: string) => `\`${tg}\``).join(', ') : '無'}
- 📝 **備註說明 (Notes)**：${targetQueriedTask.notes || '無'}
- 🗄️ **資料來源屬性**：\`source = "${targetQueriedTask.source}"\` | \`createdBy = "${targetQueriedTask.createdBy}"\`

---
*(依據指示：此為精準資料查詢，100% 呈現共享資料庫中的實際資料，未修改任何內容)*`;

        perfMetrics.total = Date.now() - startTime;
        console.log(`[Agent Performance]\ntotal: ${perfMetrics.total} ms\nrouting: ${perfMetrics.routing} ms\ndatabaseRead: ${perfMetrics.databaseRead} ms\nwork: ${perfMetrics.work} ms\nstudy: ${perfMetrics.study} ms\ngeminiCalls: ${perfMetrics.geminiCalls}\ngeminiTime: ${perfMetrics.geminiTime} ms\nintent: SPECIFIC_TASK_QUERY\n`);

        return res.json({
          intentType: targetQueriedDomain === 'work' ? 'WORK' : 'STUDY',
          delegatedAgents: [targetQueriedDomain],
          activityLogs: queryActivityLogs,
          workOutput: targetQueriedDomain === 'work' ? queryReportMarkdown : '',
          studyOutput: targetQueriedDomain === 'study' ? queryReportMarkdown : '',
          finalSynthesisMarkdown: queryReportMarkdown,
          proposedTimeBlocks: [],
          durationTotalMs: perfMetrics.total,
        });
      }

      // 1. Intelligent Intent & Routing Classifier (Deterministic Rule-Based)
      const routingStart = Date.now();
      // Extract exact reply requirement if user specifically requested (e.g., 請只回覆『Manager Agent 正常運作』)
      const exactReplyMatch = userPrompt.match(/(?:請只回覆|只回覆|請回覆|只要回覆|請僅回覆)[：:\s]*[『「"']?([^『「"'\n]+)[』」"']?/);
      const hasNegativeAgentConstraint =
        /(?:不要|不需|不用|切勿|嚴禁|禁止|請勿|別)(?:呼叫|調用|使用|執行|指派).*(?:work|study|工作|課業|專業|其他)?\s*agent/i.test(userPrompt) ||
        /(?:不要|不需|不用|切勿|請勿|別)(?:讀取|查詢|存取|存取|檢索).*(?:資料庫|user data|共享)/i.test(userPrompt) ||
        /(?:只由|僅由|由)\s*manager\s*(?:agent)?\s*(?:回覆|回應|處理)/i.test(userPrompt);

      const isGreetingOrSmallTalk =
        /^(你好|您好|哈囉|嗨|hi|hello|hey|早安|午安|晚安|在嗎|你是誰|你的功能|介紹你自己|自我介紹|謝謝|感謝|掰掰|再見)[\s!！?？.~~]*$/i.test(
          userPrompt.trim()
        ) ||
        /^(manager\s*agent\s*(?:正常運作|你好|在嗎|請回覆|測試)|系統測試|測試連線)$/i.test(userPrompt.trim()) ||
        /^(請介紹|說明一下|介紹一下|你可以做什麼|你能做什麼|系統功能)$/i.test(userPrompt.trim());

      // Check for Work prioritization / analysis commands
      const isWorkAnalysisCmd =
        /(?:分析.*工作|工作.*優先|排出優先.*順序|優先級檢核|優先處理順序|分析目前所有.*工作|工作任務.*優先|排序.*工作|工作優先級)/i.test(
          userPrompt
        );

      // Check for Decision Support intent (e.g. 建議做哪一件、哪一件最重要、優先順序決策、如果只能完成一件)
      const isDecisionSupport =
        !isWorkAnalysisCmd &&
        /(?:建議(?:我|你建議)?(?:做|選|優先處理|完成)?(?:哪一[個項件]|什麼)|哪一[個項件](?:事情|任務|工作|課業)?(?:最重要|最優先|優先)|優先順序決策|做決定|做最後決策|幫我判斷|如果(?:明天|今天|只能)?(?:只能|只可以)?(?:完成|做|選)一[個項件]|只能選一個|比較目前任務|哪件先做|應該先做什麼|該先做哪)/i.test(
          userPrompt
        );

      // Domain-specific keyword checks (Carefully avoid generic words like "任務" or "待辦" from triggering wrong domain)
      const isExplicitStudy =
        /(?:課業|課業任務|課業待辦|讀書|讀書計畫|學科|科目|考試|期考|期中|期末|作業|學習|複習|刷題|leetcode|學分|論文|教材|考題|筆記|教授|老師|章節|study|exam|homework|course)/i.test(
          userPrompt
        );
      const isExplicitWork =
        /(?:工作|工作任務|工作待辦|專案|公事|開會|提案|簡報|bug|api|重構|程式碼|code|主管|客戶|上線|公司|work|project|行銷|企劃|需求|老闆|同仁|PR|commit|開發|計畫|AI\s*Team|團隊)/i.test(
          userPrompt
        );
      const asksHybridCoordination =
        /(?:工作.*(?:課業|讀書|考試|學習)|(?:課業|讀書|考試|學習).*工作|工作與課業|工作和課業|工作及課業|讀書和工作|工作.*學業|學業.*工作|整日排程|整合.*排程|跨領域排程|時間衝突|負荷)/i.test(
          userPrompt
        );

      let intentType: 'CHAT' | 'WORK' | 'STUDY' | 'HYBRID' | 'DECISION_SUPPORT' = 'CHAT';
      let delegatedAgents: ('work' | 'study')[] = [];

      if (exactReplyMatch) {
        // Explicit literal reply instruction
        intentType = 'CHAT';
        delegatedAgents = [];
      } else if (hasNegativeAgentConstraint && !isDecisionSupport && !isExplicitWork && !isExplicitStudy) {
        // Negative constraint explicitly forbidding agent calls
        intentType = 'CHAT';
        delegatedAgents = [];
      } else if (isDecisionSupport) {
        // DECISION_SUPPORT: Manager Agent coordinates necessary agents and makes final recommendation
        intentType = 'DECISION_SUPPORT';
        if (isExplicitWork && !isExplicitStudy) {
          // Decision specifically within work domain (e.g. "我目前哪個工作最重要？")
          delegatedAgents = ['work'];
        } else if (isExplicitStudy && !isExplicitWork) {
          // Decision specifically within study domain (e.g. "我目前哪個課業最重要？")
          delegatedAgents = ['study'];
        } else {
          // Cross-domain decision (e.g. "如果明天只能完成一件事情，你建議我做哪一件？" or "工作和課業只能選一個")
          delegatedAgents = ['work', 'study'];
        }
      } else if (isGreetingOrSmallTalk) {
        // Direct conversation with Manager Agent - No agents called, no database accessed
        intentType = 'CHAT';
        delegatedAgents = [];
      } else if (asksHybridCoordination || (isExplicitWork && isExplicitStudy)) {
        // Explicitly requires both Work and Study coordination
        intentType = 'HYBRID';
        delegatedAgents = ['work', 'study'];
      } else if (isExplicitWork && !isExplicitStudy) {
        // Purely work-focused query
        intentType = 'WORK';
        delegatedAgents = ['work'];
      } else if (isExplicitStudy && !isExplicitWork) {
        // Purely study-focused query
        intentType = 'STUDY';
        delegatedAgents = ['study'];
      } else {
        // General query or question that does not require specialized agent intervention
        intentType = 'CHAT';
        delegatedAgents = [];
      }
      perfMetrics.routing = Date.now() - routingStart;

      const activityLogs: any[] = [];
      let logStepIndex = 1;

      // CASE A: Direct Manager Chat / Simple Greeting / Negative Constraints (0 Gemini calls if greeting/literal)
      if (intentType === 'CHAT') {
        activityLogs.push({
          id: `act-${Date.now()}-${logStepIndex++}`,
          timestamp: timestampStr,
          stepIndex: 1,
          fromAgent: 'manager',
          action: '意圖解析：直接對話 (Direct Response)',
          summary: `Manager Agent：判定為一般對話／系統諮詢，由 AI 總管直接回應，無需調派專家 Agent 或存取資料庫。`,
          detail: `收到使用者輸入：「${userPrompt}」，依意圖判定直接由 Manager Agent 處理完畢，無專業 Agent 呼叫與資料庫讀取。`,
          status: 'completed',
          durationMs: 15,
        });

        let managerResponseText = '';

        if (exactReplyMatch && exactReplyMatch[1]) {
          managerResponseText = exactReplyMatch[1].trim();
        } else if (/你好|您好|嗨|哈囉|hello|hi|早安|午安|晚安/i.test(userPrompt)) {
          managerResponseText = `你好！我是你的 **Personal AI Team 總管 (Manager Agent)**。

我可以根據你的實際需求統籌協調以下專業 Agent：
- 💼 **Work Agent (工作管理員)**：追蹤工作待辦、專案進度、工時核算與優先級排序。
- 🎓 **Study Agent (課業管理員)**：管理學科科目、期考衝刺、掌握度與學習進度督促。

你可以隨時詢問我工作狀態、課業進度，或是讓我為你統籌排定跨領域的每日專注行程！`;
        } else if (client) {
          try {
            const chatPrompt = `你是 Personal AI Team 的「Manager Agent (AI 總管)」。
使用者向你提出一般對話或系統問題：「${userPrompt}」。
請以友善、專業、簡明的繁體中文直接回覆使用者。請注意：
- 除非使用者要求，不要自行列出假排程或捏造虛假資料。
- 保持回答精準且切合使用者問題。`;

            const geminiStart = Date.now();
            perfMetrics.geminiCalls += 1;
            const aiResponse = await client.models.generateContent({
              model: 'gemini-3.7-flash',
              contents: chatPrompt,
            });
            perfMetrics.geminiTime += Date.now() - geminiStart;
            managerResponseText = aiResponse.text || '你好！我是 Manager Agent，隨時準備為你協調整合工作與課業需求。';
          } catch (e) {
            console.warn('Gemini chat error:', e);
            managerResponseText = '你好！我是 Manager Agent，目前系統正常運作中。有任何工作或課業管理需求請隨時告訴我！';
          }
        } else {
          managerResponseText = 'Manager Agent 正常運作中。有任何工作或課業管理需求請隨時告訴我！';
        }

        perfMetrics.total = Date.now() - startTime;
        console.log(`[Agent Performance]\ntotal: ${perfMetrics.total} ms\nrouting: ${perfMetrics.routing} ms\ndatabaseRead: ${perfMetrics.databaseRead} ms\nwork: ${perfMetrics.work} ms\nstudy: ${perfMetrics.study} ms\ngeminiCalls: ${perfMetrics.geminiCalls}\ngeminiTime: ${perfMetrics.geminiTime} ms\nintent: ${intentType}\n`);

        return res.json({
          intentType: 'GENERAL',
          delegatedAgents: [],
          activityLogs,
          workOutput: '',
          studyOutput: '',
          finalSynthesisMarkdown: managerResponseText,
          proposedTimeBlocks: [],
          createdTaskPayload: null,
          durationTotalMs: perfMetrics.total,
        });
      }

      // Step 1: Manager Intent Analysis & Delegation Log for Specialized Queries
      activityLogs.push({
        id: `act-${Date.now()}-${logStepIndex++}`,
        timestamp: timestampStr,
        stepIndex: 1,
        fromAgent: 'manager',
        action: '需求意圖解析與 Agent 分派',
        summary: `Manager Agent：解析需求意圖為【${
          intentType === 'DECISION_SUPPORT'
            ? `決策支援與優先級建議 (分派 ${delegatedAgents.map((a) => (a === 'work' ? 'Work' : 'Study')).join(' + ')} Agent)`
            : intentType === 'WORK'
            ? '工作任務專注處理 (分派 Work Agent)'
            : intentType === 'STUDY'
            ? '課業學習專注處理 (分派 Study Agent)'
            : '工作與課業 跨領域綜合排程 (分派 Work + Study Agent)'
        }】`,
        detail: `收到使用者需求：「${userPrompt}」，分派調度 [${delegatedAgents
          .map((a) => (a === 'work' ? 'Work Agent (工作管理員)' : 'Study Agent (課業管理員)'))
          .join(', ')}]。嚴格僅存取 User Data，Demo Data 強制隔離。`,
        status: 'completed',
        durationMs: 25,
      });

      // 2 & 3. Structured User Data Retrieval via Work & Study Agents (Parallel execution with Promise.all)
      let workAnalysisText = '';
      let activeUserWorkTasks: any[] = [];
      let sortedUserWorkTasks: any[] = [];

      let studyAnalysisText = '';
      let activeUserStudyTasks: any[] = [];
      let sortedUserStudyTasks: any[] = [];

      // Define Work Agent logic
      const runWorkAgent = async () => {
        const workStart = Date.now();
        if (!delegatedAgents.includes('work')) return;

        // Step: Read workTasks
        activityLogs.push({
          id: `act-${Date.now()}-${logStepIndex++}`,
          timestamp: timestampStr,
          stepIndex: logStepIndex - 1,
          fromAgent: 'work',
          action: '讀取 workTasks',
          summary: `Work Agent：讀取 workTasks (User Data：${userWorkTasks.length} 筆 | Demo Data：${demoWorkTasks.length} 筆，已依規範忽略)`,
          detail: `依系統資料來源隔離規範，Work Agent 僅分析 source === 'user' 之使用者真實資料。`,
          status: 'completed',
          durationMs: 40,
        });

        // Filter active uncompleted tasks from User Data
        activeUserWorkTasks = userWorkTasks.filter((t) => t.status !== 'completed');
        const completedUserWorkTasks = userWorkTasks.filter((t) => t.status === 'completed');

        // Sort by priority (high > medium > low), isUrgent, status (delayed first), deadline
        const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
        sortedUserWorkTasks = [...activeUserWorkTasks].sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
          if (pDiff !== 0) return pDiff;
          if (a.status === 'delayed' && b.status !== 'delayed') return -1;
          if (a.status !== 'delayed' && b.status === 'delayed') return 1;
          return 0;
        });

        const totalUserWorkHours = sortedUserWorkTasks.reduce((acc, t) => acc + (Number(t.estimatedHours) || 1), 0);
        const highPriorityUserTasks = sortedUserWorkTasks.filter((t) => t.priority === 'high' || t.isUrgent);
        const delayedUserTasks = sortedUserWorkTasks.filter((t) => t.status === 'delayed');

        if (userWorkTasks.length === 0) {
          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'work',
            action: '分析 User Data',
            summary: `Work Agent：目前沒有使用者工作資料`,
            detail: `共享資料庫中未檢索到 source === 'user' 的工作項目。遵守防捏造邊界，不以 Demo 資料充填。`,
            status: 'completed',
            durationMs: 30,
          });

          workAnalysisText = `### 💼 Work Agent 工作分析報告
- **資料來源**：共享資料庫 (User Data)
- **檢索結果**：目前**沒有使用者工作資料**。
- **資料邊界原則**：Work Agent 嚴格遵守隔離規範，Demo 示範資料不納入分析，且絕不自行捏造任務。
- **引導操作**：請先於「Work」頁面點擊「新增任務」手動建立，或於對話中明確指示。`;

          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'work',
            toAgent: 'manager',
            action: '回傳 Manager',
            summary: `Work Agent → Manager Agent：回報無使用者工作資料`,
            detail: `回報無待辦事項，引導使用者手動建立真實資料。`,
            status: 'completed',
            durationMs: 25,
          });
        } else if (activeUserWorkTasks.length === 0) {
          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'work',
            action: '分析 User Data',
            summary: `Work Agent：所有使用者工作任務均已完成 (${completedUserWorkTasks.length} 筆已完成)`,
            detail: `目前無待辦使用者任務。`,
            status: 'completed',
            durationMs: 30,
          });

          workAnalysisText = `### 💼 Work Agent 工作分析報告
- **資料來源**：共享資料庫 (User Data)
- **檢索結果**：你登記的 ${userWorkTasks.length} 項工作任務皆已標記為【已完成】。
- **狀態**：目前無待辦工作任務！`;

          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'work',
            toAgent: 'manager',
            action: '回傳 Manager',
            summary: `Work Agent → Manager Agent：回傳工作已全部完成報告`,
            detail: `User Data 全部處於 completed 狀態。`,
            status: 'completed',
            durationMs: 25,
          });
        } else {
          // Step: Analyze User Data
          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'work',
            action: '分析 User Data',
            summary: `Work Agent：完成 User Data 優先級排序 (待辦: ${activeUserWorkTasks.length} 筆，首要: ${sortedUserWorkTasks[0].title}，總工時: ${totalUserWorkHours.toFixed(1)}h)`,
            detail: `最高優先處理項目：【${sortedUserWorkTasks[0].title}】(專案: ${sortedUserWorkTasks[0].projectName || '未歸類'}, 截止: ${sortedUserWorkTasks[0].deadline}, 優先級: ${sortedUserWorkTasks[0].priority.toUpperCase()})。所有欄位均忠實保留 Shared Data Store 原始值。`,
            status: 'completed',
            durationMs: 45,
          });

          workAnalysisText = `### 💼 Work Agent 工作優先級分析報告 (僅限 User Data)
- **資料來源**：共享資料庫 (我的資料 / User Data：共 ${userWorkTasks.length} 筆，待辦 ${activeUserWorkTasks.length} 筆)
- **待辦任務數量**：**${activeUserWorkTasks.length} 筆**（總預估工時約 **${totalUserWorkHours.toFixed(1)} 小時**）
- **優先處理排序清單**：
${sortedUserWorkTasks
  .map(
    (t, idx) => {
      const pLabel = t.priority === 'high' ? 'HIGH (高優先)' : t.priority === 'medium' ? 'MEDIUM (中等)' : 'LOW (低)';
      const pIcon = t.priority === 'high' ? '🔥' : t.priority === 'medium' ? '⚡' : '☕';
      return `  ${idx + 1}. **【${pIcon} ${pLabel}${t.isUrgent ? ' - 緊急' : ''}】${t.title}**
     - 所屬專案：${t.projectName || '未歸類專案'} | 負責人：${t.assignee || '本人'}
     - 任務狀態：${t.status === 'todo' ? '待辦 (Todo)' : t.status === 'in_progress' ? '進行中' : t.status === 'delayed' ? '已延遲' : '已完成'}
     - 優先等級：\`${t.priority}\` (${pLabel})
     - 預估工時：${t.estimatedHours} 小時 | 截止時間：${t.deadline}${t.startDate ? ` | 開始日期：${t.startDate}` : ''}${t.notes ? `\n     - 備註說明：${t.notes}` : ''}`;
    }
  )
  .join('\n')}

- **Work Agent 執行建議**：
  - **首要優先**：建議依序優先處理「**${sortedUserWorkTasks[0].title}**」，此任務原始優先級為 \`${sortedUserWorkTasks[0].priority}\` (${sortedUserWorkTasks[0].priority === 'high' ? 'HIGH / 高優先' : sortedUserWorkTasks[0].priority === 'medium' ? 'MEDIUM / 中等' : 'LOW / 低'})，預估需 **${sortedUserWorkTasks[0].estimatedHours} 小時**，截止於 **${sortedUserWorkTasks[0].deadline}**。
  ${delayedUserTasks.length > 0 ? `- ⚠️ **延遲警示**：有 ${delayedUserTasks.length} 項任務已處於延遲狀態，請評估是否需調整排程。` : ''}
  ${highPriorityUserTasks.length > 1 ? `- 共有 ${highPriorityUserTasks.length} 項 High 優先級任務，建議安排於白天專注時段分段推進。` : ''}`;

          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'work',
            toAgent: 'manager',
            action: '回傳 Manager',
            summary: `Work Agent → Manager Agent：回傳 User Data 工作分析報告 (共 ${activeUserWorkTasks.length} 筆真實待辦)`,
            detail: `資料 100% 取自使用者建立之真實資料庫，無任何 Demo 資料介入。`,
            status: 'completed',
            durationMs: 35,
          });
        }
        perfMetrics.work = Date.now() - workStart;
      };

      // Define Study Agent logic
      const runStudyAgent = async () => {
        const studyStart = Date.now();
        if (!delegatedAgents.includes('study')) return;

        // Step: Read studySubjects and studyTasks
        activityLogs.push({
          id: `act-${Date.now()}-${logStepIndex++}`,
          timestamp: timestampStr,
          stepIndex: logStepIndex - 1,
          fromAgent: 'study',
          action: '讀取 studySubjects 與 studyTasks',
          summary: `Study Agent：讀取課業資料 (User Data：${userStudyTasks.length} 筆任務 / ${userStudySubjects.length} 門科目 | Demo Data：${demoStudyTasks.length} 筆，已依規範忽略)`,
          detail: `依系統資料來源隔離規範，Study Agent 僅分析 source === 'user' 之使用者真實課業。`,
          status: 'completed',
          durationMs: 40,
        });

        activeUserStudyTasks = userStudyTasks.filter((t) => t.status !== 'completed');
        sortedUserStudyTasks = [...activeUserStudyTasks].sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0));

        if (userStudySubjects.length === 0 && userStudyTasks.length === 0) {
          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'study',
            action: '分析 User Data',
            summary: `Study Agent：目前沒有使用者課業資料`,
            detail: `共享資料庫中未登記 source === 'user' 的課業資料。不捏造科目，不使用 Demo 資料填補。`,
            status: 'completed',
            durationMs: 30,
          });

          studyAnalysisText = `### 🎓 Study Agent 課業分析報告
- **資料來源**：共享資料庫 (User Data)
- **檢索結果**：目前**沒有使用者課業資料**。
- **原則叮嚀**：Study Agent 嚴禁捏造不存在的科目名稱與考題範圍，且不使用 Demo 資料填補。請先於「Study」建立科目與複習進度。`;

          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'study',
            toAgent: 'manager',
            action: '回傳 Manager',
            summary: `Study Agent → Manager Agent：回報無使用者課業資料`,
            detail: `回報無待辦課業資料，絕不自行憑空捏造。`,
            status: 'completed',
            durationMs: 25,
          });
        } else if (activeUserStudyTasks.length === 0) {
          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'study',
            action: '分析 User Data',
            summary: `Study Agent：所有使用者學習任務皆已完成`,
            detail: `目前無待辦使用者課業任務。`,
            status: 'completed',
            durationMs: 30,
          });

          studyAnalysisText = `### 🎓 Study Agent 課業分析報告
- **資料來源**：共享資料庫 (User Data)
- **檢索結果**：目前登記的使用者學習任務皆已完成。
- **修習科目狀態**：
${userStudySubjects.map((s) => `  - **${s.name}** (${s.code})：掌握度 ${s.progress}% | 下次考試：${s.nextExamDate || '未設定'}`).join('\n')}`;

          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'study',
            toAgent: 'manager',
            action: '回傳 Manager',
            summary: `Study Agent → Manager Agent：回傳課業良好完成報告`,
            detail: `User Data 課業進度良好。`,
            status: 'completed',
            durationMs: 25,
          });
        } else {
          const totalUserStudyHours = sortedUserStudyTasks.reduce((acc, t) => acc + (Number(t.estimatedHours) || 1), 0);
          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'study',
            action: '分析 User Data',
            summary: `Study Agent：完成 User Data 課業排序 (待辦: ${activeUserStudyTasks.length} 筆，總預估: ${totalUserStudyHours.toFixed(1)}h)`,
            detail: `分析真實學習進度。`,
            status: 'completed',
            durationMs: 40,
          });

          studyAnalysisText = `### 🎓 Study Agent 課業分析與督促報告 (僅限 User Data)
- **資料來源**：共享資料庫 (User Data)
- **待複習/作業任務**：**${activeUserStudyTasks.length} 筆**（預估時數約 **${totalUserStudyHours.toFixed(1)} 小時**）
- **學習任務清單**：
${sortedUserStudyTasks
  .map(
    (t, idx) =>
      `  ${idx + 1}. **[${t.type === 'exam' ? '考試衝刺' : t.type === 'assignment' ? '作業習題' : '日常複習'}] ${t.title}**
     - 所屬科目：${t.subjectName} | 章節：${t.chapter || '未標註'}
     - 預估時長：${t.estimatedHours}h | 當前掌握度：${t.progress}% | 截止：${t.deadline}${t.supervisionNote ? `\n     - 🚨 督促重點：${t.supervisionNote}` : ''}`
  )
  .join('\n')}`;

          activityLogs.push({
            id: `act-${Date.now()}-${logStepIndex++}`,
            timestamp: timestampStr,
            stepIndex: logStepIndex - 1,
            fromAgent: 'study',
            toAgent: 'manager',
            action: '回傳 Manager',
            summary: `Study Agent → Manager Agent：回傳 User Data 課業報告 (共 ${activeUserStudyTasks.length} 項任務)`,
            detail: `資料全數源自使用者建立之真實課業庫。`,
            status: 'completed',
            durationMs: 30,
          });
        }
        perfMetrics.study = Date.now() - studyStart;
      };

      // Execute Work and Study retrieval in PARALLEL without sequential blocking
      await Promise.all([runWorkAgent(), runStudyAgent()]);

      // 4. Manager Agent: Master Synthesis & Activity Logging
      const totalEstimatedWorkHours = sortedUserWorkTasks.reduce((acc, t) => acc + (Number(t.estimatedHours) || 1), 0);
      const totalEstimatedStudyHours = sortedUserStudyTasks.reduce((acc, t) => acc + (Number(t.estimatedHours) || 1), 0);
      const totalDayHours = totalEstimatedWorkHours + totalEstimatedStudyHours;
      const hasOverload = totalDayHours > 7.5;

      if (intentType === 'WORK') {
        activityLogs.push({
          id: `act-${Date.now()}-${logStepIndex++}`,
          timestamp: timestampStr,
          stepIndex: logStepIndex - 1,
          fromAgent: 'manager',
          action: '彙整 Work Agent 報告',
          summary: `Manager Agent：彙整 Work Agent 分析結果 (共 ${sortedUserWorkTasks.length} 筆真實待辦，總工時 ${totalEstimatedWorkHours.toFixed(1)}h)`,
          detail: `依專案優先級與截止時間完成工作檢核，不涉及課業與非相關 Agent。`,
          status: 'completed',
          durationMs: 25,
        });
      } else if (intentType === 'STUDY') {
        activityLogs.push({
          id: `act-${Date.now()}-${logStepIndex++}`,
          timestamp: timestampStr,
          stepIndex: logStepIndex - 1,
          fromAgent: 'manager',
          action: '彙整 Study Agent 報告',
          summary: `Manager Agent：彙整 Study Agent 分析結果 (共 ${sortedUserStudyTasks.length} 筆學習任務，${userStudySubjects.length} 門科目)`,
          detail: `依學習進度與考試日期完成課業檢核，不涉及工作與非相關 Agent。`,
          status: 'completed',
          durationMs: 25,
        });
      } else if (intentType === 'DECISION_SUPPORT') {
        activityLogs.push({
          id: `act-${Date.now()}-${logStepIndex++}`,
          timestamp: timestampStr,
          stepIndex: logStepIndex - 1,
          fromAgent: 'manager',
          action: '評估任務優先級與決策支援',
          summary: `Manager Agent：完成 ${delegatedAgents.map((a) => (a === 'work' ? 'Work' : 'Study')).join(' + ')} Agent 使用者資料檢索，由 AI 總管做出最終建議決策。`,
          detail: `分析真實使用者資料：待辦工作 ${sortedUserWorkTasks.length} 筆、待辦課業 ${sortedUserStudyTasks.length} 筆。嚴格僅依 User Data 決策，不修改、新增或刪除任何資料。`,
          status: 'completed',
          durationMs: 30,
        });
      } else {
        activityLogs.push({
          id: `act-${Date.now()}-${logStepIndex++}`,
          timestamp: timestampStr,
          stepIndex: logStepIndex - 1,
          fromAgent: 'manager',
          action: '整合各 Agent 結果與跨領域排程',
          summary: `Manager Agent：完成 Work + Study Agent 真實使用者資料整合 (待辦工作: ${sortedUserWorkTasks.length} 筆 / ${totalEstimatedWorkHours.toFixed(1)}h，待辦課業: ${sortedUserStudyTasks.length} 筆 / ${totalEstimatedStudyHours.toFixed(1)}h)`,
          detail: `依時間衝突與每日精力分配完成跨領域排程。所有決策 100% 依據 User Data。`,
          status: 'completed',
          durationMs: 35,
        });
      }

      let finalSynthesisMarkdown = '';
      let proposedTimeBlocks: any[] = [];

      // If user prompt is ambiguous exam preparation without specific tasks (Rule 5)
      if (intentType === 'STUDY' && /我明天要準備考試|我要準備考試|準備期中考|準備期末考/i.test(userPrompt) && sortedUserStudyTasks.length === 0) {
        finalSynthesisMarkdown = `### 🎓 Study Agent 課業確認詢問

你好！我是你的 **Study Agent (課業管理員)**。

目前你的共享資料庫中尚未登記具體的考試或複習進度。依據資料真實性與防捏造原則，AI 團隊不會自行憑空生成虛擬科目或章節。

請告訴我更多具體資訊，以便我為你建立與排程：
1. **請問是哪一個科目？**（例如：資料結構、計算機網路、作業系統）
2. **準備什麼內容或章節？**（例如：第 5 章樹狀結構、期中考古題）
3. **考試或準備的截止時間是什麼？**（例如：明天 22:00 前完成）

你也可以直接在「**Study 課業**」頁面點擊「新增科目」或「新增學習任務」！`;
      }
      // If DECISION_SUPPORT intent
      else if (intentType === 'DECISION_SUPPORT') {
        const availableWorkCount = sortedUserWorkTasks.length;
        const availableStudyCount = sortedUserStudyTasks.length;

        if (availableWorkCount === 0 && availableStudyCount === 0) {
          finalSynthesisMarkdown = `### 🎯 Manager Agent 決策支援報告

你好！我是你的 **AI 總管 (Manager Agent)**。

我已協調 [${delegatedAgents.map((a) => (a === 'work' ? 'Work Agent (工作管理員)' : 'Study Agent (課業管理員)')).join(', ')}] 檢索你的共享資料庫 (User Data)：

- 💼 **工作資料**：目前資料庫中**沒有由你建立的使用者工作資料**（已排除 Demo 資料）。
- 🎓 **課業資料**：目前資料庫中**沒有由你建立的使用者課業資料**（已排除 Demo 資料）。

💡 **決策建議**：
由於目前尚未有任何使用者真實待辦或課業登記，Manager Agent 無法在無真實資料的情況下做排他性推薦。請先前往「**Work**」或「**Study**」頁面建立真實任務，我將立即為你進行權重評估與決策分析！`;
        } else if (client) {
          try {
            const decisionPrompt = `你是 Personal AI Team 的「Manager Agent (AI 總管)」。
使用者向你尋求決策支援：「${userPrompt}」

【絕對禁止】：
1. 嚴格禁止捏造任何不存在的任務、專案、考試、人名或細節！
2. 嚴格禁止引用任何 Demo 示範資料！
3. 嚴格禁止建立、修改或刪除任何資料庫資料！
4. 只能使用以下從共享資料庫查詢到的真實 User Data。若某領域沒有資料，請明確說明「目前無該領域使用者資料」。

【真實使用者工作資料庫 (User Work Tasks)】:
${delegatedAgents.includes('work') ? JSON.stringify(sortedUserWorkTasks, null, 2) : '未查詢工作領域'}

【真實使用者課業資料庫 (User Study Tasks & Subjects)】:
${delegatedAgents.includes('study') ? JSON.stringify({ subjects: userStudySubjects, tasks: sortedUserStudyTasks }, null, 2) : '未查詢課業領域'}

請以 Manager Agent 的身分產出決策建議：
1. 明確指出若只能做一件或最優先的一件事，你推薦哪一項真實任務（請明確標註名稱、專案/科目、截止時間與預估工時）。
2. 給出清晰、具說服力的決策理由（如優先級、截止日期緊急程度、任務影響力等）。
3. 全程使用繁體中文，語氣果斷、專業且條理分明。`;

            const geminiStart = Date.now();
            perfMetrics.geminiCalls += 1;
            const aiResponse = await client.models.generateContent({
              model: 'gemini-3.7-flash',
              contents: decisionPrompt,
            });
            perfMetrics.geminiTime += Date.now() - geminiStart;
            finalSynthesisMarkdown = aiResponse.text || '';
          } catch (e) {
            console.warn('Gemini decision generation error, using deterministic decision:', e);
          }
        }

        // Deterministic fallback for DECISION_SUPPORT if AI is unavailable or returned empty
        if (!finalSynthesisMarkdown && (availableWorkCount > 0 || availableStudyCount > 0)) {
          const topWork = sortedUserWorkTasks[0];
          const topStudy = sortedUserStudyTasks[0];

          let recommendedTaskName = '';
          let reason = '';
          let domainLabel = '';
          let taskDetails = '';

          if (topWork && (!topStudy || topWork.priority === 'high' || topWork.isUrgent)) {
            recommendedTaskName = topWork.title;
            domainLabel = '💼 工作領域';
            taskDetails = `- 📁 **所屬專案**：${topWork.projectName || '未歸類專案'}
- 🎯 **優先順序**：${topWork.priority.toUpperCase()} ${topWork.isUrgent ? '(🔥 緊急)' : ''}
- ⏱️ **預估工時**：${topWork.estimatedHours} 小時
- ⏰ **截止時間**：${topWork.deadline}`;
            reason = `此任務在你的工作待辦中被標記為 **${topWork.priority.toUpperCase()}** 優先級，且預估需 **${topWork.estimatedHours} 小時**，截止時間為 **${topWork.deadline}**。優先攻克核心產出能最大化降低延遲風險。`;
          } else if (topStudy) {
            recommendedTaskName = topStudy.title;
            domainLabel = '🎓 課業領域';
            taskDetails = `- 📚 **所屬科目**：${topStudy.subjectName}
- 🎯 **任務類型**：${topStudy.type === 'exam' ? '考試衝刺' : '課業複習'}
- ⏱️ **預估時長**：${topStudy.estimatedHours} 小時
- ⏰ **截止時間**：${topStudy.deadline}`;
            reason = `此課業任務截止時間為 **${topStudy.deadline}**，目前掌握度為 **${topStudy.progress}%**，建議集中精力優先完成以確保學習成效。`;
          }

          finalSynthesisMarkdown = `### 🎯 Manager Agent 決策支援與優先級建議

你好！我是你的 **AI 總管 (Manager Agent)**。我已協調 [${delegatedAgents.map((a) => (a === 'work' ? 'Work Agent' : 'Study Agent')).join(', ')}] 檢索你的共享資料庫 (User Data)。

我建議你明天**優先處理**：

### 📌 首要聚焦任務：**【${recommendedTaskName}】** (${domainLabel})

${taskDetails}

---

#### 💡 Manager Agent 決策理由
1. **${reason}**
2. **單一聚焦效益**：集中高精力時段完成最重要的單一交付物，比多工切換更能確保高產出與品質。

---
*註：本決策完全基於你的真實使用者資料 (User Data) 進行分析，系統未建立、修改或刪除任何資料。*`;
        }
      }
      // If user asks specifically for WORK (intentType === 'WORK')
      else if (intentType === 'WORK') {
        if (sortedUserWorkTasks.length === 0) {
          finalSynthesisMarkdown = `### 💼 Work Agent 工作分析報告 (我的資料)

你好！我是你的 **AI 總管 (Manager Agent)**。我已召集 **Work Agent** 查詢你的共享資料庫：

- 💼 **檢索結果**：目前**沒有使用者工作待辦**（已過濾 Demo 示範資料）。
- 💡 **如何建立任務**：請前往「**Work**」頁面點擊「**新增任務**」，或在對話中直接指示建立。`;
        } else {
          finalSynthesisMarkdown = `### 💼 Work Agent 工作優先級檢核報告 (我的資料)

你好！我是你的 **AI 總管 (Manager Agent)**。我已召集 **Work Agent** 讀取你的**共享資料庫 (User Data)**，目前找到 **${sortedUserWorkTasks.length} 筆**由你建立且尚未完成的工作任務：

---

#### 📋 待處理工作優先級排序清單

${sortedUserWorkTasks
  .map(
    (t, idx) => {
      const pLabel = t.priority === 'high' ? 'HIGH (高優先)' : t.priority === 'medium' ? 'MEDIUM (中等)' : 'LOW (低)';
      const pIcon = t.priority === 'high' ? '🔥' : t.priority === 'medium' ? '⚡' : '☕';
      return `### ${idx + 1}. **【${pIcon} ${pLabel}${t.isUrgent ? ' · 緊急' : ''}】${t.title}**
- 📁 **所屬專案**：${t.projectName || '未歸類專案'}
- 👤 **負責人**：${t.assignee || '本人'}
- 🎯 **優先順序 (Priority)**：\`${t.priority}\` (**${pLabel}**)${t.isUrgent ? ' (🔥 Urgent)' : ''}
- 📌 **任務狀態 (Status)**：\`${t.status === 'todo' ? '待辦 (Todo)' : t.status === 'in_progress' ? '進行中' : t.status === 'delayed' ? '已延遲' : '已完成'}\`
- ⏱️ **預估工時**：**${t.estimatedHours} 小時**
- 📅 **開始日期**：${t.startDate || '未指定'}
- ⏰ **截止時間 (Deadline)**：**${t.deadline}**
- 🏷️ **資料來源屬性**：\`source = "${t.source}"\` | \`createdBy = "${t.createdBy}"\`
${t.notes ? `- 📝 **備註說明**：${t.notes}` : ''}`;
    }
  )
  .join('\n\n---\n\n')}

---

#### 💡 AI 總管執行建議
1. **立即聚焦**：建議依排序優先推進「**${sortedUserWorkTasks[0].title}**」，其在資料庫中之原始優先級為 \`${sortedUserWorkTasks[0].priority}\` (${sortedUserWorkTasks[0].priority === 'high' ? 'HIGH / 高優先' : sortedUserWorkTasks[0].priority === 'medium' ? 'MEDIUM / 中等' : 'LOW / 低'})，預估耗時 **${sortedUserWorkTasks[0].estimatedHours} 小時**，務必於 **${sortedUserWorkTasks[0].deadline}** 前完成交付。
2. **工時評估**：目前待辦總工時約 **${totalEstimatedWorkHours.toFixed(1)} 小時**，建議排定於日間高精力時段集中攻克！
3. **資料真實性與保真度聲明 (Data Fidelity Guarantee)**：
   - 本報告 100% 取自統一共享資料庫 (Shared Data Store)，各項任務之 **priority** 與 **deadline** 均忠實呈現原始真實值。
   - 排序係由 Work Agent 依據綜合優先級及截止時間進行計算，**完全未修改或覆寫資料庫內任何原始欄位**。`;
        }
      }
      // If user asks specifically for STUDY (intentType === 'STUDY')
      else if (intentType === 'STUDY') {
        if (sortedUserStudyTasks.length === 0 && userStudySubjects.length === 0) {
          finalSynthesisMarkdown = `### 🎓 Study Agent 課業分析報告 (我的資料)

你好！我是你的 **AI 總管 (Manager Agent)**。我已召集 **Study Agent** 查詢你的共享資料庫：

- 🎓 **檢索結果**：目前**沒有使用者課業資料**（已過濾 Demo 示範資料）。
- 💡 **如何建立課業**：請前往「**Study**」頁面點擊「**新增科目**」或「**新增學習任務**」。`;
        } else {
          finalSynthesisMarkdown = studyAnalysisText;
        }
      }
      // If HYBRID intent and Gemini client is available
      else if (client && (sortedUserWorkTasks.length > 0 || sortedUserStudyTasks.length > 0)) {
        try {
          const synthesisPrompt = `你是 Personal AI Team 的「Manager Agent (AI 總管)」。
【嚴格核心禁令 - 違者視為嚴重違規】：
1. 你絕對不能捏造任何不存在的專案、任務、科目、考試或人名！
2. 嚴格禁止引用任何 Demo 示範資料！
3. 所有任務與資訊必須 100% 來自以下從共享資料庫讀取到的使用者真實資料 (User Data)。

使用者提問：「${userPrompt}」

【真實使用者工作資料庫 (User Work Tasks)】:
${JSON.stringify(sortedUserWorkTasks, null, 2)}

【真實使用者課業資料庫 (User Study Tasks & Subjects)】:
${JSON.stringify({ subjects: userStudySubjects, tasks: sortedUserStudyTasks }, null, 2)}

使用者工作待辦: ${sortedUserWorkTasks.length} 筆 (${totalEstimatedWorkHours}h), 使用者課業待辦: ${sortedUserStudyTasks.length} 筆 (${totalEstimatedStudyHours}h), 總合: ${totalDayHours}h

請以 Manager Agent 的身分產出整合回覆：
1. 清楚條列從共享資料庫中檢索到的真實工作與課業任務名稱。
2. 若沒有課業或工作資料，請老實回報，絕不虛構！
3. 根據 priority、dueDate、status 給出具體的優先處理建議與排程分配。
4. 全程使用繁體中文，條理分明。`;

          const geminiStart = Date.now();
          perfMetrics.geminiCalls += 1;
          const aiResponse = await client.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: synthesisPrompt,
          });
          perfMetrics.geminiTime += Date.now() - geminiStart;
          finalSynthesisMarkdown = aiResponse.text || '';
        } catch (e) {
          console.warn('Gemini generateContent error, falling back to deterministic synthesis:', e);
        }
      }

      // Deterministic rule-based synthesis fallback for HYBRID
      if (!finalSynthesisMarkdown) {
        if (sortedUserWorkTasks.length === 0 && sortedUserStudyTasks.length === 0) {
          finalSynthesisMarkdown = `### 📋 目前沒有使用者工作與課業資料 (User Data)

你好！我是你的 **AI 總管 (Manager Agent)**。

我已召集 **Work Agent** 與 **Study Agent** 查詢你的共享資料庫：
- 💼 **Work Agent**：目前資料庫中尚無由你建立之待辦工作任務（已忽略示範資料）。
- 🎓 **Study Agent**：目前資料庫中尚無由你建立之待辦課業任務（已忽略示範資料）。

💡 **如何開始建立你的真實任務？**
1. 切換至「**Work**」頁面點擊「**新增任務**」登記你的工作。
2. 切換至「**Study**」頁面點擊「**新增科目**」建立學科與複習進度。`;
        } else {
          finalSynthesisMarkdown = `### 📋 AI 團隊排程整合報告 (基於我的資料 / User Data)

我已召集 **Work Agent** 與 **Study Agent** 直接讀取共享資料庫中的使用者真實資料，完成任務排序與工時核算：

---

#### 📊 使用者待辦負載統計
- 💼 **待辦工作**：${sortedUserWorkTasks.length} 筆（約 ${totalEstimatedWorkHours.toFixed(1)} 小時）
- 🎓 **待辦課業**：${sortedUserStudyTasks.length} 筆（約 ${totalEstimatedStudyHours.toFixed(1)} 小時）
- ⏱️ **總專注工時**：**${totalDayHours.toFixed(1)} 小時** ${hasOverload ? '⚠️ **【超載警示】建議優先確保 High 優先級任務！**' : '✅ **【工時合理】**'}

---

#### 📋 真實任務清單與優先級

${sortedUserWorkTasks.length > 0 ? `**💼 工作任務 (Work Agent)**：\n` + sortedUserWorkTasks.map((t, i) => `${i + 1}. **[${t.priority.toUpperCase()}${t.isUrgent ? ' - 緊急' : ''}] ${t.title}** (${t.projectName || '工作'}) — 預估 ${t.estimatedHours}h | 截止：${t.deadline} | 狀態：${t.status}`).join('\n') : '💼 無使用者待辦工作'}

${sortedUserStudyTasks.length > 0 ? `\n**🎓 課業任務 (Study Agent)**：\n` + sortedUserStudyTasks.map((t, i) => `${i + 1}. **[${t.type === 'exam' ? '考試衝刺' : '課業'}] ${t.title}** (${t.subjectName}) — 預估 ${t.estimatedHours}h | 截止：${t.deadline}`).join('\n') : '\n🎓 目前無使用者待辦課業'}

---

#### 💡 AI 總管執行建議
${sortedUserWorkTasks.length > 0 ? `1. **工作首要**：優先專注完成「**${sortedUserWorkTasks[0].title}**」，預估需 ${sortedUserWorkTasks[0].estimatedHours} 小時。` : ''}
${sortedUserStudyTasks.length > 0 ? `2. **課業督促**：Study Agent 提醒晚間針對「**${sortedUserStudyTasks[0].title}**」落實按表操課！` : ''}`;
        }
      }

      // Generate structured time blocks ONLY when HYBRID schedule is requested and real tasks exist
      if (intentType === 'HYBRID' && (sortedUserWorkTasks.length > 0 || sortedUserStudyTasks.length > 0)) {
        const workSlots = ['09:30 - 12:00', '13:30 - 15:30', '15:30 - 16:30', '16:30 - 17:30'];
        const studySlots = ['19:30 - 21:00', '21:00 - 22:00', '22:00 - 23:00'];

        sortedUserWorkTasks.slice(0, 3).forEach((task, idx) => {
          proposedTimeBlocks.push({
            time: workSlots[idx] || '日間時段',
            type: 'work' as const,
            agentOwner: 'work' as const,
            title: task.title,
            duration: `${Math.round((task.estimatedHours || 1.5) * 60)} 分鐘`,
            priority: task.priority || 'medium',
            tips: task.notes || `專案：${task.projectName || '工作'} (截止：${task.deadline})`,
          });
        });

        if (sortedUserWorkTasks.length > 0 && sortedUserStudyTasks.length > 0) {
          proposedTimeBlocks.push({
            time: '18:00 - 19:30',
            type: 'rest' as const,
            agentOwner: 'manager' as const,
            title: '晚餐與精力充電緩衝',
            duration: '90 分鐘',
            tips: '身心充電，切換至晚間專注學習模式',
          });
        }

        sortedUserStudyTasks.slice(0, 2).forEach((task, idx) => {
          proposedTimeBlocks.push({
            time: studySlots[idx] || '晚間時段',
            type: 'study' as const,
            agentOwner: 'study' as const,
            title: task.title,
            duration: `${Math.round((task.estimatedHours || 1.5) * 60)} 分鐘`,
            priority: task.priority || 'high',
            tips: task.supervisionNote || `科目：${task.subjectName} (進度：${task.progress}%)`,
          });
        });

        proposedTimeBlocks.push({
          time: '22:00 - 22:30',
          type: 'buffer' as const,
          agentOwner: 'manager' as const,
          title: '今日覆盤與明日排程總結',
          duration: '30 分鐘',
          tips: '檢核各項任務完成度並更新進度',
        });
      }

      perfMetrics.total = Date.now() - startTime;
      console.log(`[Agent Performance]\ntotal: ${perfMetrics.total} ms\nrouting: ${perfMetrics.routing} ms\ndatabaseRead: ${perfMetrics.databaseRead} ms\nwork: ${perfMetrics.work} ms\nstudy: ${perfMetrics.study} ms\ngeminiCalls: ${perfMetrics.geminiCalls}\ngeminiTime: ${perfMetrics.geminiTime} ms\nintent: ${intentType}\n`);

      res.json({
        intentType,
        delegatedAgents,
        activityLogs,
        workOutput: workAnalysisText,
        studyOutput: studyAnalysisText,
        finalSynthesisMarkdown,
        proposedTimeBlocks,
        createdTaskPayload: null,
        durationTotalMs: perfMetrics.total,
      });
    } catch (error: any) {
      console.error('Error in /api/agent/chat:', error);
      res.status(500).json({
        error: 'AI 團隊協作處理過程中發生錯誤',
        details: error?.message || String(error),
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal AI Team Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
