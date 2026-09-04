import express from 'express';

export type AgentId = 'manager' | 'work' | 'study';

type RouteResult = {
  primaryAgent: AgentId;
  delegatedAgents: AgentId[];
  intent: 'work' | 'study' | 'mixed' | 'general';
  reason: string;
  requiresDataWrite: boolean;
};

const router = express.Router();

const WORK_PATTERNS = [
  /工作|任務|待辦|專案|客戶|行銷|報告|主管|職場|上班|截止|deadline/i,
];
const STUDY_PATTERNS = [
  /課業|作業|考試|讀書|學習|研究|論文|教授|課程|複習|lab|報告/i,
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

router.post('/route', (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message cannot be empty' });

  const route = routeManagerRequest(message);
  return res.json({
    manager: {
      id: 'manager',
      name: 'Manager Agent',
      role: 'AI 總管',
    },
    route,
    plan: [
      'Manager 接收需求',
      ...route.delegatedAgents.map((agent) => `${agent === 'work' ? 'Work Agent' : 'Study Agent'} 讀取對應 User Data 並執行`),
      route.delegatedAgents.length ? 'Manager 整合 Agent 結果' : 'Manager 直接處理一般需求',
      route.requiresDataWrite ? '確認實際寫入資料後再回報 Owner' : '唯讀分析／自然對話，不宣稱已修改資料',
    ],
  });
});

export default router;
