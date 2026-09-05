import React, { useEffect, useRef } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { StudyTask } from '../types';

/**
 * Keeps Manager-created study/research tasks in the Study Task store.
 * Public Manager intake returns batched tasks inside an AIT_TASK_BATCH marker;
 * AppDataContext historically only consumed singular createdStudyTask fields.
 */
export const ResearchTaskBridge: React.FC = () => {
  const { messages, studyTasks, addStudyTask } = useAppData();
  const processed = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const message of messages) {
      if (message.sender !== 'manager' || !message.text) continue;

      const marker = message.text.match(/<!--AIT_TASK_BATCH:([\s\S]*?)-->/);
      if (!marker) continue;
      const markerKey = `${message.id}:${marker[1]}`;
      if (processed.current.has(markerKey)) continue;

      try {
        const batch = JSON.parse(marker[1]);
        const incomingStudy = Array.isArray(batch?.study) ? batch.study : [];
        const existingIds = new Set(studyTasks.map((task) => task.id));

        for (const raw of incomingStudy) {
          if (!raw?.id || existingIds.has(raw.id)) continue;

          const task: StudyTask = {
            id: String(raw.id),
            subjectId: String(raw.subjectId || 'subj-research-unassigned'),
            subjectName: String(raw.subjectName || '研究／專題（待歸類）'),
            title: String(raw.title || '未命名研究任務'),
            type: raw.type === 'assignment' || raw.type === 'exam' ? raw.type : 'study_task',
            chapter: raw.chapter || '研究／專題',
            deadline: String(raw.deadline || ''),
            progress: Number(raw.progress || 0),
            estimatedHours: Number(raw.estimatedHours || 1),
            priority: raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'medium',
            difficulty: raw.difficulty === 'hard' || raw.difficulty === 'easy' ? raw.difficulty : 'medium',
            status: raw.status === 'completed' || raw.status === 'in_progress' || raw.status === 'delayed' ? raw.status : 'todo',
            supervisionNote: raw.supervisionNote,
            notes: raw.notes || '由 Manager Agent 建立的研究／課業任務',
            source: 'user',
            createdBy: 'user',
          };

          addStudyTask(task);
          existingIds.add(task.id);
        }

        processed.current.add(markerKey);
      } catch (error) {
        console.warn('[ResearchTaskBridge] Invalid AIT_TASK_BATCH marker:', error);
        processed.current.add(markerKey);
      }
    }
  }, [messages, studyTasks, addStudyTask]);

  return null;
};
