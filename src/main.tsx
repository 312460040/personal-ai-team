import React from 'react';
import { createRoot } from 'react-dom/client';
import { installManagerPlanningOverlay } from './services/managerPlanningOverlay';
import './services/apiRouting';
import App from './App.tsx';
import './index.css';

installManagerPlanningOverlay();

type ErrorBoundaryState = { hasError: boolean; message: string };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? (error.stack || error.message) : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Personal AI Team render error:', error, info);
    const reporter = (window as any).__aitBootFail;
    if (typeof reporter === 'function') reporter((error instanceof Error ? error.stack || error.message : String(error)));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-6 text-[#2D322E]">
          <div className="w-full max-w-xl rounded-2xl border border-[#E5E2DC] bg-[#FDFCFB] p-7 shadow-xl">
            <h1 className="text-xl font-bold mb-2">Personal AI Team 啟動失敗</h1>
            <p className="text-sm text-[#68716A] leading-6">React 已成功載入，但畫面元件啟動時發生錯誤。錯誤資訊已顯示在下方，方便直接定位問題。</p>
            <pre className="mt-4 rounded-xl bg-[#FAF0E6] p-4 text-xs leading-5 text-[#7A4022] whitespace-pre-wrap break-words">{this.state.message}</pre>
            <button className="mt-4 rounded-xl bg-[#385244] px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()}>重新載入</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Personal AI Team root element not found');

createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <div data-ait-app="true" className="min-h-screen">
        <App />
      </div>
    </AppErrorBoundary>
  </React.StrictMode>,
);
