import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Plus, RotateCcw, Trash2, Home, CheckCircle2 } from 'lucide-react';
import type { IdeaBoardData, IdeaEdge, IdeaNode } from '../types/ideaBoard';
import { createIdeaEdge, createIdeaNode } from '../types/ideaBoard';

const STORAGE_KEY = 'ait_idea_boards_v1';
const BOARD_ID = 'main-idea-board';
const WIDTH = 1800;
const HEIGHT = 1100;

const initialBoard = (): IdeaBoardData => ({
  id: BOARD_ID,
  name: '我的想法白板',
  description: '把零散想法連起來，逐步形成可以完成的專案。',
  nodes: [],
  edges: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const loadBoard = (): IdeaBoardData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialBoard();
  } catch {
    return initialBoard();
  }
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const IdeaBoard: React.FC = () => {
  const [board, setBoard] = useState<IdeaBoardData>(loadBoard);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...board, updatedAt: new Date().toISOString() }));
  }, [board]);

  const selected = useMemo(() => board.nodes.find(node => node.id === selectedId) || null, [board.nodes, selectedId]);

  const updateNode = (id: string, updates: Partial<IdeaNode>) => {
    setBoard(prev => ({ ...prev, nodes: prev.nodes.map(node => node.id === id ? { ...node, ...updates, updatedAt: new Date().toISOString() } : node) }));
  };

  const addNode = () => {
    const node = createIdeaNode(BOARD_ID, '新想法', 300 - pan.x, 220 - pan.y);
    setBoard(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelectedId(node.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setBoard(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== selectedId),
      edges: prev.edges.filter(edge => edge.fromNodeId !== selectedId && edge.toNodeId !== selectedId),
    }));
    setSelectedId(null);
    setConnectingFrom(null);
  };

  const connectNode = (targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) return setConnectingFrom(null);
    const exists = board.edges.some(edge => (edge.fromNodeId === connectingFrom && edge.toNodeId === targetId) || (edge.fromNodeId === targetId && edge.toNodeId === connectingFrom));
    if (!exists) {
      const edge = createIdeaEdge(BOARD_ID, connectingFrom, targetId);
      setBoard(prev => ({ ...prev, edges: [...prev.edges, edge] }));
    }
    setConnectingFrom(null);
  };

  const startDrag = (event: React.PointerEvent, node: IdeaNode) => {
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedId(node.id);
    setDragging({ id: node.id, offsetX: event.clientX - rect.left - node.x - pan.x, offsetY: event.clientY - rect.top - node.y - pan.y });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    updateNode(dragging.id, {
      x: clamp(event.clientX - rect.left - dragging.offsetX - pan.x, 20, WIDTH - 260),
      y: clamp(event.clientY - rect.top - dragging.offsetY - pan.y, 20, HEIGHT - 150),
    });
  };

  const nodeCenter = (node: IdeaNode) => ({ x: node.x + 105, y: node.y + 45 });

  const reset = () => {
    setBoard(initialBoard());
    setSelectedId(null);
    setConnectingFrom(null);
  };

  return <div className="h-full min-h-[620px] flex flex-col bg-[#F5F3EE] rounded-2xl border border-[#E5E2DC] overflow-hidden">
    <div className="px-4 py-3 bg-white border-b border-[#E5E2DC] flex items-center justify-between gap-3">
      <div><div className="font-bold text-sm text-[#2D322E]">☁️ 想法白板</div><div className="text-[10px] text-[#8C938D]">拖拉想法、建立關聯；完成後逐步形成 🏠 專案成果</div></div>
      <div className="flex items-center gap-1.5">
        <button onClick={addNode} className="px-3 py-2 rounded-lg bg-[#385244] text-white text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5"/>新增想法</button>
        <button onClick={() => selectedId && setConnectingFrom(selectedId)} disabled={!selectedId} className="px-3 py-2 rounded-lg border border-[#DDD8CE] bg-white text-xs disabled:opacity-40 flex items-center gap-1"><Link2 className="w-3.5 h-3.5"/>連結</button>
        <button onClick={deleteSelected} disabled={!selectedId} className="p-2 rounded-lg border border-[#DDD8CE] disabled:opacity-40"><Trash2 className="w-3.5 h-3.5"/></button>
        <button onClick={reset} className="p-2 rounded-lg border border-[#DDD8CE]" title="清空白板"><RotateCcw className="w-3.5 h-3.5"/></button>
      </div>
    </div>
    <div className="flex-1 flex min-h-0">
      <div ref={canvasRef} onPointerMove={moveDrag} onPointerUp={() => setDragging(null)} className="relative flex-1 overflow-hidden bg-[radial-gradient(#d9d5cc_1px,transparent_1px)] [background-size:22px_22px]">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {board.edges.map(edge => { const a=board.nodes.find(n=>n.id===edge.fromNodeId); const b=board.nodes.find(n=>n.id===edge.toNodeId); if(!a||!b)return null; const p1=nodeCenter(a),p2=nodeCenter(b); return <line key={edge.id} x1={p1.x+pan.x} y1={p1.y+pan.y} x2={p2.x+pan.x} y2={p2.y+pan.y} stroke="#A9B9AD" strokeWidth="3" strokeDasharray="7 5"/>; })}
        </svg>
        {board.nodes.map(node => <div key={node.id} onPointerDown={e=>startDrag(e,node)} onDoubleClick={()=>updateNode(node.id,{status:node.status==='completed'?'idea':'completed'})} onClick={()=>connectingFrom?connectNode(node.id):setSelectedId(node.id)} style={{left:node.x+pan.x,top:node.y+pan.y}} className={`absolute w-[210px] min-h-[90px] p-3 rounded-2xl border-2 shadow-md cursor-grab select-none ${selectedId===node.id?'border-[#385244] ring-2 ring-[#BCD2C3]':'border-[#DDD8CE]'} ${node.status==='completed'?'bg-[#E7F1E9]':'bg-[#FFFDF8]'}`}>
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-[#8C938D]">{node.status==='completed'?'🏠 已完成':'☁️ 想法'}</span>{node.status==='completed'&&<CheckCircle2 className="w-4 h-4 text-[#385244]"/>}</div>
          <div className="font-semibold text-sm text-[#2D322E] mt-1 break-words">{node.title}</div>
          {node.note&&<div className="text-[10px] text-[#6B726C] mt-1 break-words">{node.note}</div>}
        </div>)}
        {!board.nodes.length&&<div className="absolute inset-0 flex items-center justify-center text-center"><div><div className="text-5xl mb-3">☁️</div><div className="font-bold text-sm text-[#555D57]">把第一個想法放上來</div><div className="text-xs text-[#8C938D] mt-1">新增後可以拖拉、選取、建立關聯</div></div></div>}
      </div>
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-l border-[#E5E2DC] p-4 flex-col gap-4">
        {selected ? <><div><div className="text-[10px] text-[#8C938D]">選取的想法</div><input value={selected.title} onChange={e=>updateNode(selected.id,{title:e.target.value})} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-[#DDD8CE] text-sm"/></div><div><div className="text-[10px] text-[#8C938D]">備註</div><textarea value={selected.note||''} onChange={e=>updateNode(selected.id,{note:e.target.value})} className="mt-1 w-full h-24 px-2.5 py-2 rounded-lg border border-[#DDD8CE] text-xs resize-none" placeholder="補充這個想法…"/></div><button onClick={()=>updateNode(selected.id,{status:selected.status==='completed'?'idea':'completed',kind:selected.status==='completed'?'idea':'project'})} className="w-full px-3 py-2 rounded-lg bg-[#E8EFEB] text-[#385244] text-xs font-semibold flex items-center justify-center gap-1"><Home className="w-3.5 h-3.5"/>{selected.status==='completed'?'退回想法':'標記為完成成果'}</button><div className="text-[10px] text-[#8C938D] leading-relaxed">完成後目前先以 🏠 狀態呈現。下一階段會把它與真實 Project / Task 串接，依完成度自動建造房子。</div></> : <div className="text-xs text-[#8C938D] leading-relaxed">選取一個想法後，可以編輯內容、建立關聯或標記完成。</div>}
        <div className="mt-auto text-[10px] text-[#A0A59F]">資料會自動儲存在瀏覽器。白板資料結構已預留 Project、Task 關聯。</div>
      </aside>
    </div>
  </div>;
};

export default IdeaBoard;
