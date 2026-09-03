import React, { useMemo, useState } from 'react';
import { Plus, MessageSquare, Users, Settings2, Briefcase, GraduationCap, FolderPlus, UserPlus, ChevronRight } from 'lucide-react';
import { AiTeamChat } from './AiTeamChat';
import type { AgentInfo, ChatMessage, StructuredTimeBlock } from '../types';

type ChatCategory = { id: string; name: string; icon: string };
type ChatRoom = { id: string; categoryId: string; name: string; description?: string; agentIds: string[] };
type CustomAgent = { id: string; name: string; roleName: string; categoryId: string; tagline: string };

const CATEGORY_KEY = 'ait_chat_categories_v1';
const ROOM_KEY = 'ait_chat_rooms_v1';
const CUSTOM_AGENT_KEY = 'ait_custom_agents_v1';

const defaultCategories: ChatCategory[] = [
  { id: 'work', name: '工作', icon: '💼' },
  { id: 'study', name: '課業', icon: '🎓' },
  { id: 'research', name: '研究', icon: '🔬' },
  { id: 'personal', name: '個人', icon: '🏠' },
];

const defaultRooms: ChatRoom[] = [
  { id: 'room-work-general', categoryId: 'work', name: '工作總管', description: '工作安排、優先級與進度', agentIds: ['manager', 'work'] },
  { id: 'room-study-general', categoryId: 'study', name: '課業規劃', description: '課業、複習與學習進度', agentIds: ['manager', 'study'] },
  { id: 'room-research-general', categoryId: 'research', name: '研究討論', description: '論文、文獻與研究問題', agentIds: ['manager', 'study'] },
  { id: 'room-personal-general', categoryId: 'personal', name: '個人規劃', description: '生活與個人安排', agentIds: ['manager'] },
];

const readList = <T,>(key: string, fallback: T[]): T[] => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
};

interface Props {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onApplyScheduleToToday: (blocks: StructuredTimeBlock[]) => void;
  currentActiveAgents: string[];
  agentRegistry: AgentInfo[];
}

