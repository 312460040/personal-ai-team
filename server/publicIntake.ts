import { GoogleGenAI } from '@google/genai';

export type PublicIntakeCategory = 'work' | 'study' | 'personal';

export interface PublicIntakeResult {
  category: PublicIntakeCategory;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  projectId: string | null;
  method: 'ai' | 'rule_fallback';
}

const DOMAIN_LABELS: Record<PublicIntakeCategory, string> = {
  work: '工作',
  study: '課業／研究',
  personal: '個人規劃',
};

/**
 * The Public Area is the Manager's intake desk.
 *
 * Primary path: semantic classification by the Manager model.
 * Fallback path: deterministic rules, used only when the model is unavailable
 * or returns an invalid result. Rules are a safety net, not the product's
 * primary understanding mechanism.
 *
 * Important: classification never invents a project. A work project is only
 * selected when the request contains a unique literal project-name match from
 * the user's own project list.
 */
export async function classifyPublicRequest(message: string, workProjects: any[] = []): Promise<PublicIntakeResult> {
  const text = String(message || '').trim();
  const aiResult = await classifyWithManagerAI(text);
  const base = aiResult || classifyWithRules(text);

  let projectId: string | null = null;
  if (base.category === 'work' && Array.isArray(workProjects)) {
    const lower = text.toLowerCase();
    const candidates = workProjects
      .filter((p) => p?.source === 'user' && p?.id && p?.title)
      .filter((p) => lower.includes(String(p.title).toLowerCase()));
    if (candidates.length === 1) projectId = candidates[0].id;
  }

  const reason = base.category === 'work'
    ? `${base.reason}${projectId ? `，並唯一匹配使用者專案「${workProjects.find((p) => p.id === projectId)?.title || projectId}」` : '；目前沒有安全可唯一匹配的專案'}`
    : base.reason;

  return { ...base, reason, projectId };
}

async function classifyWithManagerAI(message: string): Promise<Omit<PublicIntakeResult, 'projectId' | 'method'> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !message) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: `你是 Personal AI Team 的 Manager Agent，負責公共區（總收件匣）的第一層語意分流。

請根據使用者真正想處理的事情判斷它最適合進入哪個工作空間：
- work：公司、客戶、主管、行銷、企劃、程式開發、專案、工作任務等職場事項。
- study：課業、考試、複習、讀書、論文、研究、文獻、研究方法等學習事項。
- personal：生活安排、健康習慣、休息、旅行、家庭、個人目標、日程等私人事項。

不要要求使用者提供分類關鍵字；要理解語意與上下文。
若內容同時涉及多個領域，選擇「主要目的」所在的領域。
若只是一般聊天或資訊詢問且沒有明確工作／課業／個人任務脈絡，選 personal，confidence=low。

只輸出 JSON，不要 Markdown：
{"category":"work|study|personal","confidence":"high|medium|low","reason":"一句繁體中文說明"}

使用者訊息：${JSON.stringify(message)}`,
    });
    const raw = String(response.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(raw);
    if (!['work', 'study', 'personal'].includes(parsed.category)) return null;
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
  const label = DOMAIN_LABELS[result.category];
  return `Public Area Manager routing decision: category=${result.category}; label=${label}; confidence=${result.confidence}; method=${result.method}; projectId=${result.projectId || 'none'}; reason=${result.reason}`;
}
