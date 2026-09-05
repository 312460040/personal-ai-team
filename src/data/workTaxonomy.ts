export interface WorkTaxonomyItem {
  category: string;
  item: string;
  description: string;
  keywords: string[];
}

export const WORK_TAXONOMY: WorkTaxonomyItem[] = [
  { category: '美術編輯', item: '社群圖文', description: '將複雜的衛教文章或長篇文字資訊轉化為易讀的懶人包、圖表或社群多頁圖文。', keywords: ['社群', '貼文圖片', '懶人包', '圖文', '資訊圖', '衛教'] },
  { category: '美術編輯', item: '平面設計', description: '製作具吸引力的活動主視覺、實體海報或數位廣告 Banner。', keywords: ['平面設計', '海報', 'banner', '主視覺', '視覺設計'] },
  { category: '美術編輯', item: '廣告文宣', description: '針對廣告投放需求製作客製化文宣，強化視覺資訊接收。', keywords: ['廣告文宣', '廣告素材', '宣傳圖', '廣告設計'] },
  { category: '美術編輯', item: 'LED文宣製作', description: '製作 LED 螢幕播放所需的宣傳素材。', keywords: ['LED', '跑馬燈', '螢幕文宣', 'LED文宣'] },
  { category: '多媒體短影音', item: '腳本構想', description: '規劃影片敘事邏輯、分鏡畫面與對白內容。', keywords: ['腳本', '分鏡', '影片企劃', '短影音腳本'] },
  { category: '多媒體短影音', item: '現場拍攝', description: '負責攝影器材架設、收音控制與動態畫面拍攝。', keywords: ['拍攝', '攝影', '錄影', '收音', '現場拍攝'] },
  { category: '多媒體短影音', item: '後製剪輯', description: '進行素材修剪、調色、字幕添加與音效混製。', keywords: ['剪輯', '後製', '字幕', '調色', '音效', '影片後製'] },
  { category: '現場活動企劃', item: '活動辦理', description: '執行活動流程控管、物資準備與進場撤場協作。', keywords: ['活動辦理', '活動執行', '流程控管', '物資', '撤場'] },
  { category: '現場活動企劃', item: '現場溝通', description: '擔任協調橋樑，處理工作人員與參與者即時需求。', keywords: ['現場溝通', '協調', '廠商', '工作人員', '參與者'] },
  { category: '現場活動企劃', item: 'LED現場更新', description: '依活動現場需求即時更新 LED 顯示內容。', keywords: ['LED更新', '現場更新', '字幕更新', '螢幕更新'] },
  { category: '現場活動企劃', item: '設備架設、攝影', description: '負責活動現場所需設備、會議監督與現場錄影等工作。', keywords: ['設備架設', '器材', '會議監督', '活動攝影', '現場器材'] },
  { category: '行銷企劃', item: '廣告投放', description: '操作數位廣告平台，精準鎖定受眾以提升內容曝光度。', keywords: ['廣告投放', '投放', 'Meta廣告', 'Google廣告', '廣告平台'] },
  { category: '行銷企劃', item: '成效追蹤', description: '分析社群後台統計數據，產出結果報告並提出優化建議。', keywords: ['成效', '數據分析', '報告', 'KPI', '成效追蹤', '後台數據'] },
  { category: '行銷企劃', item: '文案構想', description: '撰寫吸引人的標題與內文，引發受眾情感共鳴。', keywords: ['文案', '標題', '貼文', '內容企劃', '文案構想'] },
  { category: '行銷企劃', item: '構想行銷企劃', description: '行銷策略與活動主題的發想與規劃。', keywords: ['行銷企劃', '行銷策略', '活動主題', '企劃案', '策略'] },
  { category: '行銷企劃', item: '專案管理、進度追蹤', description: '管理專案品質與時程進度，監督成員執行狀況，確保階段任務按時達成。', keywords: ['專案管理', '進度追蹤', '專案進度', '時程', '追蹤任務'] },
  { category: '網站管理', item: '網站維護', description: '監控網站運行狀態，處理資料更新與基本錯誤排解。', keywords: ['網站維護', '網站更新', '錯誤排解', 'HTML', '網站'] },
  { category: '網站管理', item: '優化構想', description: '提出版面與功能上的改進計畫，進行 SEO 優化。', keywords: ['SEO', '網站優化', '版面優化', '功能優化'] },
  { category: '網站管理', item: 'Google 商務維護', description: '經營商家資訊、回覆評論並更新最新動態圖片。', keywords: ['Google商家', 'Google 商務', '評論', '商家資訊', 'Google地圖'] },
  { category: '社群管理', item: '分享社團', description: '將適合的內容分享至相關社團與社群。', keywords: ['分享社團', '社團', '社群分享', '轉貼'] },
  { category: '社群管理', item: '定期發文', description: '依內容排程持續發布社群貼文。', keywords: ['定期發文', '發文排程', '社群排程', '發布貼文'] },
  { category: '社群管理', item: '客服回覆', description: '處理 Google 評論、Facebook 私訊、FB 貼文留言與 LINE 回覆。', keywords: ['客服', '回覆', 'Google評論', 'Facebook私訊', '留言', 'LINE'] },
  { category: '社群管理', item: '資訊優化', description: '整理社群與對外資訊，使內容更清楚、一致且容易被找到。', keywords: ['資訊優化', '資訊整理', '社群資訊', '內容優化'] },
];

export function classifyWorkTaskCategory(title: string, notes = ''): WorkTaxonomyItem | null {
  const text = `${title} ${notes}`.toLowerCase();
  let best: WorkTaxonomyItem | null = null;
  let bestScore = 0;

  for (const item of WORK_TAXONOMY) {
    const score = item.keywords.reduce((total, keyword) => total + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return best;
}

export function workTaxonomyPrompt(): string {
  return WORK_TAXONOMY.map((item) => `- ${item.category}｜${item.item}：${item.description}`).join('\n');
}
