import { GoogleGenAI } from '@google/genai';

export type PublicIntakeCategory = 'work' | 'study' | 'personal' | 'global';
export type PublicManagerMode = 'normal' | 'daily_review' | 'tomorrow_plan';
export interface PublicIntakeResult { category: PublicIntakeCategory; confidence: 'high'|'medium'|'low'; reason: string; projectId: string|null; method: 'ai'|'rule_fallback'; mode: PublicManagerMode; }
const DOMAIN_LABELS: Record<PublicIntakeCategory,string> = { work:'工作', study:'課業／研究', personal:'個人規劃', global:'全域任務管理' };

export async function classifyPublicRequest(message:string, workProjects:any[]=[]):Promise<PublicIntakeResult>{
 const text=String(message||'').trim();
 const mode=detectManagerMode(text);
 // Review/planning is a Manager-level cross-domain operation. It must be
 // checked before Gemini so the request is never downgraded to personal/work/study.
 if(mode!=='normal') return {category:'global',confidence:'high',reason:mode==='daily_review'?'這是每日覆盤需求，Manager 應跨工作與課業整理今日狀態，再提出明日延續事項。':'這是隔日規劃需求，Manager 應跨工作與課業提出明日候選任務，交由 Owner 勾選確認。',projectId:null,method:'rule_fallback',mode};
 if(isGlobalTaskReviewRequest(text)) return {category:'global',confidence:'high',reason:'這是跨工作與課業的全域任務檢視／整理需求，不應受單一 Project Context 限制。',projectId:null,method:'rule_fallback',mode};
 const aiResult=await classifyWithManagerAI(text); const base=aiResult||classifyWithRules(text); let projectId:string|null=null;
 if(base.category==='work'&&Array.isArray(workProjects)){const lower=text.toLowerCase();const c=workProjects.filter(p=>p?.source==='user'&&p?.id&&p?.title).filter(p=>lower.includes(String(p.title).toLowerCase()));if(c.length===1)projectId=c[0].id;}
 const reason=base.category==='work'?`${base.reason}${projectId?`，並唯一匹配使用者專案「${workProjects.find(p=>p.id===projectId)?.title||projectId}」`:'；目前沒有安全可唯一匹配的專案'}`:base.reason;
 return {...base,reason,projectId,mode};
}

function detectManagerMode(message:string):PublicManagerMode{
 const text=String(message||'').trim();
 if(/每日覆盤|今日覆盤|今天覆盤|回顧今天|今日回顧|每天覆盤|日終覆盤/i.test(text)) return 'daily_review';
 if(/隔日規劃|明日規劃|明天規劃|安排明天|規劃明天|明日安排|明天安排/i.test(text)) return 'tomorrow_plan';
 return 'normal';
}

function isGlobalTaskReviewRequest(message:string){
 const text=String(message||'').trim();
 const hasGlobalScope=/(目前|現在|所有|全部|現有|全部的|所有的)/i.test(text);
 const hasTaskConcept=/(任務|待辦|工作|課業|事項|task|todo)/i.test(text);
 const hasReviewIntent=/(整理|盤點|清單|總覽|審核|檢視|檢查|留下|保留|刪除|狀態|哪些|需要)/i.test(text);
 if(hasGlobalScope&&hasTaskConcept&&hasReviewIntent) return true;
 if(/給我.{0,20}(審核|檢視|總覽|清單).{0,20}(任務|待辦|工作|課業)/i.test(text)) return true;
 if(/(任務|待辦).{0,20}(整理|盤點|總覽|清單).{0,20}(審核|留下|保留|刪除|狀態)/i.test(text)) return true;
 return false;
}

async function classifyWithManagerAI(message:string):Promise<Omit<PublicIntakeResult,'projectId'|'method'|'mode'>|null>{const apiKey=process.env.GEMINI_API_KEY;if(!apiKey||!message)return null;try{const ai=new GoogleGenAI({apiKey});const response=await ai.models.generateContent({model:process.env.GEMINI_MODEL||'gemini-2.5-flash',contents:`你是 Personal AI Team Manager。請判斷 work=工作、study=課業研究、personal=私人生活、global=跨工作與課業的全域任務管理。若使用者要求目前所有任務、全部待辦、整理任務給審核、盤點哪些任務要留下與狀態，必須選 global。這是唯讀總覽，不需要指定單一 Project。只輸出 JSON：{"category":"work|study|personal|global","confidence":"high|medium|low","reason":"一句繁體中文說明"}\n使用者訊息：${JSON.stringify(message)}`});const raw=String(response.text||'').trim().replace(/^```json\s*/i,'').replace(/```$/i,'').trim();const p=JSON.parse(raw);if(!['work','study','personal','global'].includes(p.category)||!['high','medium','low'].includes(p.confidence)||typeof p.reason!=='string')return null;return {category:p.category,confidence:p.confidence,reason:p.reason.trim(),method:'ai'};}catch(e){console.warn('[Public Intake] Manager AI classification failed; using rule fallback.',e);return null;}}
function classifyWithRules(message:string):Omit<PublicIntakeResult,'projectId'|'mode'>{const text=String(message||'').trim();const study=/課業|作業|考試|考前|複習|讀書|念書|學習|科目|上課|教材|考題|學分|期中|期末|論文|文獻|研究|研究方法|paper|study|exam|review/i.test(text);const personal=/生活|個人|私人|休息|睡眠|運動|健身|吃飯|飲食|旅行|旅遊|約會|家庭|家裡|購物|採買|習慣|目標|時間安排|日程|行程/i.test(text);const work=/工作|公司|客戶|主管|老闆|同事|專案|提案|簡報|行銷|企劃|社群|粉專|廣告|影片|短影音|開發|程式|程式碼|bug|api|PR|commit|部署|上線|會議|業務|職場|work|project/i.test(text);if(work&&!study)return{category:'work',confidence:'medium',reason:'AI 分類服務暫不可用，依工作語意規則判斷。',method:'rule_fallback'};if(study&&!work)return{category:'study',confidence:'medium',reason:'AI 分類服務暫不可用，依課業／研究語意規則判斷。',method:'rule_fallback'};if(personal&&!work&&!study)return{category:'personal',confidence:'medium',reason:'AI 分類服務暫不可用，依個人規劃語意判斷。',method:'rule_fallback'};if(work&&study)return{category:'work',confidence:'low',reason:'內容同時出現工作與學習語意，暫以主要工作脈絡處理。',method:'rule_fallback'};return{category:'personal',confidence:'low',reason:'未偵測到明確領域訊號，先由 Manager 以個人規劃脈絡處理。',method:'rule_fallback'};}
export function buildPublicRoutingInstruction(result:PublicIntakeResult){return `Public Area Manager routing decision: category=${result.category}; mode=${result.mode}; label=${DOMAIN_LABELS[result.category]}; confidence=${result.confidence}; method=${result.method}; projectId=${result.projectId||'none'}; reason=${result.reason}`;}
