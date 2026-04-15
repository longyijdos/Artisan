
"use client";

import { useEffect, useState } from "react";
import type { TerminalProxyResponseContract } from "@/lib/system/contracts";

interface TerminalViewProps {
  sessionId: string;
  onClose?: () => void;
}

export function TerminalView({ sessionId, onClose }: TerminalViewProps) {
  const [terminalUrl, setTerminalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchTerminalUrl() {
      if (!sessionId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Use the session-based endpoint which resolves the sandbox ID internally
        const response = await fetch(
          `/api/terminal?sessionId=${encodeURIComponent(sessionId)}`,
        );
        
        if (!response.ok) {
           const data = await response
             .json()
             .catch(() => ({}) as TerminalProxyResponseContract);
           throw new Error(data.detail || `Failed to get terminal URL: ${response.status}`);
        }
        
        const data = (await response.json()) as TerminalProxyResponseContract;
        
        if (mounted) {
          if (data.url) {
            setTerminalUrl(data.url);
          } else {
            setError("Received empty terminal URL");
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load terminal");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchTerminalUrl();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };


  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-slate-700/60 bg-slate-800/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-200">控制台</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-3 text-xs">
             {(loading || (terminalUrl && !iframeLoaded)) && (
                 <span className="flex items-center gap-1.5 text-blue-400">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                     Connecting...
                 </span>
             )}
             {iframeLoaded && !error && (
                 <span className="flex items-center gap-1.5 text-green-400">
                     <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                     Connected
                 </span>
             )}
             {error && (
                 <span className="flex items-center gap-1.5 text-red-400">
                     <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                     Disconnected
                 </span>
             )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
              title="关闭面板"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {loading && !terminalUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-400">
               <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
               <span className="text-sm">Initializing terminal session...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 max-w-md text-center">
              <div className="p-3 bg-red-900/20 rounded-full text-red-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-200">Connection Failed</h3>
                <p className="text-sm text-slate-400">
                  {error}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                    Make sure the sandbox is running. You can try restarting the session.
                </p>
              </div>
              {/* <button 
                onClick={handleRetry}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors"
               >
                 Retry Connection
              </button> */}
            </div>
          </div>
        ) : terminalUrl && (
          <>
             {/* Loading overlay while iframe loads */}
             {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                       <div className="w-6 h-6 border-2 border-slate-600 border-t-green-500 rounded-full animate-spin"></div>
                       <span className="text-sm">Loading terminal interface...</span>
                    </div>
                </div>
             )}
             <iframe 
               src={terminalUrl} 
               className="w-full h-full border-none bg-black"
               allow="clipboard-read; clipboard-write;"
               onLoad={handleIframeLoad}
             />
          </>
        )}
      </div>
    </div>
  );
}
