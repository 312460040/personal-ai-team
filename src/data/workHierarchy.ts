export const LI_ROOT_TITLE = '李總醫療體系';
export const LI_SITES = ['立博','新仁','世博','泰安','板國','博淘'] as const;

export const LI_SITE_RULES: Record<string, RegExp[]> = {
  '立博': [/立博/i],
  '新仁': [/新仁/i],
  '世博': [/世博/i],
  '泰安': [/泰安/i],
  '板國': [/板國|板橋/i],
  '博淘': [/博淘/i],
};

export function inferLiSite(title = '', notes = ''): string | null {
  const text = `${title} ${notes}`;
  for (const site of LI_SITES) {
    if (LI_SITE_RULES[site].some(re => re.test(text))) return site;
  }
  return null;
}

export const LI_KNOWN_TASK_RULES = [
  { site: '立博', re: /立博運動員影片|立博廣告影片素材|立博[｜|].*(廣告|影片)/i },
  { site: '新仁', re: /新仁影片|新仁[｜|]/i },
  { site: '世博', re: /世博[｜|]|世博影片/i },
  { site: '板國', re: /板國影片|板國[｜|]|板橋[｜|].*廣告/i },
  { site: '泰安', re: /泰安[｜|]|泰安影片/i },
  { site: '博淘', re: /博淘[｜|]|博淘影片/i },
] as const;

export function inferLiSiteFromTask(title = '', notes = ''): string | null {
  const text = `${title} ${notes}`;
  return LI_KNOWN_TASK_RULES.find(rule => rule.re.test(text))?.site ?? inferLiSite(title, notes);
}
