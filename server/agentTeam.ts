import express from 'express';

export type AgentId = 'manager' | 'work' | 'study' | 'research' | 'personal' | 'psychology';
export type AgentIntent = 'work' | 'study' | 'research' | 'personal' | 'psychology' | 'mixed' | 'general';
export type RouteResult = { primaryAgent: AgentId; delegatedAgents: AgentId[]; intent: AgentIntent; reason: string; requiresDataWrite: boolean; };
export type AgentExecutionStep = { agentId: AgentId; role: 'manager' | 'specialist'; purpose: string; status: 'queued' | 'running' | 'completed' | 'blocked'; };
export type TeamExecutionPlan = { route: RouteResult; steps: AgentExecutionStep[]; managerFinalStep: string; };
const router = express.Router();
const WORK_PATTERNS = [/工作|任務|待辦|專案|客戶|行銷|主管|職場|上班|截止|deadline/i];
const RESEARCH_PATTERNS = [/研究|研究任務|研究計畫|研究專題|論文|文獻|研究方法|研究資料|研究設計|統計分析|資料分析|矩陣分解|碩論|學位論文|paper|literature|methodology/i];
const STUDY_PATTERNS = [/課業|作業|考試|讀書|學習|教授|課程|複習|lab/i];
const PERSONAL_PATTERNS = [/個人|生活|習慣|打卡|備忘|備忘錄|提醒我|生活規劃|日常|早起|運動|喝水|睡眠|閱讀習慣/i];
const PSYCHOLOGY_PATTERNS = [/心理|情緒|焦慮|壓力|緊張|低落|動機|動力|拖延|不想開始|沒辦法開始|自我懷疑|自責|正念| mindfulness|溝通|鼓勵|倦怠|burnout/i];
const WRITE_PATTERNS = [/新增|建立|修改|更新|刪除|完成|取消|安排|排程|排定|加入|移除|標記|改成|調整|記下|打卡|勾選|完成習慣|幫我做|幫我改|幫我完成/i];
function matches(patterns: RegExp[], text: string) { return patterns.some((pattern) => pattern.test(text)); }
export function routeManagerRequest(message: string): RouteResult {
  const text = message.trim(); const isWork = matches(WORK_PATTERNS, text); const isResearch = matches(RESEARCH_PATTERNS, text); const isStudy = matches(STUDY_PATTERNS, text); const isPersonal = matches(PERSONAL_PATTERNS, text); const isPsychology = matches(PSYCHOLOGY_PATTERNS, text); const requiresDataWrite = matches(WRITE_PATTERNS, text);
  const specialistCount = [isWork, isStudy, isResearch, isPersonal, isPsychology].filter(Boolean).length;
  if (specialistCount > 1) {
    const delegatedAgents: AgentId[] = []; if (isWork) delegatedAgents.push('work'); if (isStudy) delegatedAgents.push('study'); if (isResearch) delegatedAgents.push('research'); if (isPersonal) delegatedAgents.push('personal'); if (isPsychology) delegatedAgents.push('psychology');
    return { primaryAgent:'manager', delegatedAgents, intent:'mixed', reason:'需求同時涉及多個生活／工作／課業／心理支持領域，由 Manager 協調專業 Agent。', requiresDataWrite };
  }
  if (isPsychology) return { primaryAgent:'psychology', delegatedAgents:['psychology'], intent:'psychology', reason:'辨識為情緒、壓力、動機、拖延、正念或溝通支持需求。', requiresDataWrite };
  if (isPersonal) return { primaryAgent:'personal', delegatedAgents:['personal'], intent:'personal', reason:'辨識為個人生活、日常習慣、打卡、備忘或生活規劃需求。', requiresDataWrite };
  if (isResearch) return { primaryAgent:'research', delegatedAgents:['research'], intent:'research', reason:'辨識為研究／論文／文獻／研究方法／研究資料分析需求。', requiresDataWrite };
  if (isWork) return { primaryAgent:'work', delegatedAgents:['work'], intent:'work', reason:'辨識為工作／專案／任務管理需求。', requiresDataWrite };
  if (isStudy) return { primaryAgent:'study', delegatedAgents:['study'], intent:'study', reason:'辨識為課業／學習管理需求。', requiresDataWrite };
  return { primaryAgent:'manager', delegatedAgents:[], intent:'general', reason:'目前無法安全判定為單一專業領域，由 Manager 直接處理。', requiresDataWrite };
}
export function buildTeamExecutionPlan(route: RouteResult): TeamExecutionPlan {
  const steps: AgentExecutionStep[] = [{ agentId:'manager', role:'manager', purpose:'分析 Owner 需求、判斷是否需要專業 Agent 協作。', status:'completed' }];
  route.delegatedAgents.forEach((agentId) => steps.push({ agentId, role:'specialist', purpose: agentId==='work'?'讀取工作 User Data，處理工作專案與任務。':agentId==='research'?'處理論文、文獻、研究方法與研究資料分析。':agentId==='study'?'讀取課業 User Data，處理學習與課業需求。':agentId==='personal'?'處理日常習慣、打卡、個人備忘與生活規劃。':'檢索 Owner 專屬心理知識，提供情緒調節、動機、拖延與溝通支持。', status:'queued' }));
  steps.push({ agentId:'manager', role:'manager', purpose:route.delegatedAgents.length?'接收專業 Agent 結果、驗證實際資料狀態並形成最終回覆。':'直接完成一般需求並回覆 Owner。', status:'queued' });
  return { route, steps, managerFinalStep:route.requiresDataWrite?'只有確認資料實際寫入成功後，Manager 才能向 Owner 宣稱已完成。':'本次以唯讀分析或自然對話為主，不得宣稱已修改資料。' };
}
router.post('/route',(req,res)=>{const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({error:'Message cannot be empty'});const route=routeManagerRequest(message);return res.json({manager:{id:'manager',name:'Manager Agent',role:'AI 總管'},...buildTeamExecutionPlan(route)});});
export default router;
