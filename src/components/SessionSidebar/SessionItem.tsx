import React, { useState, useRef, useLayoutEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Session } from "@/lib/session/types";

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  isAgentRunning: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  // Edit logic
  editValue: string;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  editInputRef: React.RefObject<HTMLInputElement | null>;
}

export function SessionItem({
  session,
  isActive,
  isAgentRunning,
  isEditing,
  onSelect,
  onStartEdit,
  onDelete,
  editValue,
  onEditChange,
  onEditSave,
  // onEditCancel — handled by onEditKeyDown (Escape) and blur
  onEditKeyDown,
  editInputRef,
}: SessionItemProps) {
  // State machine for animations
  // idle -> fading-out -> (typing | fading-in) -> idle
  const [animationState, setAnimationState] = useState<'idle' | 'fading-out' | 'typing' | 'fading-in'>('idle');
  const [displayedTitle, setDisplayedTitle] = useState(session.title);

  // Track previous title to detect changes
  const prevTitleRef = useRef(session.title);
  
  // useLayoutEffect ensures state updates happen before paint, preventing "flash" of old state
  useLayoutEffect(() => {
    // If title hasn't changed, do nothing
    if (prevTitleRef.current === session.title) return;

    // Detect if this is an auto-rename
    const isAuto = session.isAutoNamed;
    const newTitle = session.title;
    
    let effectTimeout: NodeJS.Timeout;
    let effectInterval: NodeJS.Timeout;

    if (isAuto) {
      // Auto-rename sequence: Fade Out -> Typewriter
      setAnimationState('fading-out');
      effectTimeout = setTimeout(() => {
        setDisplayedTitle("");
        setAnimationState('typing');

        let i = 0;
        effectInterval = setInterval(() => {
          setDisplayedTitle(newTitle.slice(0, i + 1));
          i++;
          if (i >= newTitle.length) {
            clearInterval(effectInterval);
            setAnimationState('idle');
          }
        }, 100);
      }, 300);
    } else {
      // Manual rename sequence: Instant Hide New Title -> Fade In
      setDisplayedTitle(newTitle);
      setAnimationState('fading-out'); // Instantly apply opacity-0 (transition disabled via className)
      
      effectTimeout = setTimeout(() => {
        setAnimationState('fading-in'); // Enable transition and fade to opacity-100
        setTimeout(() => {
            setAnimationState('idle');
        }, 300);
      }, 50); // Short delay to allow DOM to register opacity-0 state
    }

    // Update ref
    prevTitleRef.current = newTitle;

    return () => {
        clearTimeout(effectTimeout);
        if (effectInterval) clearInterval(effectInterval);
    };
  }, [session.title, session.isAutoNamed]);



  return (
    <div
      onClick={onSelect}
      className={`
        group flex items-center px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150
        ${isActive 
          ? "bg-white/80 shadow-[0_2px_10px_-4px_rgba(79,70,229,0.3)] ring-1 ring-indigo-100/60" 
          : "hover:bg-indigo-50/50"
        }
      `}
    >
      {/* Active indicator bar */}
      <div className={`
        w-[3px] self-stretch rounded-full mr-2 flex-shrink-0 transition-all duration-200
        ${isActive ? 'bg-indigo-500' : 'bg-transparent'}
      `} />

      <div className="flex-1 min-w-0 pr-1">
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditSave}
            onKeyDown={onEditKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs px-2 py-1 rounded-lg border border-indigo-300 outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
            autoFocus
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            <span 
              className={`text-[13px] truncate font-medium leading-tight ${
                animationState === 'typing' || (!session.isAutoNamed && animationState === 'fading-out') 
                  ? '' 
                  : 'transition-all duration-300'
              } ${
                isActive ? "text-indigo-600" : "text-slate-600 group-hover:text-slate-800"
              } ${
                (session.title !== displayedTitle && !session.isAutoNamed && animationState !== 'fading-in') ? 'opacity-0' :
                animationState === 'fading-out' ? 'opacity-0 translate-y-1' : 
                animationState === 'fading-in' ? 'opacity-100 translate-y-0' : ''
              }`}
              title={session.title}
            >
              {displayedTitle || (animationState === 'typing' ? "" : "新对话")}
              {animationState === 'typing' && (
                <span className="inline-block w-1.5 h-3.5 bg-indigo-500 ml-0.5 align-middle animate-pulse rounded-sm" />
              )}
              {animationState === 'idle' && isAgentRunning && isActive && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse ml-1.5 align-middle" />
              )}
            </span>
            <span className="text-[10px] text-slate-400 leading-tight">
              {formatDistanceToNow(session.lastUpdateTime * 1000, { addSuffix: true, locale: zhCN })}
            </span>
          </div>
        )}
      </div>
      
      <div className={`
        flex items-center gap-0.5 opacity-0 transition-opacity duration-150
        ${isActive ? 'opacity-100' : 'group-hover:opacity-100'}
      `}>
        <button
          onClick={onStartEdit}
          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="重命名"
        >
           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="删除"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
