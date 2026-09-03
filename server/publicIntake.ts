export type PublicIntakeCategory = 'work' | 'study' | 'personal';

export interface PublicIntakeResult {
  category: PublicIntakeCategory;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  projectId: string | null;
}

/**
 * Public Area is the Manager's intake desk.
 * It classifies scattered Owner requests before the legacy /api/agent/chat
 * flow applies its normal workspace/project safety boundary.
 *
 * Important: classification never invents a project. A work project is only
 * selected when the request contains a unique, high-confidence project-name
 * match from the user's own project list.
 */
export function classifyPublicRequest(message: string, workProjects: any[] = []): PublicIntakeResult {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();

  const studySignals = [
    /課業|作業|考試|考前|複習|讀書|念書|學習|科目|上課|教材|考題|學分|期中|期末|論文|文獻|研究|研究方法|paper|study|exam|review/i,
  ];
  const personalSignals = [
    /生活|個人|私人|休息|睡眠|運動|健身|吃飯|飲食|旅行|旅遊|約會|家庭|家裡|購物|採買|習慣|目標|時間安排|日程|行程|今天要做什麼/i,
  ];
  const workSignals = [
    /工作|公司|客戶|主管|老闆|同事|專案|專案管理|工作任務|工作待辦|提案|簡報|行銷|企劃|社群|粉專|廣告|影片|短影音|開發|程式|程式碼|bug|api|PR|commit|部署|上線|會議|業務|職場|work|project/i,
  ];

  const studyScore = studySignals.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);
  const personalScore = personalSignals.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);
  const workScore = workSignals.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0);

  let category: PublicIntakeCategory = 'personal';
  let topScore = personalScore;
  let secondScore = Math.max(workScore, studyScore);

  if (workScore > topScore) {
    category = 'work';
    topScore = workScore;
    secondScore = Math.max(studyScore, personalScore);
  }
  if (studyScore > topScore) {
    category = 'study';
    topScore = studyScore;
    secondScore = Math.max(workScore, personalScore);
  }

  // No domain signal: let Manager own the conversation rather than pretending
  // an ordinary greeting/general question is a task.
  if (topScore === 0) {
    return { category: 'personal', confidence: 'low', reason: '未偵測到明確工作或課業訊號，先交由個人規劃脈絡處理。', projectId: null };
  }

  const confidence: PublicIntakeResult['confidence'] = topScore >= 2 && topScore > secondScore ? 'high' : topScore > secondScore ? 'medium' : 'low';

  let projectId: string | null = null;
  if (category === 'work' && Array.isArray(workProjects)) {
    const candidates = workProjects.filter(p => p?.source === 'user' && p?.id && p?.title)
      .filter(p => lower.includes(String(p.title).toLowerCase()));
    if (candidates.length === 1) projectId = candidates[0].id;
  }

  const reason = category === 'work'
    ? `偵測到工作／專案相關語意${projectId ? `，並唯一匹配使用者專案「${workProjects.find(p => p.id === projectId)?.title || projectId}」` : '，但目前沒有安全可唯一匹配的專案'}`
    : category === 'study'
      ? '偵測到課業／學習／研究相關語意。'
      : '偵測到生活／個人規劃相關語意。';

  return { category, confidence, reason, projectId };
}

export function buildPublicRoutingInstruction(result: PublicIntakeResult): string {
  const label = result.category === 'work' ? '工作' : result.category === 'study' ? '課業' : '個人規劃';
  return `Public Area Manager routing decision: category=${result.category}; label=${label}; confidence=${result.confidence}; projectId=${result.projectId || 'none'}; reason=${result.reason}`;
}
