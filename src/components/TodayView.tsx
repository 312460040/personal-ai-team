import React, { useState } from 'react';
import {
  CalendarDays,
  Briefcase,
  GraduationCap,
  Coffee,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Flame,
  Check,
  Zap,
  Bot,
  AlertCircle,
  BarChart3,
  CalendarCheck2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TodayTimeBlock, AgentId } from '../types';

interface TodayViewProps {
  blocks: TodayTimeBlock[];
  onToggleBlock: (blockId: string) => void;
  onAddBlock: (block: Omit<TodayTimeBlock, 'id'>) => void;
  onAskManagerToReschedule: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  blocks,
  onToggleBlock,
  onAddBlock,
  onAskManagerToReschedule,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTimeRange, setNewTimeRange] = useState('16:30 - 17:30');
  const [newType, setNewType] = useState<'work' | 'study' | 'rest' | 'buffer'>('work');
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDurationMin, setNewDurationMin] = useState(60);

  const handleToggle = (id: string) => {
    onToggleBlock(id);
    const target = blocks.find((b) => b.id === id);
    if (target && !target.completed) {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.8 },
      });
    }
  };

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const agentOwner =
      newType === 'work' ? 'work' : newType === 'study' ? 'study' : 'manager';

    onAddBlock({
      timeRange: newTimeRange,
      type: newType,
      title: newTitle.trim(),
      agentOwner: agentOwner as AgentId,
      targetDurationMin: Number(newDurationMin) || 60,
      completed: false,
      notes: newNotes.trim() || undefined,
      source: 'user',
      createdBy: 'user',
    });

    setNewTitle('');
    setNewNotes('');
    setShowAddModal(false);
  };

  // Calculate totals
  const totalWorkMin = blocks
    .filter((b) => b.type === 'work')
    .reduce((acc, b) => acc + b.targetDurationMin, 0);

  const totalStudyMin = blocks
    .filter((b) => b.type === 'study')
    .reduce((acc, b) => acc + b.targetDurationMin, 0);

  const totalRestMin = blocks
    .filter((b) => b.type === 'rest' || b.type === 'buffer')
    .reduce((acc, b) => acc + b.targetDurationMin, 0);

  const totalMin = totalWorkMin + totalStudyMin + totalRestMin || 1;
  const completedCount = blocks.filter((b) => b.completed).length;
  const progressPercent = Math.round((completedCount / (blocks.length || 1)) * 100);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#E8EFEB] text-[#385244]">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-[#2D322E]">Today 工作與課業整合儀表板</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[#E8EFEB] text-[#2D4835] border border-[#BCD2C3]">
              Manager Agent 整合仲裁
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B726C]">
            Manager Agent 已將 Work Agent 與 Study Agent 的建議無縫整合，兼顧白天高產出與晚間高專注學習。
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-rebalance-schedule"
            onClick={onAskManagerToReschedule}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#EFECE5] hover:bg-[#E4DFD6] text-[#385244] border border-[#DDD8CE] text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4 text-[#4E6B56]" />
            <span>向總管請求重新排程</span>
          </button>

          <button
            id="btn-add-today-block"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>新增時間區塊</span>
          </button>
        </div>
      </div>

      {/* Daily Executive Briefing & Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Manager Daily Briefing */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-[#FFFFFF] border border-[#BCD2C3] shadow-xs">
          <div className="flex items-center space-x-2 mb-2">
            <Bot className="w-4 h-4 text-[#385244]" />
            <span className="text-xs font-bold text-[#385244] uppercase tracking-wider font-mono">
              Manager Agent 今日統籌簡報 (Executive Briefing)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#2D322E] leading-relaxed font-sans mb-3">
            「今日核心主軸為<strong>【日間攻克電商單元測試】</strong>與<strong>【夜間深度攻堅資料結構圖論】</strong>。已將工作與課業時段完全錯開，傍晚安排 1.5 小時晚餐與腦力轉換緩衝，切忌在晚間學習時處理工作通訊！」
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9] font-mono font-medium">
              💼 工作: {(totalWorkMin / 60).toFixed(1)}h
            </span>
            <span className="px-2 py-0.5 rounded bg-[#FAF0E6] text-[#7D3E1B] border border-[#ECD1BA] font-mono font-medium">
              🎓 課業: {(totalStudyMin / 60).toFixed(1)}h
            </span>
            <span className="px-2 py-0.5 rounded bg-[#EFECE5] text-[#4A504B] border border-[#DDD8CE] font-mono font-medium">
              🍽️ 休息緩衝: {(totalRestMin / 60).toFixed(1)}h
            </span>
          </div>
        </div>

        {/* Completion Progress Gauge */}
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#6B726C] font-medium mb-1">
              <span>今日完成度</span>
              <span className="text-[#4E6B56] font-bold font-mono">
                {completedCount} / {blocks.length} 項
              </span>
            </div>
            <div className="text-2xl font-black text-[#2D322E] font-mono">
              {progressPercent}%
            </div>
          </div>

          <div className="my-2">
            <div className="w-full h-2.5 rounded-full bg-[#EFECE5] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#385244] to-[#5C7C66] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Time Ratio Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#6B726C] font-mono">
              <span>工作 : 課業 : 休息</span>
              <span>
                {Math.round((totalWorkMin / totalMin) * 100)}% /{' '}
                {Math.round((totalStudyMin / totalMin) * 100)}% /{' '}
                {Math.round((totalRestMin / totalMin) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#EFECE5] flex overflow-hidden">
              <div
                className="bg-[#4E6B56]"
                style={{ width: `${(totalWorkMin / totalMin) * 100}%` }}
              />
              <div
                className="bg-[#B36534]"
                style={{ width: `${(totalStudyMin / totalMin) * 100}%` }}
              />
              <div
                className="bg-[#9D9689]"
                style={{ width: `${(totalRestMin / totalMin) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Timeline */}
      <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBE8E1]">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#385244]" />
            <h3 className="text-sm font-bold text-[#2D322E]">
              今日整合時程表 (Integrated Daily Timeline)
            </h3>
          </div>
          <span className="text-xs text-[#6B726C] font-mono">
            {new Date().toLocaleDateString('zh-TW', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </span>
        </div>

        <div className="space-y-3">
          {blocks.map((block) => {
            const isWork = block.type === 'work';
            const isStudy = block.type === 'study';
            const isRest = block.type === 'rest' || block.type === 'buffer';

            return (
              <div
                key={block.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-2xs ${
                  block.completed
                    ? 'bg-[#FAF8F5] border-[#E5E2DC] opacity-60'
                    : isWork
                    ? 'bg-[#FFFFFF] border-[#E5E2DC] hover:border-[#4E6B56]/60'
                    : isStudy
                    ? 'bg-[#FFFFFF] border-[#E5E2DC] hover:border-[#B36534]/60'
                    : 'bg-[#FFFFFF] border-[#E5E2DC] hover:border-[#7D7569]/60'
                }`}
              >
                <div className="flex items-start space-x-3.5 flex-1">
                  <button
                    onClick={() => handleToggle(block.id)}
                    className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-md border transition-colors flex-shrink-0 ${
                      block.completed
                        ? 'bg-[#385244] border-[#385244] text-white'
                        : 'border-[#DDD8CE] hover:border-[#385244] text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#2D322E] bg-[#EFECE5] px-2 py-0.5 rounded">
                        {block.timeRange}
                      </span>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isWork
                            ? 'bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]'
                            : isStudy
                            ? 'bg-[#FAF0E6] text-[#7D3E1B] border border-[#ECD1BA]'
                            : 'bg-[#EFECE5] text-[#4A504B] border border-[#DDD8CE]'
                        }`}
                      >
                        {isWork && <Briefcase className="w-3 h-3 mr-1" />}
                        {isStudy && <GraduationCap className="w-3 h-3 mr-1" />}
                        {isRest && <Coffee className="w-3 h-3 mr-1" />}
                        {isWork
                          ? 'Work Agent'
                          : isStudy
                          ? 'Study Agent'
                          : 'Manager 緩衝'}
                      </span>

                      <span className="text-xs text-[#6B726C] font-mono">
                        ({block.targetDurationMin} 分鐘)
                      </span>
                    </div>

                    <h4
                      className={`text-sm font-semibold text-[#2D322E] ${
                        block.completed ? 'line-through text-[#8C938D]' : ''
                      }`}
                    >
                      {block.title}
                    </h4>

                    {block.notes && (
                      <p className="text-xs text-[#4A504B] font-sans leading-relaxed bg-[#FAF8F5] p-2 rounded-lg border border-[#E5E2DC]">
                        💡 {block.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono text-[#6B726C]">
                  {block.completed ? (
                    <span className="text-[#4E6B56] font-bold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 已完成
                    </span>
                  ) : (
                    <span className="text-[#385244] font-medium">待執行</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Time Block Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#2D322E] mb-4">新增今日時間區塊</h3>
            <form onSubmit={handleCreateBlock} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#4A504B] font-medium mb-1">時間範圍</label>
                <input
                  type="text"
                  required
                  placeholder="例如：16:30 - 17:30"
                  value={newTimeRange}
                  onChange={(e) => setNewTimeRange(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-medium mb-1">任務類型</label>
                  <select
                    value={newType}
                    onChange={(e: any) => setNewType(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    <option value="work">工作 (Work Agent)</option>
                    <option value="study">課業 (Study Agent)</option>
                    <option value="rest">休息緩衝 (Rest)</option>
                    <option value="buffer">總管覆盤 (Buffer)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-medium mb-1">時長 (分鐘)</label>
                  <input
                    type="number"
                    step="15"
                    min="15"
                    max="240"
                    value={newDurationMin}
                    onChange={(e) => setNewDurationMin(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4A504B] font-medium mb-1">任務標題</label>
                <input
                  type="text"
                  required
                  placeholder="例如：【Work Agent】撰寫 API 驗證測試"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div>
                <label className="block text-[#4A504B] font-medium mb-1">執行重點 / 備註</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="例如：高專注深度工作，關閉即時通訊軟體。"
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#EBE8E1]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFECE5] text-[#4A504B] hover:bg-[#E4DFD6] font-medium text-xs transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white font-medium text-xs shadow-xs transition-colors"
                >
                  確認建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
