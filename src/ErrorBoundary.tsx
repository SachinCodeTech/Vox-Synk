import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[VoxSync Crash Gate] Critical React lifecycle fault:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleEmergencyReboot = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  private handleSoftRecover = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '/dashboard';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0c10] text-[#f8fafc] flex flex-col items-center justify-center p-6 font-sans">
          {/* Neon Grid Overlay Background elements */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>
          
          <div className="w-full max-w-xl bg-[#121824] border border-rose-950/60 rounded-2xl p-8 relative shadow-2xl relative overflow-hidden z-10">
            {/* Warning light scan */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse"></div>

            <div className="space-y-6">
              {/* Header section */}
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-rose-950/50 border border-rose-800 flex items-center justify-center text-rose-400 text-2xl animate-bounce">
                  ⚠️
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight uppercase font-mono">
                    System Handshake Exception Detected
                  </h1>
                  <p className="text-xs text-slate-400 font-mono">
                    Node Kernel: LIFECYCLE_COLLISION_FAULT
                  </p>
                </div>
              </div>

              {/* Error logs preview */}
              <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-850 space-y-3 font-mono">
                <div className="flex justify-between text-[10px] text-slate-500 font-bold tracking-wider pb-1.5 border-b border-slate-900">
                  <span>CRITICAL FAULT REPORT</span>
                  <span>LEVEL: PANIC_CRASH</span>
                </div>
                <div className="text-xs text-rose-300 leading-relaxed font-semibold">
                  Error: {this.state.error?.message || 'Unknown render processing error.'}
                </div>
                {this.state.error?.stack && (
                  <div className="text-[10px] text-slate-400 max-h-36 overflow-y-auto whitespace-pre-wrap leading-tight scrollbar-thin scrollbar-thumb-slate-900 pr-1 select-text selection:bg-rose-950 selection:text-rose-200">
                    {this.state.error.stack.split('\n').slice(0, 4).join('\n')}
                  </div>
                )}
              </div>

              {/* Helpful descriptive tip */}
              <div className="text-xs text-slate-400 leading-relaxed">
                A localized React runtime exception crashed the primary visual UI layer. This can occur due to corrupt browser state cache markers, or unexpected socket payload synchronization issues.
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={this.handleSoftRecover}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl font-mono transition-all duration-200 cursor-pointer active:scale-98"
                >
                  ⚡ RETRY SESSION
                </button>
                <button
                  onClick={this.handleEmergencyReboot}
                  className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold rounded-xl font-mono transition-all duration-200 cursor-pointer active:scale-98 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                >
                  🚀 RESET GLOBAL STACK
                </button>
              </div>

              <div className="text-[9px] text-slate-600 font-mono text-center pt-2">
                All standalone offline structures and sync tasks are maintained autoritatively on the daemon server core.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
