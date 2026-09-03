import React, { useEffect, useMemo, useState } from 'react';
import { Plus, MessageSquare, Users, Briefcase, UserPlus, ChevronRight, Home, GraduationCap, Compass } from 'lucide-react';
import { AiTeamChat } from './AiTeamChat';
import type { AgentInfo, ChatMessage, StructuredTimeBlock } from '../types';

type ChatCategory = { id: string; name: string; icon: string; description: string };
type ChatRoom = { id: string; categoryId: string; name: string; description?: string; agentIds: string[] };
type CustomAgent = { id: string; name: string; roleName: string; categoryId: string; tagline: string };

const CATEGORY_KEY = 'ait_chat_categories_v2';
const ROOM_KEY = 'ait_chat_rooms_v2';
const CUSTOM_AGENT_KEY = 'ait_custom_agents_v1';
const roomMessagesKey = (roomId: string) => `ait_chat_messages_v2_${roomId}`;

const defaultCategories: ChatCategory[] = [
  { id: 'work', name: '工作', icon: '💼', description: '工作安排、專案與執行' },
  { id: 'study', name: '課業', icon: '🎓', description: '課業、研究與學習進度' },
  { id: 'personal', name: '個人規劃', icon: '🧭', description: '生活安排、目標與個人規劃' },
];

const defaultRooms: ChatRoom[] = [
  { id: 'room-work-general', categoryId: 'work', name: '工作總管', description: '工作安排、優先級與進度', agentIds: ['manager', 'work'] },
  { id: 'room-study-general', categoryId: 'study', name: '課業規劃', description: '課業、複習與學習進度', agentIds: ['manager', 'study'] },
  { id: 'room-study-research', categoryId: 'study', name: '研究討論', description: '論文、文獻與研究問題', agentIds: ['manager', 'study'] },
  { id: 'room-personal-general', categoryId: 'personal', name: '個人規劃', description: '生活與個人安排', agentIds: ['manager'] },
];

const readList = <T,>(key: string, fallback: T[]): T[] => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
};

