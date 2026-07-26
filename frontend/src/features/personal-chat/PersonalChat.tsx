import { useState, useRef, useEffect } from 'react';
import { Send, HeartHandshake, ChevronDown, Copy, Check, Bookmark, ArrowDown, Sparkles, Clock, Paperclip, X, FileText, BarChart2, Camera } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../core/api-client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ArtifactRenderer from '../../components/ArtifactRenderer';
import HistorySidebar from '../../components/HistorySidebar';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  isLoading?: boolean;
}

const preprocessMath = (text: string) => {
  if (!text) return text;
  // Convert $$...$$ to code blocks with language 'math_block'
  let processed = text.replace(/\$\$(.*?)\$\$/gs, '\n```math_block\n$1\n```\n');
  // Convert $...$ to inline code with prefix 'math_inline '
  processed = processed.replace(/\$((?:\\.|[^$\n])*?)\$/g, '`math_inline $1`');
  return processed;
};

export default function PersonalChat() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [model, setModel] = useState<'gemini-flash-latest' | 'gemini-pro-latest' | 'llama-3.3-70b-versatile' | 'llama-3.1-8b-instant' | 'openai/gpt-oss-120b' | 'qwen/qwen3.6-27b'>('gemini-flash-latest');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [graphMode, setGraphMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [attachment, setAttachment] = useState<{ data: string, type: string, name: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachment({ data: base64, type: file.type, name: file.name });
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > 1024 || height > 1024) {
            const ratio = Math.min(1024 / width, 1024 / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL(file.type);
          setAttachment({ data: base64, type: file.type, name: file.name });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = async (id: string, text: string) => {
    setSavedId(id);
    try {
      await apiClient.saves.save('message', text, 'notes');
    } catch (err) {
      console.error('Failed to save message', err);
    }
  };

  useEffect(() => {
    if (sessionId) {
      setIsLoadingHistory(true);
      apiClient.chat.getPersonalHistory(sessionId)
        .then(res => {
          setMessages(res.messages as any);
          setTimeout(scrollToBottom, 100);
        })
        .catch(console.error)
        .finally(() => setIsLoadingHistory(false));
    } else {
      setMessages([]);
      setIsLoadingHistory(false);
    }
  }, [sessionId]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (scrollRef.current && !showScrollBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showScrollBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBottom(isScrolledUp);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [input]);

  const MODELS = [
    { group: 'Google (Gemini)', options: [
      { id: 'gemini-flash-latest', label: 'Gemini Flash', sub: 'Fast & responsive' },
      { id: 'gemini-pro-latest', label: 'Gemini Pro', sub: 'Smart & complex' },
    ]},
    { group: 'Groq (Ultra-Fast)', options: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', sub: 'Best open source' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', sub: 'Fast & capable' },
    ]},
    { group: 'Groq (Smartest & Reasoning)', options: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', sub: 'OpenAI behemoth' },
      { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B', sub: 'Deep thinking & logic' },
    ]}
  ];

  const selectedModelObj = MODELS.flatMap(g => g.options).find(o => o.id === model);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim(), created_at: new Date().toISOString() };
    const loadingMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', isLoading: true, created_at: new Date().toISOString() };
    
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsSending(true);
    setShowScrollBottom(false);
    setTimeout(scrollToBottom, 50);

    try {
      const response = await apiClient.chat.sendPersonalMessage(
        userMsg.content, 
        model, 
        sessionId,
        attachment?.data,
        attachment?.type,
        graphMode
      );
      setAttachment(null);
      setMessages(prev => prev.map(m => 
        m.id === loadingMsg.id 
          ? { ...m, content: response.reply, isLoading: false } 
          : m
      ));
      
      if (!sessionId && response.session_id) {
        navigate(`/personal/${response.session_id}`, { replace: true });
      }
    } catch (error) {
      setMessages(prev => prev.map(m => 
        m.id === loadingMsg.id 
          ? { ...m, content: 'Error: Failed to connect to server.', isLoading: false } 
          : m
      ));
    } finally {
      setIsSending(false);
    }
  };

  const handleNewTopic = () => {
    navigate('/personal');
  };

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'Today';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      
      <HistorySidebar 
        chatType="personal" 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Personal Chat indicator & Model Switcher */}
      <div className="h-14 bg-surface border-b border-border-glass flex items-center justify-between px-4 shrink-0 backdrop-blur-md relative z-20 shadow-glass-sm">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-violet" />
          <span className="text-xs font-semibold text-violet uppercase tracking-wider">
            Personal Space
          </span>
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2.5 bg-surface-strong border border-border-glass rounded-xl px-3 py-1.5 text-sm hover:border-violet/40 hover:bg-violet/5 transition-all shadow-glass-sm group active:scale-95"
          >
            <div className="flex flex-col items-start leading-none text-left">
              <span className="text-[10px] text-violet font-semibold uppercase tracking-wider mb-0.5">Model</span>
              <span className="text-foreground font-medium text-[13px] whitespace-nowrap">{selectedModelObj?.label || 'Select Model'}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-violet' : 'group-hover:text-violet/70'}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-border-glass rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 z-50">
              {MODELS.map((group, i) => (
                <div key={group.group}>
                  {i > 0 && <div className="h-px bg-border-glass my-2 mx-3" />}
                  <div className="px-4 py-1.5 text-[10px] font-bold text-muted uppercase tracking-widest">
                    {group.group}
                  </div>
                  <div className="flex flex-col px-2">
                    {group.options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setModel(opt.id as any);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-violet/10 rounded-lg transition-colors group"
                      >
                        <div className="flex flex-col">
                          <span className={`font-medium text-[13px] ${model === opt.id ? 'text-violet' : 'text-foreground/90 group-hover:text-violet'}`}>
                            {opt.label}
                          </span>
                          <span className="text-[11px] text-muted mt-0.5">{opt.sub}</span>
                        </div>
                        {model === opt.id && <Check className="w-4 h-4 text-violet" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-hide p-4 md:p-8 space-y-8 pb-32"
      >
        {!isLoadingHistory && messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center space-y-6 px-6 text-center">
            <img src="/pwa-192x192.png" alt="Jules" className="w-20 h-20 rounded-3xl shadow-glow-violet animate-pulse-slow ring-1 ring-violet/20" />
            <div className="space-y-2">
              <p className="text-foreground font-semibold text-lg tracking-tight">
                This is a safe space to vent, plan, or just talk.
              </p>
              <p className="text-secondary text-sm tracking-wide uppercase">No academic pressure here.</p>
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const showDate = index === 0 || formatDateLabel(msg.created_at) !== formatDateLabel(prevMsg?.created_at);
          
          return (
            <div key={msg.id} className="w-full flex flex-col max-w-4xl mx-auto space-y-8">
              
              {/* Sticky Date Separator */}
              {showDate && msg.role !== 'system' && (
                <div className="sticky top-4 z-10 flex justify-center mt-8 mb-4 pointer-events-none">
                  <div className="bg-black/20 backdrop-blur-md px-4 py-1 rounded-full border border-white/5 shadow-sm text-[10px] font-bold text-muted uppercase tracking-widest pointer-events-auto">
                    {formatDateLabel(msg.created_at)}
                  </div>
                </div>
              )}

              {/* System Separator */}
              {msg.role === 'system' && (
                <div className="flex justify-center my-6">
                  <div className="text-xs font-semibold text-violet/80 uppercase tracking-widest bg-violet/10 px-4 py-1.5 rounded-full border border-violet/20">
                    {msg.content}
                  </div>
                </div>
              )}

              {msg.role !== 'system' && (
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="max-w-[85%] px-5 py-3.5 text-[15px] leading-relaxed shadow-glass-inset bg-surface-strong border border-border-glass rounded-3xl rounded-br-sm text-foreground">
                        {msg.content}
                      </div>
                      <button 
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-muted hover:text-secondary transition-colors mr-2 mt-1"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-4 w-full max-w-[95%]">
                      <img src="/pwa-192x192.png" alt="Jules" className="w-8 h-8 shrink-0 rounded-full shadow-glow-violet mt-1 ring-1 ring-violet/30" />
                      
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="text-[15px] leading-relaxed text-foreground/95 markdown-body">
                          {msg.isLoading ? (
                            <div className="flex items-center gap-1.5 h-6 mt-1">
                              <div className="w-2 h-2 bg-violet rounded-full animate-bounce" />
                              <div className="w-2 h-2 bg-violet/70 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                              <div className="w-2 h-2 bg-violet/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                            </div>
                          ) : (
                            <div className="markdown-body">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-foreground/90 marker:text-violet/50" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-foreground/90 marker:text-violet/50" {...props} />,
                                  li: ({node, ...props}) => <li className="" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-foreground mt-6 mb-2" {...props} />,
                                  code({node, inline, className, children, ...props}: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isMathBlock = match && match[1] === 'math_block';
                                    const content = String(children).replace(/\n$/, '');
                                    
                                    if (isMathBlock) {
                                      return (
                                        <div
                                        className="overflow-x-auto py-2 my-2 text-center" 
                                        dangerouslySetInnerHTML={{ __html: katex.renderToString(content, { displayMode: true, throwOnError: false }) }} 
                                      />
                                    );
                                  }
                                  
                                  if (content.startsWith('math_inline ')) {
                                    const math = content.replace('math_inline ', '');
                                    return (
                                      <span 
                                        dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }} 
                                      />
                                    );
                                  }
                                  
                                  if (match && match[1] === 'jules-artifact') {
                                    return <ArtifactRenderer content={String(children).replace(/\n$/, '')} />;
                                  }
                                  return <code className={`${className} bg-background/50 px-1.5 py-0.5 rounded text-sm`} {...props}>{children}</code>;
                                },
                              }}
                            >
                              {preprocessMath(msg.content)}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-4 mt-1 w-full opacity-60 hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-secondary hover:text-foreground uppercase tracking-wider transition-colors"
                          >
                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === msg.id ? 'Copied' : 'Copy'}
                          </button>
                          <button 
                            onClick={() => handleSave(msg.id, msg.content)}
                            className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${savedId === msg.id ? 'text-violet' : 'text-secondary hover:text-foreground'}`}
                          >
                            {savedId === msg.id ? <Bookmark className="w-3.5 h-3.5 fill-violet" /> : <Bookmark className="w-3.5 h-3.5" />}
                            {savedId === msg.id ? 'Saved' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollBottom && (
        <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none z-20">
          <button 
            onClick={scrollToBottom}
            className="w-10 h-10 rounded-full bg-surface-strong border border-border-glass shadow-glass-sm flex items-center justify-center text-foreground hover:text-violet transition-colors active-scale pointer-events-auto backdrop-blur-xl animate-fade-in-up"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Input Area (Floating Prompt Bar) */}
      <div className="p-4 md:p-6 shrink-0 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 z-20 pointer-events-none">
        <div className="max-w-3xl mx-auto bg-surface-strong rounded-[2rem] p-2 flex items-end gap-2 transition-all focus-within:border-violet/40 focus-within:shadow-glow-violet border border-border-glass shadow-glass-sm pointer-events-auto relative">
          
          <div className="flex items-center shrink-0 mb-1 ml-0.5 md:ml-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              title="Chat History"
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all text-muted hover:text-violet hover:bg-violet/10 focus:outline-none"
            >
              <Clock className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </button>
            
            <button 
              onClick={handleNewTopic}
              title="Start New Topic"
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all text-muted hover:text-violet hover:bg-violet/10 focus:outline-none"
            >
              <Sparkles className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </button>
          </div>

          <input 
            type="file" 
            accept="image/*,application/pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <div className="flex-1 flex flex-col justify-end min-h-[44px]">
            {attachment && (
              <div className="flex items-center gap-2 mb-2 p-1.5 pr-3 bg-surface border border-border-glass rounded-lg self-start max-w-full">
                <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-background flex items-center justify-center">
                  {attachment.type === 'application/pdf' ? (
                    <FileText className="w-5 h-5 text-red-400" />
                  ) : (
                    <img src={attachment.data} alt="preview" className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="text-[11px] font-medium text-foreground truncate max-w-[120px]">
                  {attachment.name}
                </span>
                <button 
                  onClick={() => setAttachment(null)}
                  className="w-6 h-6 rounded-full bg-surface-strong hover:bg-red-500/20 text-muted hover:text-red-400 flex items-center justify-center transition-colors ml-1 shrink-0 focus:outline-none"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <textarea 
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() || attachment) handleSend();
                }
              }}
              placeholder={attachment ? "Message..." : "Message..."}
              className="w-full max-h-32 resize-none bg-transparent py-3 px-2 outline-none text-[15px] text-foreground placeholder:text-muted scrollbar-hide"
              rows={1}
            />
          </div>
          
          <div className="flex items-center shrink-0 mb-1 mr-0.5 md:mr-1">
            <button 
              onClick={() => setGraphMode(!graphMode)}
              title="Toggle Graph Mode"
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all focus:outline-none ${graphMode ? 'text-violet bg-violet/20 shadow-[0_0_10px_rgba(139,92,246,0.3)]' : 'text-muted hover:text-violet hover:bg-violet/10'}`}
            >
              <BarChart2 className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </button>
            <button 
              onClick={() => cameraInputRef.current?.click()}
              title="Take Photo"
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all text-muted hover:text-violet hover:bg-violet/10 focus:outline-none"
            >
              <Camera className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </button>
            <input 
              type="file" 
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
              capture="environment"
            />

            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Attach File"
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all text-muted hover:text-violet hover:bg-violet/10 focus:outline-none"
            >
              <Paperclip className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </button>
            <button 
              onClick={handleSend}
              disabled={(!input.trim() && !attachment) || isSending}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all bg-violet/10 text-violet hover:bg-violet hover:text-white disabled:opacity-30 disabled:bg-transparent disabled:text-muted focus:outline-none ml-0.5 md:ml-1"
            >
              <Send className="w-4 h-4 md:w-[18px] md:h-[18px] -ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
