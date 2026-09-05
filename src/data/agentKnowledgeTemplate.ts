export type KnowledgeSourceType = 'document' | 'owner_preference' | 'conversation_learning' | 'manual_note';

export type KnowledgeEntry = {
  id: string;
  title: string;
  summary: string;
  type: KnowledgeSourceType;
  tags: string[];
  content: string;
  enabled: boolean;
  updatedAt: string;
};

export type AgentKnowledgeProfile = {
  agentId: string;
  title: string;
  purpose: string;
  learningGoals: string[];
  communicationRules: string[];
  knowledge: KnowledgeEntry[];
};

export const createKnowledgeProfile = (profile: Omit<AgentKnowledgeProfile, 'knowledge'> & { knowledge?: KnowledgeEntry[] }): AgentKnowledgeProfile => ({
  ...profile,
  knowledge: profile.knowledge ?? [],
});

export const PSYCHOLOGICAL_SUPPORT_KNOWLEDGE: AgentKnowledgeProfile = createKnowledgeProfile({
  agentId: 'psychology',
  title: '🧠 心理調節師｜知識圖書館',
  purpose: '協助 Owner 進行情緒辨識、壓力調節、行動啟動與溝通支持；重點是陪伴與協助，而不是取代專業心理或醫療服務。',
  learningGoals: ['理解 Owner 偏好的溝通與鼓勵方式', '運用提供的心理學與動機資料協助拆解卡關原因', '在工作、課業與生活壓力之間提供平衡性的建議', '把心理支持轉換成可執行、低門檻的下一步行動'],
  communicationRules: ['先理解情況，再給建議，不急著責備或說教。', '鼓勵要具體，指出已完成的事情與下一個小步驟。', '當 Owner 明顯疲憊時，優先協助降低負擔，而不是一味要求效率。', '遇到嚴重或持續的心理困擾時，明確建議尋求合格的心理或醫療專業協助。'],
  knowledge: [
    { id: 'psychology-communication-template', title: 'Owner 溝通偏好｜範例模板', summary: '可由 Owner 持續修改，讓心理調節師學習最適合的回應方式。', type: 'owner_preference', tags: ['溝通', '鼓勵', 'Owner Preference'], content: '我希望 AI 在我拖延時先幫我找原因，再把任務拆小；完成事情時給予具體正向回饋；不要使用責備或羞辱式語氣。', enabled: true, updatedAt: new Date().toISOString() },
    { id: 'psychology-motivation-note', title: '動機與行動啟動｜知識入口', summary: '放入與動機、拖延、壓力、行動啟動相關的文件或筆記。', type: 'manual_note', tags: ['動機', '拖延', '行動啟動'], content: '此處提供資料入口。Owner 可上傳 PDF、文件或直接建立筆記，之後由知識檢索系統提供給心理調節師。', enabled: true, updatedAt: new Date().toISOString() },
  ],
});

export const KNOWLEDGE_LIBRARY_TEMPLATE: AgentKnowledgeProfile = createKnowledgeProfile({
  agentId: 'template', title: '📚 AI 員工｜知識圖書館模板', purpose: '每個 AI 員工都使用相同的知識管理格式，依職務替換內容即可。',
  learningGoals: ['建立此員工的專業知識範圍', '累積 Owner 指定的資料', '記錄 Owner 偏好與有效的溝通方式'],
  communicationRules: ['只使用與自身職責相關的知識', '優先使用 Owner 指定且啟用中的資料', '無資料支持時，不假裝已經學會'],
});

export const AGENT_KNOWLEDGE_LIBRARY: Record<string, AgentKnowledgeProfile> = {
  psychology: PSYCHOLOGICAL_SUPPORT_KNOWLEDGE,
  manager: createKnowledgeProfile({ agentId: 'manager', title: '🧭 Manager｜知識圖書館', purpose: '管理公司規則、Owner 偏好與跨部門協作知識。', learningGoals: ['理解公司運作規則', '理解 Owner 的決策偏好', '掌握跨 Agent 協作規範'], communicationRules: ['以整合與決策為主', '需要專業判斷時交給對應 Agent'] }),
  work: createKnowledgeProfile({ agentId: 'work', title: '💼 Work Agent｜知識圖書館', purpose: '累積工作 SOP、專案規範與職場知識。', learningGoals: ['工作 SOP', '專案方法', 'Owner 工作習慣'], communicationRules: ['以工作目標與交付成果為核心'] }),
  study: createKnowledgeProfile({ agentId: 'study', title: '🎓 Study Agent｜知識圖書館', purpose: '累積課程教材、學習方法與考試資料。', learningGoals: ['課程教材', '學習方法', '考試重點'], communicationRules: ['依教材與 Owner 學習目標提供協助'] }),
  research: createKnowledgeProfile({ agentId: 'research', title: '🔬 Research Agent｜知識圖書館', purpose: '累積論文、研究方法、資料分析與研究筆記。', learningGoals: ['研究文獻', '研究方法', '資料分析'], communicationRules: ['區分來源內容、推論與尚未驗證的資訊'] }),
  personal: createKnowledgeProfile({ agentId: 'personal', title: '🌱 Personal Agent｜知識圖書館', purpose: '累積生活規劃、習慣與 Owner 個人偏好。', learningGoals: ['生活習慣', '個人偏好', '日常規劃'], communicationRules: ['生活資料與工作、課業資料分開'] }),
};