const readMessages = (roomId: string, fallback: ChatMessage[]): ChatMessage[] => {
  try {
    const saved = localStorage.getItem(roomMessagesKey(roomId));
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
  const [categories] = useState<ChatCategory[]>(defaultCategories);
  const [rooms, setRooms] = useState<ChatRoom[]>(() => {
    const saved = readList<ChatRoom>(ROOM_KEY, defaultRooms);
    // 舊版「研究」分類升級到新的「課業」區，避免既有聊天室消失。
    return saved.map(room => room.categoryId === 'research' ? { ...room, categoryId: 'study' } : room);
  });
  const [customAgents, setCustomAgents] = useState(() => readList<CustomAgent>(CUSTOM_AGENT_KEY, []));
  const [selectedRoomId, setSelectedRoomId] = useState('room-work-general');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>(() => readMessages('room-work-general', props.messages));
  const pendingRoomIdRef = React.useRef<string | null>(null);
  const seenGlobalMessageIdsRef = React.useRef<Set<string>>(new Set(props.messages.map(m => m.id)));

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];
  const selectedCategory = categories.find(c => c.id === selectedRoom?.categoryId);
  const selectedAgents = useMemo(() => {
    const builtIn = props.agentRegistry.filter(a => selectedRoom?.agentIds.includes(a.id));
    const custom = customAgents.filter(a => selectedRoom?.agentIds.includes(a.id));
    return [...builtIn, ...custom];
  }, [props.agentRegistry, customAgents, selectedRoom]);

  useEffect(() => {
    localStorage.setItem(ROOM_KEY, JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem(roomMessagesKey(selectedRoomId), JSON.stringify(roomMessages));
  }, [selectedRoomId, roomMessages]);

  useEffect(() => {
    const unseen = props.messages.filter(m => !seenGlobalMessageIdsRef.current.has(m.id));
    if (unseen.length === 0) return;
    unseen.forEach(m => seenGlobalMessageIdsRef.current.add(m.id));
    const targetRoom = pendingRoomIdRef.current || selectedRoomId;
    if (targetRoom !== selectedRoomId) return;
    setRoomMessages(prev => {
      const existing = new Set(prev.map(m => m.id));
      const additions = unseen.filter(m => !existing.has(m.id));
      return additions.length ? [...prev, ...additions] : prev;
    });
    pendingRoomIdRef.current = null;
  }, [props.messages, selectedRoomId]);

  const persist = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

  const switchRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setRoomMessages(readMessages(roomId, []));
  };

  const addRoom = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    const name = window.prompt(`新增「${category?.name || '公共區'}」聊天框名稱，例如：A 客戶｜短影音`);
    if (!name?.trim()) return;
    const room = { id: `room-${Date.now()}`, categoryId, name: name.trim(), description: `新的${category?.name || ''}聊天脈絡`, agentIds: ['manager'] };
    const next = [...rooms, room]; setRooms(next); persist(ROOM_KEY, next); switchRoom(room.id);
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

  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: `room-user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
    setRoomMessages(prev => [...prev, userMsg]);
    pendingRoomIdRef.current = selectedRoomId;
    props.onSendMessage(text);
  };

  const categoryIcons: Record<string, React.ReactNode> = { work: <Briefcase className="w-3.5 h-3.5" />, study: <GraduationCap className="w-3.5 h-3.5" />, personal: <Compass className="w-3.5 h-3.5" /> };

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-4 py-3 h-[calc(100vh-5rem)] flex gap-3">
      <aside className="hidden md:flex w-72 shrink-0 flex-col rounded-2xl border border-[#E5E2DC] bg-white overflow-hidden">
        <div className="p-4 border-b border-[#EBE8E1] bg-[#FDFCFB]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E8EFEB] flex items-center justify-center text-[#385244]"><Home className="w-4 h-4" /></div>
            <div><div className="text-sm font-bold">公共區</div><div className="text-[10px] text-[#8C938D]">Personal AI Team</div></div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#8C938D]">從這裡進入不同生活領域的 AI 聊天框；每個聊天框保留自己的對話脈絡。</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {categories.map(category => {
            const categoryRooms = rooms.filter(r => r.categoryId === category.id);
            const isCollapsed = collapsed[category.id];
            return <div key={category.id} className="mb-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <button onClick={() => setCollapsed(v => ({ ...v, [category.id]: !v[category.id] }))} className="flex items-center gap-2 text-xs font-bold text-[#555D57]">
                  <span className="w-5 h-5 rounded-md bg-[#F3F1ED] flex items-center justify-center">{categoryIcons[category.id] || <MessageSquare className="w-3.5 h-3.5" />}</span>
                  <span>{category.name}</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                </button>
                <button onClick={() => addRoom(category.id)} className="p-1.5 rounded-lg hover:bg-[#F3F1ED]" title={`新增${category.name}聊天框`}><Plus className="w-3 h-3" /></button>
              </div>
              {!isCollapsed && <div className="ml-3 pl-3 border-l border-[#E8E4DC]">
                {categoryRooms.map(room => <button key={room.id} onClick={() => switchRoom(room.id)} className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl mb-0.5 ${selectedRoomId === room.id ? 'bg-[#E8EFEB] text-[#385244]' : 'text-[#555D57] hover:bg-[#F7F5F1]'}`}>
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" /><span className="text-xs truncate">{room.name}</span>
                </button>)}
              </div>}
            </div>;
          })}
        </div>

        <div className="p-2 border-t border-[#EBE8E1]"><button onClick={addAgent} className="w-full px-2.5 py-2 rounded-xl text-xs text-[#555D57] hover:bg-[#F3F1ED] flex items-center gap-2"><UserPlus className="w-3.5 h-3.5" />建立自訂 AI 員工</button></div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col rounded-2xl border border-[#E5E2DC] bg-[#FDFCFB] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E2DC] bg-white flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><span>{selectedCategory?.icon || '💬'}</span><h1 className="text-sm font-bold truncate">{selectedRoom?.name || '聊天框'}</h1><span className="text-[10px] text-[#8C938D]">公共區 / {selectedCategory?.name}</span></div><p className="text-[10px] text-[#8C938D] truncate">{selectedRoom?.description}</p></div>
          <div className="flex items-center gap-1.5 shrink-0"><div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F3F1ED] text-[10px] text-[#555D57]"><Users className="w-3.5 h-3.5" />{selectedAgents.length} 位 AI 員工</div><button onClick={addAgent} className="p-2 rounded-lg hover:bg-[#F3F1ED]" title="新增 AI 員工"><UserPlus className="w-4 h-4" /></button><button onClick={() => addRoom(selectedCategory?.id || 'personal')} className="p-2 rounded-lg hover:bg-[#F3F1ED]" title="新增聊天框"><Plus className="w-4 h-4" /></button></div>
        </div>
        <div className="px-4 py-2 bg-[#F8F7F4] border-b border-[#EBE8E1] flex items-center gap-2 overflow-x-auto"><span className="text-[10px] font-semibold text-[#8C938D] whitespace-nowrap">本聊天框 AI：</span>{selectedAgents.map(agent => <span key={agent.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[#E1DDD4] text-[10px] whitespace-nowrap"><Briefcase className="w-3 h-3 text-[#385244]" />{agent.name} · {agent.roleName}</span>)}{customAgents.filter(a => a.categoryId === selectedRoom?.categoryId && !selectedRoom?.agentIds.includes(a.id)).map(agent => <button key={agent.id} onClick={() => inviteAgent(agent.id)} className="px-2 py-1 rounded-full border border-dashed border-[#C9C4B9] text-[10px] text-[#737A75] whitespace-nowrap">+ 邀請 {agent.name}</button>)}</div>
        <div className="flex-1 min-h-0"><AiTeamChat {...props} messages={roomMessages} onSendMessage={handleSendMessage} /></div>
      </section>
    </div>
  );
};
