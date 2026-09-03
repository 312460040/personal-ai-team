export function buildGlobalTaskReview(context: any): string {
  const work = Array.isArray(context?.workTasks)
    ? context.workTasks.filter((t: any) => t?.source === 'user' && t?.status !== 'completed')
    : [];
  const study = Array.isArray(context?.studyTasks)
    ? context.studyTasks.filter((t: any) => t?.source === 'user' && t?.status !== 'completed')
    : [];
  const all = [
    ...work.map((t: any) => ({ ...t, _domain: '工作' })),
    ...study.map((t: any) => ({ ...t, _domain: '課業／研究' })),
  ];
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
    ? all.map((t: any, i: number) => `${i + 1}. **${t.title || '未命名任務'}**\n   - 類別：${t._domain}${t.projectName ? `｜專案：${t.projectName}` : ''}${t.subjectName ? `｜科目：${t.subjectName}` : ''}\n   - 狀態：**${statusLabel[t.status] || t.status || '未設定'}**｜優先級：${t.priority || '未設定'}｜預估：${t.estimatedHours ?? '未設定'}h｜截止：${t.deadline || '未設定'}\n   - 🆔 ${t.id || '無 ID'}`).join('\n\n')
    : '目前沒有未完成的使用者任務。';
  return `### 📋 全域任務審核清單\n\nManager 已跨 Workspace 讀取 User Data，本次為唯讀檢視，不會因為沒有 Project 而停止。\n\n- 💼 工作待辦：**${work.length}** 筆\n- 🎓 課業待辦：**${study.length}** 筆\n- 📊 合計未完成：**${all.length}** 筆\n\n### 任務清單\n\n${rows}\n\n### ✅ 請你審核\n請直接告訴 Manager：\n- 「留下 1、2、4」\n- 「刪除第 3 項」\n- 「第 2 項改成進行中」\n- 「全部保留，但把第 1 項設為 High」\n\n⚠️ 本次只提供清單與建議，不會自動刪除或修改任何任務。`;
}