export const ChatWorkspace: React.FC<Props> = (props) => {
  const [categories, setCategories] = useState(() => readList(CATEGORY_KEY, defaultCategories));
  const [rooms, setRooms] = useState(() => readList(ROOM_KEY, defaultRooms));
  const [customAgents, setCustomAgents] = useState(() => readList<CustomAgent>(CUSTOM_AGENT_KEY, []));
  const [selectedRoomId, setSelectedRoomId] = useState('room-work-general');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];
  const selectedCategory = categories.find(c => c.id === selectedRoom?.categoryId);
  const selectedAgents = useMemo(() => {
    const builtIn = props.agentRegistry.filter(a => selectedRoom?.agentIds.includes(a.id));
    const custom = customAgents.filter(a => selectedRoom?.agentIds.includes(a.id));
    return [...builtIn, ...custom];
  }, [props.agentRegistry, customAgents, selectedRoom]);

  const persist = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

  const addCategory = () => {
    const name = window.prompt('新增 AI 團隊分類名稱，例如：財務、健康、創作');
    if (!name?.trim()) return;
    const item = { id: `category-${Date.now()}`, name: name.trim(), icon: '✨' };
    const next = [...categories, item]; setCategories(next); persist(CATEGORY_KEY, next);
  };

  const addRoom = (categoryId: string) => {
    const name = window.prompt('聊天室名稱，例如：A 客戶｜短影音');
    if (!name?.trim()) return;
    const room = { id: `room-${Date.now()}`, categoryId, name: name.trim(), description: '新的專屬工作脈絡', agentIds: ['manager'] };
    const next = [...rooms, room]; setRooms(next); persist(ROOM_KEY, next); setSelectedRoomId(room.id);
  };

  const addAgent = () => {
    const name = window.prompt('AI 員工姓名，例如：Lily');
    if (!name?.trim()) return;
    const roleName = window.prompt('職位，例如：內容企劃') || '專案助理';
    const agent = { id: `custom-agent-${Date.now()}`, name: name.trim(), roleName: roleName.trim(), categoryId: selectedRoom?.categoryId || 'personal', tagline: 'Owner 自訂 AI 員工' };
    const next = [...customAgents, agent]; setCustomAgents(next); persist(CUSTOM_AGENT_KEY, next);
  };

  const inviteAgent = (agentId: string) => {
    if (!selectedRoom || selectedRoom.agentIds.includes(agentId)) return;
    const next = rooms.map(r => r.id === selectedRoom.id ? { ...r, agentIds: [...r.agentIds, agentId] } : r);
    setRooms(next); persist(ROOM_KEY, next);
  };

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-4 py-3 h-[calc(100vh-5rem)] flex gap-3">
      <aside className="hidden md:flex w-64 shrink-0 flex-col rounded-2xl border border-[#E5E2DC] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#EBE8E1]">
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-bold">AI Team 聊天室</div><div className="text-[10px] text-[#8C938D]">依工作領域管理對話</div></div>
            <button onClick={() => addRoom(selectedCategory?.id || 'personal')} className="p-2 rounded-lg hover:bg-[#F3F1ED]" title="新增聊天室"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {categories.map(category => {
            const categoryRooms = rooms.filter(r => r.categoryId === category.id);
            const isCollapsed = collapsed[category.id];
            return <div key={category.id} className="mb-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <button onClick={() => setCollapsed(v => ({ ...v, [category.id]: !v[category.id] }))} className="flex items-center gap-2 text-xs font-bold text-[#555D57]">
                  <span>{category.icon}</span><span>{category.name}</span><ChevronRight className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                </button>
                <button onClick={() => addRoom(category.id)} className="p-1 rounded hover:bg-[#F3F1ED]" title="新增聊天室"><Plus className="w-3 h-3" /></button>
              </div>
              {!isCollapsed && categoryRooms.map(room => <button key={room.id} onClick={() => setSelectedRoomId(room.id)} className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl mb-0.5 ${selectedRoomId === room.id ? 'bg-[#E8EFEB] text-[#385244]' : 'text-[#555D57] hover:bg-[#F7F5F1]'}`}>
                <MessageSquare className="w-3.5 h-3.5 shrink-0" /><span className="text-xs truncate">{room.name}</span>
              </button>)}
            </div>;
          })}
          <button onClick={addCategory} className="w-full mt-2 px-2.5 py-2 rounded-xl border border-dashed border-[#D8D4CA] text-xs text-[#737A75] hover:bg-[#F8F7F4] flex items-center gap-2"><FolderPlus className="w-3.5 h-3.5" />新增分類</button>
        </div>
        <div className="p-2 border-t border-[#EBE8E1]">
          <button onClick={addAgent} className="w-full px-2.5 py-2 rounded-xl text-xs text-[#555D57] hover:bg-[#F3F1ED] flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" />建立自訂 AI 員工</button>
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col rounded-2xl border border-[#E5E2DC] bg-[#FDFCFB] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E2DC] bg-white flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><span>{selectedCategory?.icon || '💬'}</span><h1 className="text-sm font-bold truncate">{selectedRoom?.name || '聊天室'}</h1><span className="text-[10px] text-[#8C938D]">{selectedCategory?.name}</span></div><p className="text-[10px] text-[#8C938D] truncate">{selectedRoom?.description}</p></div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F3F1ED] text-[10px] text-[#555D57]"><Users className="w-3.5 h-3.5" />{selectedAgents.length} 位 AI 員工</div>
            <button onClick={addAgent} className="p-2 rounded-lg hover:bg-[#F3F1ED]" title="新增 AI 員工"><UserPlus className="w-4 h-4" /></button>
            <button onClick={() => addRoom(selectedCategory?.id || 'personal')} className="p-2 rounded-lg hover:bg-[#F3F1ED]" title="新增聊天室"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="px-4 py-2 bg-[#F8F7F4] border-b border-[#EBE8E1] flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-semibold text-[#8C938D] whitespace-nowrap">本聊天室：</span>
          {selectedAgents.map(agent => <span key={agent.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[#E1DDD4] text-[10px] whitespace-nowrap"><Briefcase className="w-3 h-3 text-[#385244]" />{agent.name} · {agent.roleName}</span>)}
          {customAgents.filter(a => a.categoryId === selectedRoom?.categoryId && !selectedRoom?.agentIds.includes(a.id)).map(agent => <button key={agent.id} onClick={() => inviteAgent(agent.id)} className="px-2 py-1 rounded-full border border-dashed border-[#C9C4B9] text-[10px] text-[#737A75] whitespace-nowrap">+ 邀請 {agent.name}</button>)}
        </div>
        <div className="flex-1 min-h-0">
          <AiTeamChat {...props} />
        </div>
      </section>
    </div>
  );
};
