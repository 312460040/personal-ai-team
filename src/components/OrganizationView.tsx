import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Clock3, MessageSquare, RefreshCw, Users } from 'lucide-react';
import type { AgentHandoff, AgentMessage, CompanyDepartment } from '../types';
import { apiUrl } from '../services/apiBase';

const OWNER_ID = 'personal-owner';
const labels: Record<string, string> = { manager: 'Manager', work: 'Work Agent', study: 'Study Agent', schedule: 'Schedule Agent', research: 'Research Agent', brainstorm: 'Brainstorm Agent', email: 'Email Agent', finance: 'Finance Agent', social: 'Social Agent', hr: 'HR Agent' };
const statusLabel: Record<string, string> = { waiting: '等待接手', working: '處理中', completed: '已完成', return: '退回／需要補充' };

export default function OrganizationView() {
  const [departments, setDepartments] = useState<CompanyDepartment[]>([]);
  const [handoffs, setHandoffs] = useState<AgentHandoff[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(apiUrl('/api/persistence/organization/overview'), { headers: { 'X-Owner-Id': OWNER_ID } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setDepartments(data.departments || []); setHandoffs(data.handoffs || []); setMessages(data.messages || []);
    } catch (e) { setError(e instanceof Error ? e.message : '無法讀取公司協作資料'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const activeHandoffs = useMemo(() => handoffs.filter(h => h.status !== 'completed'), [handoffs]);

  return <div className="mx-auto max-w-7xl px-3 sm:px-5 pt-6 space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-medium text-[#737A75]">Personal AI Organization</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#2D322E]"><Building2 className="w-6 h-6" />虛擬公司</h1><p className="mt-1 text-sm text-[#737A75]">不同部門負責專業工作，Agent 透過共享資料與任務交接協作。</p></div>
      <button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDD8CE] bg-white px-3 py-2 text-sm font-medium hover:bg-[#F7F5F1]"><RefreshCw className="w-4 h-4" />重新整理</button>
    </div>
    {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">資料庫協作 API 尚未可用：{error}。請確認 Supabase schema 與 Server 環境變數。</div>}

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-5"><p className="text-xs font-semibold text-[#8A908B]">啟用 Agent</p><p className="mt-1 text-3xl font-bold">3</p><p className="mt-1 text-xs text-[#737A75]">Manager / Work / Study</p></div>
      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-5"><p className="text-xs font-semibold text-[#8A908B]">進行中交接</p><p className="mt-1 text-3xl font-bold">{activeHandoffs.length}</p><p className="mt-1 text-xs text-[#737A75]">跨部門任務等待處理</p></div>
      <div className="rounded-2xl border border-[#E5E2DC] bg-white p-5"><p className="text-xs font-semibold text-[#8A908B]">Agent 訊息</p><p className="mt-1 text-3xl font-bold">{messages.length}</p><p className="mt-1 text-xs text-[#737A75]">共享協作紀錄</p></div>
    </section>

    <section><div className="mb-3 flex items-center gap-2"><Users className="w-4 h-4" /><h2 className="font-bold">部門與職責</h2></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{departments.map(dept => <div key={dept.id} className="rounded-2xl border border-[#E5E2DC] bg-white p-5"><div className="flex items-center justify-between"><span className="rounded-full bg-[#EEF2EF] px-2 py-1 text-xs font-semibold">{dept.name}</span><span className="text-xs text-[#8A908B]">主管：{labels[dept.headAgent] || dept.headAgent}</span></div><p className="mt-3 text-sm font-semibold">{dept.description}</p><div className="mt-3 space-y-1">{dept.agentIds.map(id => <div key={id} className="flex items-center gap-2 text-xs text-[#666D68]"><span className="h-2 w-2 rounded-full bg-[#5C7C66]" />{labels[id] || id}</div>)}</div></div>)}</div></section>

    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#E5E2DC] bg-white overflow-hidden"><div className="border-b border-[#EBE8E1] px-5 py-4"><h2 className="font-bold flex items-center gap-2"><ArrowRight className="w-4 h-4" />任務交接</h2><p className="mt-1 text-xs text-[#8A908B]">Manager 不直接包辦所有工作，而是將任務交給最適合的部門。</p></div><div className="divide-y divide-[#F0EEE9]">{loading ? <p className="p-6 text-sm text-[#737A75]">讀取中…</p> : activeHandoffs.length === 0 ? <p className="p-6 text-sm text-[#737A75]">目前沒有待處理交接。當 Agent 開始真正跨部門工作後，這裡會留下完整紀錄。</p> : activeHandoffs.map(h => <div key={h.id} className="p-5"><div className="flex items-center gap-2 text-xs"><span className="font-semibold">{labels[h.fromAgent] || h.fromAgent}</span><ArrowRight className="w-3.5 h-3.5" /><span className="font-semibold">{labels[h.toAgent] || h.toAgent}</span><span className="ml-auto rounded-full bg-[#F3F1EC] px-2 py-1">{statusLabel[h.status] || h.status}</span></div><p className="mt-2 font-semibold">{h.title}</p><p className="mt-1 text-sm text-[#666D68]">{h.reason}</p><p className="mt-2 text-xs text-[#8A908B]">優先級：{h.priority}{h.deadline ? `｜截止：${h.deadline}` : ''}</p></div>)}</div></div>
      <div className="rounded-2xl border border-[#E5E2DC] bg-white overflow-hidden"><div className="border-b border-[#EBE8E1] px-5 py-4"><h2 className="font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4" />Agent-to-Agent Communication</h2><p className="mt-1 text-xs text-[#8A908B]">交接不是只有狀態；Agent 可以留下請求、問題與結果。</p></div><div className="divide-y divide-[#F0EEE9]">{messages.length === 0 ? <p className="p-6 text-sm text-[#737A75]">目前沒有 Agent 訊息。</p> : messages.slice(0, 12).map(m => <div key={m.id} className="p-4"><div className="flex items-center gap-2 text-xs"><span className="font-semibold">{labels[m.fromAgent] || m.fromAgent}</span><ArrowRight className="w-3 h-3" /><span className="font-semibold">{labels[m.toAgent] || m.toAgent}</span><span className="ml-auto text-[#9A9F9B]">{new Date(m.createdAt).toLocaleString('zh-TW')}</span></div><p className="mt-2 text-sm text-[#555D57]">{m.content}</p></div>)}</div></div>
    </section>
    <div className="rounded-xl border border-[#E5E2DC] bg-[#F7F5F1] p-4 text-xs text-[#737A75] flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />下一階段會讓 Manager 在實際分流時建立 Handoff，專業 Agent 完成後回報結果，再由 Manager 決定是否結案或轉交下一部門。</div>
  </div>;
}
