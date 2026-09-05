import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

type ErrorBoundaryState = { hasError: boolean; message: string };
class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState { const message = error instanceof Error ? (error.stack || error.message) : String(error); return { hasError: true, message }; }
  componentDidCatch(error: unknown, info: React.ErrorInfo) { console.error('Personal AI Team render error:', error, info); }
  render() { if (this.state.hasError) return <BootError title="Personal AI Team 啟動失敗" message={this.state.message} />; return this.props.children; }
}
function BootError({ title, message }: { title: string; message: string }) { return <div style={{ minHeight: '100vh', boxSizing: 'border-box', padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7F4', color: '#2D322E', fontFamily: 'system-ui, sans-serif' }}><div style={{ width: '100%', maxWidth: 760, border: '1px solid #E5E2DC', borderRadius: 18, background: '#FDFCFB', padding: 28, boxShadow: '0 12px 40px rgba(0,0,0,.08)' }}><h1 style={{ margin: '0 0 10px', fontSize: 22 }}>{title}</h1><p style={{ margin: 0, lineHeight: 1.7, color: '#68716A' }}>前端檔案已載入，但應用程式啟動時發生錯誤。請把下方錯誤畫面截圖給我，我可以直接定位。</p><pre style={{ marginTop: 18, padding: 16, borderRadius: 12, background: '#FAF0E6', color: '#7A4022', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.6 }}>{message}</pre><button style={{ marginTop: 16, border: 0, borderRadius: 10, padding: '10px 16px', background: '#385244', color: '#fff', cursor: 'pointer' }} onClick={() => window.location.reload()}>重新載入</button></div></div>; }
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Personal AI Team root element not found');
const root = createRoot(rootElement);
root.render(<BootError title="Personal AI Team 載入中…" message="正在載入前端模組，請稍候。" />);
Promise.all([import('./services/managerPlanningOverlay'), import('./services/apiRouting'), import('./App.tsx'), import('./components/ResearchTaskBridge'), import('./components/ManagerOnboardingBridge'), import('./components/ClientHierarchyBridge')])
  .then(([planningModule, _routingModule, appModule, bridgeModule, onboardingModule, hierarchyModule]) => {
    planningModule.installManagerPlanningOverlay();
    const App = appModule.default;
    const ResearchTaskBridge = bridgeModule.ResearchTaskBridge;
    const ManagerOnboardingBridge = onboardingModule.ManagerOnboardingBridge;
    const ClientHierarchyBridge = hierarchyModule.ClientHierarchyBridge;
    root.render(<React.StrictMode><><AppErrorBoundary><div data-ait-app="true" className="min-h-screen"><App /></div></AppErrorBoundary><ResearchTaskBridge /><ManagerOnboardingBridge /><ClientHierarchyBridge /></></React.StrictMode>);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack || error.message) : String(error);
    console.error('Personal AI Team module boot error:', error);
    root.render(<BootError title="Personal AI Team 模組載入失敗" message={message} />);
  });
