import express from 'express';

export type AgentId = 'manager' | 'work' | 'study';
export type AgentIntent = 'work' | 'study' | 'mixed' | 'general';

export type RouteResult = {
  primaryAgent: AgentId;
  delegatedAgents: AgentId[];
  intent: AgentIntent;
  reason: string;
  requiresDataWrite: boolean;
};

export type AgentExecutionStep = {
  agentId: AgentId;
  role: 'manager' | 'specialist';
  purpose: string;
  status: 'queued' | 'running' | 'completed' | 'blocked';
};

export type TeamExecutionPlan = {
  route: RouteResult;
  steps: AgentExecutionStep[];
  managerFinalStep: string;
};

const router = express.Router();

const WORK_PATTERNS = [
  /工作|任務|待辦|專案|客戶|行銷|主管|職場|上班|截止|deadline/i,
];
const STUDY_PATTERNS = [
  /課業|作業|考試|讀書|學習|研究|論文|教授|課程|複習|lab/i,
];
const WRITE_PATTERNS = [
  /新增|建立|修改|更新|刪除|完成|取消|安排|排程|排定|加入|移除|標記|改成|調整/i,
];

function matches(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

export function routeManagerRequest(message: string): RouteResult {
  const text = message.trim();
  const isWork = matches(WORK_PATTERNS, text);
  const isStudy = matches(STUDY_PATTERNS, text);
  const requiresDataWrite = matches(WRITE_PATTERNS, text);

  if (isWork && isStudy) {
    return {
      primaryAgent: 'manager',
      delegatedAgents: ['work', 'study'],
      intent: 'mixed',
      reason: '同時涉及工作與課業，Manager 需要協調兩個專業 Agent。',
      requiresDataWrite,
    };
  }

  if (isWork) {
    return {
      primaryAgent: 'work',
      delegatedAgents: ['work'],
      intent: 'work',
      reason: '辨識為工作／專案／任務管理需求。',
      requiresDataWrite,
    };
  }

  if (isStudy) {
    return {
      primaryAgent: 'study',
      delegatedAgents: ['study'],
      intent: 'study',
      reason: '辨識為課業／研究／學習管理需求。',
      requiresDataWrite,
    };
  }

  return {
    primaryAgent: 'manager',
    delegatedAgents: [],
    intent: 'general',
    reason: '目前無法安全判定為單一專業領域，由 Manager 直接處理。',
    requiresDataWrite,
  };
}

export function buildTeamExecutionPlan(route: RouteResult): TeamExecutionPlan {
  const steps: AgentExecutionStep[] = [
    {
      agentId: 'manager',
      role: 'manager',
      purpose: '分析 Owner 需求、判斷是否需要專業 Agent 協作。',
      status: 'completed',
    },
  ];

  route.delegatedAgents.forEach((agentId) => {
    steps.push({
      agentId,
      role: 'specialist',
      purpose: agentId === 'work' ? '讀取工作 User Data，處理工作專案與任務。' : '讀取課業／研究 User Data，處理學習與研究需求。',
      status: 'queued',
    });
  });

  steps.push({
    agentId: 'manager',
    role: 'manager',
    purpose: route.delegatedAgents.length ? '接收專業 Agent 結果、驗證實際資料狀態並形成最終回覆。' : '直接完成一般需求並回覆 Owner。',
    status: 'queued',
  });

  return {
    route,
    steps,
    managerFinalStep: route.requiresDataWrite
      ? '只有確認資料實際寫入成功後，Manager 才能向 Owner 宣稱已完成。'
      : '本次以唯讀分析或自然對話為主，不得宣稱已修改資料。',
  };
}

router.post('/route', (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message cannot be empty' });

  const route = routeManagerRequest(message);
  const executionPlan = buildTeamExecutionPlan(route);

  return res.json({
    manager: { id: 'manager', name: 'Manager Agent', role: 'AI 總管' },
    ...executionPlan,
  });
});

export default router;
