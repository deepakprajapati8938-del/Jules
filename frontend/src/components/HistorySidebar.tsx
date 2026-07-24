import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { X, Plus, Clock, Trash2 } from 'lucide-react';
import { apiClient } from '../core/api-client';
import type { ChatSession } from '../core/api-client';

interface HistorySidebarProps {
  chatType: 'ncert' | 'personal';
  isOpen: boolean;
  onClose: () => void;
}

export default function HistorySidebar({ chatType, isOpen, onClose }: HistorySidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const isPersonal = chatType === 'personal';
  const accentColor = isPersonal ? 'text-violet' : 'text-accent';
  const hoverBg = isPersonal ? 'hover:bg-violet/10' : 'hover:bg-accent/10';
  const activeBg = isPersonal ? 'bg-violet/15 border-violet/30' : 'bg-accent-tint border-accent/20';

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      const fetchFn = isPersonal ? apiClient.chat.getPersonalSessions : apiClient.chat.getNcertSessions;
      fetchFn()
        .then(data => setSessions(data))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, chatType]);

  const handleNewChat = () => {
    navigate(isPersonal ? '/personal' : '/chat');
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat history?")) return;
    
    try {
      await apiClient.chat.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (id === sessionId) {
        navigate(isPersonal ? '/personal' : '/chat');
        onClose();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
      alert("Failed to delete session");
    }
  };

  // Group by date logic
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const getGroup = (dateStr: string | undefined) => {
    if (!dateStr) return 'Past Chats';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Past Chats';

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
    if (diffDays <= 7) return 'Previous 7 Days';
    if (diffDays <= 30) return 'Previous 30 Days';
    return d.getFullYear() === today.getFullYear() 
      ? d.toLocaleString('default', { month: 'long' }) 
      : d.getFullYear().toString();
  };

  const groupedSessions = sessions.reduce((acc, session) => {
    const group = getGroup(session.updated_at);
    if (!acc[group]) acc[group] = [];
    acc[group].push(session);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  const sidebarContent = (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div 
        className={`fixed top-0 right-0 bottom-0 w-80 glass-strong z-[101] transform transition-transform duration-300 ease-in-out flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border-glass shrink-0">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${accentColor}`} />
            <span className="font-semibold text-sm text-foreground tracking-wide uppercase">Chat History</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-secondary hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors active-scale"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border-glass shrink-0">
          <button 
            onClick={handleNewChat}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border-glass shadow-glass-sm font-medium transition-all active-scale ${hoverBg} text-foreground`}
          >
            <Plus className={`w-5 h-5 ${accentColor}`} />
            New Topic
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3 opacity-50">
              <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${isPersonal ? 'border-violet' : 'border-accent'}`} />
              <span className="text-xs font-medium text-secondary uppercase tracking-widest">Loading...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-muted text-sm mt-10">
              No previous chats found.
            </div>
          ) : (
            Object.entries(groupedSessions).map(([group, groupSessions]) => (
              <div key={group}>
                <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 px-2">
                  {group}
                </h3>
                <div className="space-y-1">
                  {groupSessions.map(session => (
                    <NavLink
                      key={session.id}
                      to={`/${isPersonal ? 'personal' : 'chat'}/${session.id}`}
                      onClick={onClose}
                      className={({ isActive }) => 
                        `group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 border ${
                          (isActive || session.id === sessionId)
                            ? `${activeBg} text-foreground shadow-glass-inset font-medium` 
                            : 'border-transparent text-secondary hover:text-foreground hover:bg-surface-hover'
                        }`
                      }
                    >
                      <span className="truncate pr-2 leading-snug">{session.title}</span>
                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className="p-1.5 -mr-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all shrink-0 opacity-40 hover:opacity-100"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  return createPortal(sidebarContent, document.body);
}
