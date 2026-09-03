function userTasks(context: any) {
  const work = Array.isArray(context?.workTasks) ? context.workTasks.filter((t: any) => t?.source === 'user') : [];
  const study = Array.isArray(context?.studyTasks) ? context.studyTasks.filter((t: any) => t?.source === 'user') : [];
  return [...work.map((t: any) => ({ ...t, _domain: '💼 工作' })), ...study.map((t: any) => ({ ...t, _domain: '🎓 課業／研究' }))];
}

function sortTasks(tasks: any[]) {
  const weight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return [...tasks].sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0) || new Date(a.deadline || '9999-12-31').getTime() - new Date(b.deadline || '9999-12-31').getTime());
}

function checkboxRows(tasks: any[]) {
  return sortTasks(tasks).slice(0, 12).map((t, i) => `- [ ] **${i + 1}. ${t.title || '未命名任務'}**　${t._domain}\n  - 狀態：${t.status || '未設定'}｜優先級：${t.priority || '未設定'}｜截止：${t.deadline || '未設定'}｜預估：${t.estimatedHours ?? '未設定'}h\n  - 🆔 \`${t.id || '無 ID'}\``).join('\n\n');
}

export function isDailyReviewRequest(text: string) {
  return /(每日覆盤|今天覆盤|今日覆盤|我要複盤|我要覆盤|幫我複盤|回顧今天|今日回顧|日終覆盤|每天覆盤)/i.test(String(text || ''));
}

export function isTomorrowPlanRequest(text: string) {
  return /(明日規劃|明天規劃|安排明天|規劃明天|明日安排|明天安排|隔日規劃)/i.test(String(text || ''));
}

export function buildDailyReview(context: any): string {
  const tasks = userTasks(context);
  const completed = tasks.filter(t => t.status === 'completed');
  const delayed = tasks.filter(t => t.status === 'delayed');
  const active = tasks.filter(t => t.status !== 'completed');
  const candidates = sortTasks(active).slice(0, 8);
  return `### 🌙 今日每日覆盤\n\nManager 已完成跨工作與課業的 User Task 盤點。\n\n#### 今日狀況\n- ✅ 已完成：**${completed.length}**\n- 🟠 延遲：**${delayed.length}**\n- 📌 尚未完成：**${active.length}**\n\n#### 明日建議繼續\n${candidates.length ? checkboxRows(candidates) : '目前沒有需要延續的未完成任務。'}\n\n#### Owner 下一步\n請直接勾選上面的清單。**勾選代表明天繼續處理，不會立即修改任務**；送出確認後，Manager 才會依你的選擇安排明日時間。`;
}

export function buildTomorrowPlan(context: any): string {
  const tasks = userTasks(context).filter(t => t.status !== 'completed');
  const candidates = sortTasks(tasks).slice(0, 10);
  return `### ☀️ 明日規劃候選\n\nManager 先依**優先級＋截止時間＋目前狀態**提出候選，不會直接替你建立或修改日程。\n\n#### Owner 審核清單\n${candidates.length ? checkboxRows(candidates) : '目前沒有未完成任務可安排。'}\n\n#### 確認方式\n勾選你明天真的要處理的項目，送出後 Manager 才會進入**時間配置與衝突檢查**。`;
}
