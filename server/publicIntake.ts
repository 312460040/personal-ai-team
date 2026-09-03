import { GoogleGenAI } from '@google/genai';

export type PublicIntakeCategory = 'work' | 'study' | 'personal' | 'global';

export interface PublicIntakeResult {
  category: PublicIntakeCategory;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  projectId: string | null;
  method: 'ai' | 'rule_fallback';
}

const DOMAIN_LABELS: Record<PublicIntakeCategory, string> = {
  work: '工作', study: '課業／研究', personal: '個人規劃', global: '全域任務管理',
};

export async function classifyPublicRequest(message: string, workProjects: any[] = []): Promise<PublicIntakeResult> {
  const text = String(message || '').trim();
  if (isGlobalTaskReviewRequest(text)) {
    return {
      category: 'global', confidence: 'high',
      reason: '這是跨工作與課業的全域任務檢視／整理需求，不應受單一 Project Context 限制。',
      projectId: null, method: 'rule_fallback',
    };
  }
  const aiResult = await classifyWithManagerAI(text);
  const base = aiResult || classifyWithRules(text);
  let projectId: string | null = null;
  if (base.category === 'work' && Array.isArray(workProjects)) {
    const lower = text.toLowerCase();
    const candidates = workProjects.filter((p) => p?.source === 'user' && p?.id && p?.title)
      .filter((p) => lower.includes(String(p.title).toLowerCase()));
    if (candidates.length === 1) projectId = candidates[0].id;
  }
  const reason = base.category === 'work'
    ? `${base.reason}${projectId ? `，並唯一匹配使用者專案「${workProjects.find((p) => p.id === projectId)?.title || projectId}」` : '；目前沒有安全可唯一匹配的專案'}`
    : base.reason;
  return { ...base, reason, projectId };
}

function isGlobalTaskReviewRequest(message: string): boolean {
  return /(目前|現在|所有|全部|現有).{0,12}(任務|待辦|工作|課業)|整理.{0,12}(所有|全部|目前|現在).{0,12}(任務|待辦)|任務.{0,12}(整理|清單|盤點).{0,12}(審核|留下|刪除|保留)|給我.{0,12}(審核|檢視).{0,12}(任務|待辦)/i.test(message);
}

async function classifyWithManagerAI(message: string): Promise<Omit<PublicIntakeResult, 'projectId' | 'method'> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !message) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: `你是 Personal AI Team 的 Manager Agent，負責公共區（總收件匣）的第一層語意分流。
請判斷使用者真正想處理的事情：work=工作、study=課業研究、personal=私人生活、global=跨工作與課業的全域任務管理。
如果使用者要求「目前所有任務／全部待辦／整理任務給我審核／盤點哪些任務要留下與狀態」，必須選 global，因為這是跨 Project 的唯讀總覽，不需要指定單一專案。
若內容同時涉及多個領域，global 優先用於任務總覽；只有針對特定工作內容時才選 work。
只輸出 JSON：{"category":"work|study|personal|global","confidence":"high|medium|low","reason":"一句繁體中文說明"}
使用者訊息：${JSON.stringify(message)}`,
    });
    const raw = String(response.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(raw);
    if (!['work', 'study', 'personal', 'global'].includes(parsed.category)) return null;
    if (!['high', 'medium', 'low'].includes(parsed.confidence)) return null;
    if (typeof parsed.reason !== 'string' || !parsed.reason.trim()) return null;
    return { category: parsed.category, confidence: parsed.confidence, reason: parsed.reason.trim(), method: 'ai' };
  } catch (error) {
    console.warn('[Public Intake] Manager AI classification failed; using rule fallback.', error);
    return null;
  }
}

function classifyWithRules(message: string): Omit<PublicIntakeResult, 'projectId'> {
  const text = String(message || '').trim();
  const study = /課業|作業|考試|考前|複習|讀書|念書|學習|科目|上課|教材|考題|學分|期中|期末|論文|文獻|研究|研究方法|paper|study|exam|review/i.test(text);
  const personal = /生活|個人|私人|休息|睡眠|運動|健身|吃飯|飲食|旅行|旅遊|約會|家庭|家裡|購物|採買|習慣|目標|時間安排|日程|行程/i.test(text);
  const work = /工作|公司|客戶|主管|老闆|同事|專案|提案|簡報|行銷|企劃|社群|粉專|廣告|影片|短影音|開發|程式|程式碼|bug|api|PR|commit|部署|上線|會議|業務|職場|work|project/i.test(text);
  if (work && !study) return { category: 'work', confidence: 'medium', reason: 'AI 分類服務暫不可用，依工作語意規則判斷。', method: 'rule_fallback' };
  if (study && !work) return { category: 'study', confidence: 'medium', reason: 'AI 分類服務暫不可用，依課業／研究語意規則判斷。', method: 'rule_fallback' };
  if (personal && !work && !study) return { category: 'personal', confidence: 'medium', reason: 'AI 分類服務暫不可用，依個人規劃語意規則判斷。', method: 'rule_fallback' };
  if (work && study) return { category: 'work', confidence: 'low', reason: '內容同時出現工作與學習語意，暫以主要工作脈絡處理，等待 Manager 後續判斷。', method: 'rule_fallback' };
  return { category: 'personal', confidence: 'low', reason: '未偵測到明確領域訊號，先由 Manager 以個人規劃脈絡處理。', method: 'rule_fallback' };
}

export function buildPublicRoutingInstruction(result: PublicIntakeResult): string {
  return `Public Area Manager routing decision: category=${result.category}; label=${DOMAIN_LABELS[result.category]}; confidence=${result.confidence}; method=${result.method}; projectId=${result.projectId || 'none'}; reason=${result.reason}`;
}
