import React, { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '../services/apiBase';

type TableInfo = { table: string; count: number };
type TableResponse = { table: string; rows: Record<string, unknown>[] };
const TABLE_LABELS: Record<string, string> = { users: '使用者', projects: 'Projects', tasks: 'Tasks', conversations: '對話紀錄', work_records: '工作紀錄', memories: 'Memory', focus_sessions: 'Focus Session', calendar_events: 'Calendar', study_subjects: '課業科目', today_blocks: '今日時間區塊', diagnosis_records: 'Diagnosis', adaptive_proposals: 'Adaptive Proposal' };

export default function DatabaseView() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState('conversations');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headers = { 'x-owner-id': 'personal-owner' };

  const loadTables = async () => {
    setError(null);
    try { const response = await fetch(apiUrl('/api/persistence/tables'), { headers }); if (!response.ok) throw new Error(`資料庫連線失敗（HTTP ${response.status}）`); const data = await response.json(); setTables(Array.isArray(data) ? data : []); }
    catch (e) { setError(e instanceof Error ? e.message : '無法連線到資料庫 API'); }
  };
  const loadRows = async (table: string) => {
    setLoading(true); setError(null);
    try { const response = await fetch(apiUrl(`/api/persistence/tables/${encodeURIComponent(table)}?limit=100`), { headers }); if (!response.ok) throw new Error(`無法讀取 ${table}（HTTP ${response.status}）`); const data = await response.json() as TableResponse; setRows(Array.isArray(data.rows) ? data.rows : []); }
    catch (e) { setRows([]); setError(e instanceof Error ? e.message : '無法讀取資料表'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadTables(); }, []);
  useEffect(() => { if (tables.some(item => item.table === selected)) void loadRows(selected); }, [selected, tables]);
  const columns = useMemo(() => { const set = new Set<string>(); rows.forEach(row => Object.keys(row).forEach(key => set.add(key))); return Array.from(set); }, [rows]);

  return <div className="mx-auto max-w-7xl px-3 sm:px-5 pt-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-[#737A75]">PostgreSQL / Supabase</p><h1 className="mt-1 text-2xl font-bold text-[#2D322E] flex items-center gap-2"><Database className="w-6 h-6 text-[#385244]" />資料庫</h1><p className="mt-1 text-sm text-[#737A75]">唯讀查看 Personal AI Team 實際持久化資料，不直接提供 SQL 寫入。</p></div><button onClick={() => void loadTables()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDD8CE] bg-white px-3 py-2 text-sm font-medium hover:bg-[#F7F5F1]"><RefreshCw className="w-4 h-4" />重新整理</button></div>
    {error && <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertCircle className="mt-0.5 w-4 h-4 shrink-0" /><div><b>目前無法讀取資料庫</b><p className="mt-1">{error}。請確認 Render Backend 已部署，並已設定 Supabase 環境變數及執行 db/schema.sql 與 db/migrations/002_app_data_sync.sql。</p></div></div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-[230px_1fr]">
      <aside className="rounded-2xl border border-[#E5E2DC] bg-white p-3 h-fit"><p className="px-2 pb-2 text-xs font-bold uppercase tracking-widest text-[#9A9F9B]">Tables</p><div className="space-y-1">{tables.map(item => <button key={item.table} onClick={() => setSelected(item.table)} className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-left ${selected === item.table ? 'bg-[#E8EFEB] text-[#385244] font-semibold' : 'text-[#555D57] hover:bg-[#F5F3EF]'}`}><span>{TABLE_LABELS[item.table] || item.table}</span><span className="text-[10px] rounded-full bg-[#F0EEE9] px-2 py-0.5">{item.count}</span></button>)}{tables.length === 0 && !error && <p className="px-2 py-3 text-sm text-[#8A908B]">讀取資料表中…</p>}</div></aside>
      <section className="min-w-0 rounded-2xl border border-[#E5E2DC] bg-white overflow-hidden"><div className="border-b border-[#EBE8E1] px-5 py-4 flex items-center justify-between"><div><h2 className="font-bold text-[#2D322E]">{TABLE_LABELS[selected] || selected}</h2><p className="text-xs text-[#8A908B] mt-1">{selected} · {rows.length} 筆</p></div>{!loading && rows.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-[#4E6B56]"><CheckCircle2 className="w-3.5 h-3.5" />唯讀</span>}</div><div className="overflow-auto max-h-[65vh]">{loading ? <div className="p-8 text-sm text-[#737A75]">讀取資料中…</div> : rows.length === 0 ? <div className="p-8 text-sm text-[#737A75]">目前沒有資料。</div> : <table className="min-w-full text-xs"><thead className="sticky top-0 bg-[#F8F7F4]"><tr>{columns.map(column => <th key={column} className="px-4 py-3 text-left font-semibold text-[#555D57] whitespace-nowrap border-b border-[#E5E2DC]">{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-b border-[#F0EEE9] align-top hover:bg-[#FCFBF9]">{columns.map(column => <td key={column} className="px-4 py-3 text-[#555D57] max-w-[420px] whitespace-pre-wrap break-words">{typeof row[column] === 'object' && row[column] !== null ? JSON.stringify(row[column]) : String(row[column] ?? '')}</td>)}</tr>)}</tbody></table>}</div></section>
    </div>
  </div>;
}
