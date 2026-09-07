import React from 'react';
import { StudyView as StudyViewImpl } from './StudyView.tsx';
import { useAppData } from '../context/AppDataContext';

/**
 * Compatibility wrapper for the current App.tsx call site.
 * App.tsx historically omitted the subject CRUD callbacks, so inject them
 * from AppDataContext while preserving the full StudyView.tsx UI.
 */
export const StudyView: React.FC<any> = (props) => {
  const data = useAppData();
  return React.createElement(StudyViewImpl, {
    ...props,
    onAddSubject: props.onAddSubject ?? data.addStudySubject,
    onUpdateSubject: props.onUpdateSubject ?? data.updateStudySubject,
    onDeleteSubject: props.onDeleteSubject ?? data.deleteStudySubject,
  });
};
