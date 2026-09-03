type ReviewMode = 'global' | 'daily_review' | 'tomorrow_plan';

export function buildGlobalTaskReview(context: any, mode: ReviewMode = 'global'): string {
  const workAll = Array.isArray(context?.workTasks) ? context.workTasks.filter((t: any) => t?.source === 'user') : [];
  const studyAll = Array.isArray(context?.studyTasks) ? context.studyTasks.filter((t: any) => t?.source === 'user') : [];
  const pending = (t: any) => t?.status !== 'completed';
  const workPending = workAll.filter(pending);
  const studyPending = studyAll.filter(pending);
  const all = [
    ...workPending.map((t: any) => ({ ...t, _domain: '工作' })),
    ...studyPending.map((t: any) => ({ ...t, _domain: '課業／研究' })),
  ];
  const completed = [...workAll.filter((t:any)=>t?.status==='completed').map((t:any)=>({...t,_domain:'工作'})), ...studyAll.filter((t:any)=>t?.status==='completed').map((t:any)=>({...t,_domain:'課業／研究'}))];
  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const statusLabel: Record<string, string> = { todo: '待辦', in_progress: '進行中', delayed: '延遲', completed: '已完成' };
  all.sort((a: any, b: any) => {
    const p = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    if (p) return p;
    const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return ad - bd;
  });

  const rows = all.length
    ? all.map((t: any, i: number) => `- [ ] **${i + 1}. ${t.title || '未命名任務'}**\n  - 類別：${t._domain}${t.projectName ? `｜專案：${t.projectName}` : ''}${t.subjectName ? `｜科目：${t.subjectName}` : ''}\n  - 狀態：**${statusLabel[t.status] || t.status || '未設定'}**｜優先級：${t.priority || '未設定'}｜預估：${t.estimatedHours ?? '未設定'}h｜截止：${t.deadline || '未設定'}\n  - 🆔 \`${t.id || '無 ID'}\``).join('\n\n')
    : '目前沒有未完成的使用者任務。';

  if (mode === 'daily_review') {
    const delayed = all.filter((t:any)=>t.status==='delayed');
    const active = all.filter((t:any)=>t.status==='in_progress');
    const reviewRows = all.length ? all.map((t:any,i:number)=>`- [ ] **${i+1}. ${t.title || '未命名任務'}** — ${t._domain}｜${statusLabel[t.status] || '未設定'}｜${t.priority || '未設定'}優先`).join('\n') : '目前沒有未完成的使用者任務。';
    return `### 🌙 每日覆盤\n\nManager 已跨工作與課業整理目前 User Data。這次先做「狀態覆盤」，不直接修改任務。\n\n- ✅ 已完成：**${completed.length}** 筆\n- 🔄 進行中：**${active.length}** 筆\n- ⚠️ 延遲：**${delayed.length}** 筆\n- 📌 尚未完成：**${all.length}** 筆\n\n### ☑️ 明日延續候選\n\n${reviewRows}\n\n### Owner 請確認\n勾選代表「明天繼續／安排」，取消勾選代表「明天先不排」。這只是建議，不會自動修改任務。`;
  }

  if (mode === 'tomorrow_plan') {
    return `### ☀️ 隔日規劃\n\nManager 已根據目前工作與課業任務，整理明日候選清單。\n\n- 💼 工作待辦：**${workPending.length}** 筆\n- 🎓 課業待辦：**${studyPending.length}** 筆\n- 📊 候選合計：**${all.length}** 筆\n\n### ☑️ 明日候選任務\n\n${rows}\n\n### Owner 請確認\n勾選代表「明天安排」，取消勾選代表「明天暫不安排」。確認後 Manager 才能進一步排時間；本次不會自動修改任務。`;
  }

  return `### 📋 全域任務審核清單\n\nManager 已跨 Workspace 讀取 User Data，本次為唯讀檢視，不會因為沒有 Project 而停止。\n\n- 💼 工作待辦：**${workPending.length}** 筆\n- 🎓 課業待辦：**${studyPending.length}** 筆\n- 📊 合計未完成：**${all.length}** 筆\n\n### ☑️ Owner 審核清單\n\n${rows}\n\n### 下一步\n勾選代表「保留／明天繼續」，取消勾選代表「暫不安排」。\n\n⚠️ 本次為唯讀建議，不會自動刪除或修改任何任務；正式修改仍需 Owner 明確確認。`;
}
