import React, { useMemo, useState } from 'react';
import { StudyView as StudyViewImpl } from './StudyView.tsx';
import { useAppData } from '../context/AppDataContext';
import type { StudySubject, WeeklyStudyScheduleItem } from '../types';

/**
 * Compatibility wrapper: inject subject CRUD callbacks from AppDataContext
 * and provide the weekly fixed schedule editor requested for each subject.
 */
export const StudyView: React.FC<any> = (props) => {
  const data = useAppData();
  const subjects: StudySubject[] = data.studySubjects || props.subjects || [];
  const [selectedId, setSelectedId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<WeeklyStudyScheduleItem['dayOfWeek']>(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [classroom, setClassroom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [note, setNote] = useState('');

  const selected = useMemo(
    () => subjects.find((subject) => subject.id === (selectedId || subjects[0]?.id)),
    [subjects, selectedId]
  );

  const updateSchedule = (subject: StudySubject, schedule: WeeklyStudyScheduleItem[]) => {
    data.updateStudySubject({ ...subject, weeklySchedule: schedule });
  };

  const addScheduleItem = () => {
    if (!selected) return;
    const item: WeeklyStudyScheduleItem = {
      dayOfWeek,
      startTime,
      endTime,
      classroom: classroom.trim() || undefined,
      teacher: teacher.trim() || undefined,
      note: note.trim() || undefined,
    };
    const next = [...(selected.weeklySchedule || []), item].sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
    );
    updateSchedule(selected, next);
    setClassroom('');
    setTeacher('');
    setNote('');
  };

  const removeScheduleItem = (index: number) => {
    if (!selected) return;
    updateSchedule(selected, (selected.weeklySchedule || []).filter((_, i) => i !== index));
  };

  const dayNames = ['', '一', '二', '三', '四', '五', '六', '日'];

  return (
    <>
      <StudyViewImpl
        {...props}
        subjects={subjects}
        onAddSubject={props.onAddSubject ?? data.addStudySubject}
        onUpdateSubject={props.onUpdateSubject ?? data.updateStudySubject}
        onDeleteSubject={props.onDeleteSubject ?? data.deleteStudySubject}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <div className="p-5 rounded-2xl bg-white border border-[#E5E2DC] shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-[#2D322E]">每週固定課表</h3>
              <p className="text-xs text-[#6B726C] mt-1">每個科目可登記每週上課日、時間、教室、老師與備註。</p>
            </div>
            <select
              value={selected?.id || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#DDD8CE] text-sm bg-[#FAF8F5]"
            >
              <option value="">選擇科目</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>

          {!selected ? (
            <div className="text-sm text-[#7A807B] py-4">請先建立或選擇一個學科科目。</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value) as WeeklyStudyScheduleItem['dayOfWeek'])} className="px-2 py-2 rounded-lg border border-[#DDD8CE] text-sm">
                  {dayNames.slice(1).map((name, index) => <option key={index + 1} value={index + 1}>週{name}</option>)}
                </select>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="px-2 py-2 rounded-lg border border-[#DDD8CE] text-sm" />
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="px-2 py-2 rounded-lg border border-[#DDD8CE] text-sm" />
                <input value={classroom} onChange={(e) => setClassroom(e.target.value)} placeholder="教室" className="px-2 py-2 rounded-lg border border-[#DDD8CE] text-sm" />
                <input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="老師" className="px-2 py-2 rounded-lg border border-[#DDD8CE] text-sm" />
                <button type="button" onClick={addScheduleItem} className="px-3 py-2 rounded-lg bg-[#385244] text-white text-sm font-semibold">新增時段</button>
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註（選填，例如：每週小考、指定教材）" className="w-full px-3 py-2 mb-4 rounded-lg border border-[#DDD8CE] text-sm" />

              {(selected.weeklySchedule || []).length === 0 ? (
                <div className="text-sm text-[#7A807B] py-3">目前尚未設定每週固定時段。</div>
              ) : (
                <div className="space-y-2">
                  {selected.weeklySchedule!.map((item, index) => (
                    <div key={`${item.dayOfWeek}-${item.startTime}-${index}`} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E5E2DC] text-sm">
                      <span className="font-semibold text-[#385244] w-12">週{dayNames[item.dayOfWeek]}</span>
                      <span>{item.startTime}–{item.endTime}</span>
                      {item.classroom && <span>｜{item.classroom}</span>}
                      {item.teacher && <span>｜{item.teacher}</span>}
                      {item.note && <span className="text-[#6B726C]">｜{item.note}</span>}
                      <button type="button" onClick={() => removeScheduleItem(index)} className="ml-auto px-2 py-1 rounded-lg text-xs text-red-600 hover:bg-red-50">刪除</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
};
