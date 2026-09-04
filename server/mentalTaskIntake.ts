import { GoogleGenAI } from '@google/genai';

export type MentalTaskCategory = 'work' | 'study' | 'personal';
export interface MentalTaskItem {
  title: string;
  category: MentalTaskCategory;
  confidence: 'high' | 'medium' | 'low';
}

const CATEGORY_LABELS: Record<MentalTaskCategory, string> = {
  work: '💼 工作',
  study: '🎓 課業／研究',
  personal: '🧭 個人',
};

function looksLikeTask(text: string) {
  return /(明天|今天|今晚|待會|之後|要|需要|得|必須|幫我|記得|完成|處理|寫|做|整理|準備|安排|排定|剪輯|發文|分析|讀|念|複習|考試|論文|作業|企劃|影片|短影音|統計)/i.test(text);
}

function splitTaskChunks(message: string) {
  return message
    .replace(/[，。！？；]/g, ',')
    // 中文自然語句常用「課業上／工作上／工作方面」切換上下文；不能把兩個領域黏成同一任務。
    .replace(/\s*(課業上|課業方面|學業上|學業方面)\s*/g, ', 課業：')
    .replace(/\s*(工作上|工作方面)\s*/g, ', 工作：')
    .split(/,|、|\s*並且\s*|\s*還有\s*|\s*另外\s*|\s*以及\s*|\s*同時\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

function fallbackExtract(message: string): MentalTaskItem[] {
  if (!looksLikeTask(message)) return [];
  const result: MentalTaskItem[] = [];
  for (const chunk of splitTaskChunks(message)) {
    if (!looksLikeTask(chunk) || chunk.length < 3 || chunk.length > 80) continue;
    const study = /課業|作業|考試|考前|複習|讀書|念書|學習|科目|上課|教材|考題|學分|期中|期末|論文|文獻|研究|統計分析|paper|study|exam/i.test(chunk);
    const work = /工作|公司|客戶|主管|同事|專案|提案|簡報|行銷|企劃|社群|粉專|廣告|影片|短影音|開發|程式|程式碼|bug|api|部署|上線|會議|業務|職場|work|project/i.test(chunk);
    const category: MentalTaskCategory = study && !work ? 'study' : work && !study ? 'work' : 'personal';
    result.push({ title: chunk.replace(/^(課業：|工作：|我明天|明天|今天|今晚|待會|我需要|我還要|幫我|我要)\s*/i, '').trim(), category, confidence: study !== work ? 'medium' : 'low' });
  }
  return result.slice(0, 8);
}

export async function extractMentalTasks(message: string): Promise<MentalTaskItem[]> {
  const text = String(message || '').trim();
  if (!text || !looksLikeTask(text)) return [];
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackExtract(text);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: `你是 Personal AI Team 的 Manager「心中任務整理器」。只從 Owner 這一句話中找出 Owner 明確提到、想完成或正在記掛的任務，不得從資料庫、歷史資料或常識自行補任務。

分類規則：work=工作/公司/客戶/行銷/影片/程式等；study=課業/論文/研究/考試/複習等；personal=生活與私人事項。
若一句話包含多個任務，拆成多筆。遇到「課業上／課業方面／學業上」代表切換到 study；遇到「工作上／工作方面」代表切換到 work。保留使用者原本的任務意思，不要替任務增加不存在的期限或內容。若沒有明確任務，回傳空陣列。
只輸出 JSON：{"tasks":[{"title":"任務","category":"work|study|personal","confidence":"high|medium|low"}]}
Owner 訊息：${JSON.stringify(text)}`,
    });
    const raw = String(response.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.tasks)) return fallbackExtract(text);
    const tasks = parsed.tasks
      .filter((t: any) => t && typeof t.title === 'string' && ['work', 'study', 'personal'].includes(t.category))
      .map((t: any) => ({ title: t.title.trim(), category: t.category, confidence: ['high', 'medium', 'low'].includes(t.confidence) ? t.confidence : 'medium' }))
      .filter((t: MentalTaskItem) => t.title.length >= 2 && t.title.length <= 120)
      .slice(0, 8) as MentalTaskItem[];
    return tasks.length ? tasks : fallbackExtract(text);
  } catch (error) {
    console.warn('[Mental Task Intake] AI extraction failed; using rule fallback.', error);
    return fallbackExtract(text);
  }
}

export function formatMentalTaskSummary(tasks: MentalTaskItem[]) {
  if (!tasks.length) return '';
  const grouped: Record<MentalTaskCategory, MentalTaskItem[]> = { work: [], study: [], personal: [] };
  tasks.forEach(task => grouped[task.category].push(task));
  const sections = (Object.keys(grouped) as MentalTaskCategory[])
    .filter(category => grouped[category].length)
    .map(category => `#### ${CATEGORY_LABELS[category]}\n${grouped[category].map((task) => `- **${task.title}**　（${task.confidence}）`).join('\n')}`);
  return `### 🧠 你剛才放進 Manager 的「心中任務」\n\nManager **只根據你這一句話**整理，不會因為分類就自動建立或修改正式 Task。\n\n${sections.join('\n\n')}\n\n> 這份清單是「意圖收件匣」：先讓 Manager 知道你腦中有哪些事，再依分類交給 Work / Study / Personal；等你明確要求建立任務或排進時間，才進入正式流程。`;
}
