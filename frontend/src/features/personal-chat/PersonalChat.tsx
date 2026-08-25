import { useState, useRef, useEffect } from 'react';
import { Send, HeartHandshake, ChevronDown, Copy, Check, Bookmark, ArrowDown, Clock, Paperclip, X, FileText, RefreshCw, Wand2, Network } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../core/api-client';
import { vibrate } from '../../core/haptics';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ArtifactRenderer from '../../components/ArtifactRenderer';
import HistorySidebar from '../../components/HistorySidebar';
import { useModels } from '../../core/useModels';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  isLoading?: boolean;
  isError?: boolean;
  attachment?: { data: string; type: string; name: string };
}

const preprocessMath = (text: string) => {
  if (!text) return text;
  // Convert $$...$$ to code blocks with language 'math_block'
  let processed = text.replace(/\$\$(.*?)\$\$/gs, '\n```math_block\n$1\n```\n');
  // Convert $...$ to inline code with prefix 'math_inline '
  processed = processed.replace(/\$((?:\\.|[^$\n])*?)\$/g, '`math_inline $1`');
  
  // Artifact preprocessing — strict </html> match, no greedy $ fallback
  processed = processed.replace(/```(?:html|jules-artifact)?\s*(<artifact-title>[\s\S]*?<\/html>)\s*```/ig, '$1');
  processed = processed.replace(/(<artifact-title>[\s\S]*?<\/html>)/ig, '\n```jules-artifact\n$1\n```\n');
  
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
  const [model, setModel] = useState<string>('gemini-3.7-flash');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Slash Command State
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [chatMode, setChatMode] = useState<string>('normal');

  const COMMANDS = [
    { id: 'graph', icon: Network, label: 'Graph Diagram', desc: 'Concept maps & node connections', type: 'mode' },
    { id: 'widget', icon: Wand2, label: 'Interactive Widget', desc: 'Interactive physics/chemistry models', type: 'mode' },
    { id: 'diagram', icon: FileText, label: 'Normal Diagram', desc: 'Standard flowcharts & diagrams', type: 'mode' },
    { id: 'history', icon: Clock, label: 'History', desc: 'View previous sessions', type: 'action' },
    { id: 'new', icon: RefreshCw, label: 'New Topic', desc: 'Start a fresh conversation', type: 'action' },
  ];

  const filteredCommands = COMMANDS.filter(c => 
    c.id.includes(commandFilter) || 
    c.label.toLowerCase().includes(commandFilter)
  );

  const executeCommand = (cmdId: string) => {
    setShowCommandMenu(false);
    setInput('');
    const cmd = COMMANDS.find(c => c.id === cmdId);
    if (cmd?.type === 'mode') {
      setChatMode(cmdId);
    } else if (cmdId === 'history') {
      setIsSidebarOpen(true);
    } else if (cmdId === 'new') {
      handleNewTopic();
    } else if (cmdId === 'clear') {
      setMessages([]);
    }
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [attachment, setAttachment] = useState<{ data: string, type: string, name: string } | null>(null);

  // Fetch model list from backend (single source of truth — edit src/config.py to update)
  const { groups: modelGroups, defaultModelId } = useModels();
  useEffect(() => { setModel(defaultModelId); }, [defaultModelId]);
  const selectedModelObj = modelGroups.flatMap(g => g.options).find(o => o.id === model);

  const processImageFile = (file: File) => {
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
        
        const base64 = canvas.toDataURL('image/jpeg', 0.6);
        setAttachment({ data: base64, type: 'image/jpeg', name: file.name || 'pasted-image.jpg' });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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
      processImageFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
          break;
        }
      }
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



  const MODE_PROMPTS: Record<string, string> = {
    widget: "\n\n[INSTRUCTION: Generate an interactive HTML/JS widget/artifact to visualize this concept. Enclose the code strictly in a ```jules-artifact``` code block and include an <artifact-title> at the top. CRITICAL RULES: 1) Use standard HTML5 <canvas> and Vanilla JS (requestAnimationFrame) for physics simulations. Do NOT use p5.js or external math libraries. 2) DO NOT use 'math_inline' or 'math_block' markdown inside the HTML; use standard unicode or HTML entities (e.g., &tau;, &theta;). 3) Use Tailwind CSS (via CDN) for beautiful dark mode glassmorphism UI (Bg: #08090c, Text: white, Accents: #8b5cf6 violet). 4) Ensure the canvas is correctly appended and fully visible. Include Start/Pause/Reset controls if applicable.]",
    graph: "\n\n[INSTRUCTION: Generate a Mermaid.js mindmap or node-graph (inside a markdown block) to show how these concepts connect.]",
    diagram: "\n\n[INSTRUCTION: Generate a Mermaid.js flowchart or standard diagram (inside a markdown block) for this process.]"
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isSending) return;
    vibrate(30);
    
    let finalContent = input.trim();
    if (chatMode !== 'normal' && MODE_PROMPTS[chatMode]) {
      finalContent += MODE_PROMPTS[chatMode];
    }
    
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: finalContent, 
      created_at: new Date().toISOString(),
      attachment: attachment ? { ...attachment } : undefined
    };
    const loadingMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', isLoading: true, created_at: new Date().toISOString() };
    
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setChatMode('normal');
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
        chatMode === 'graph'
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
      const errorMessages = [
        "Jules is taking a quick chai break ☕ — try again in a moment!",
        "Oops, server thoda busy hai abhi. Ek baar phir try karo!",
        "Connection hiccup! Don't worry, ye temporary hai.",
        "Server abhi rest le raha hai 😴 — ek minute mein wapas aayega!",
      ];
      const friendlyMsg = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      setMessages(prev => prev.map(m => 
        m.id === loadingMsg.id 
          ? { ...m, content: friendlyMsg, isLoading: false, isError: true } 
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
              {modelGroups.map((group, i) => (
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
                      <div className="max-w-[85%] px-5 py-3.5 text-[15px] leading-relaxed shadow-glass-inset bg-surface-strong border border-border-glass rounded-3xl rounded-br-sm text-foreground flex flex-col gap-3">
                        {msg.attachment && (
                          <div className="w-full max-w-sm rounded-xl overflow-hidden border border-border-glass">
                            {msg.attachment.type === 'application/pdf' ? (
                              <div className="flex items-center gap-2 p-3 bg-background">
                                <FileText className="w-5 h-5 text-red-400" />
                                <span className="text-sm font-medium truncate">{msg.attachment.name}</span>
                              </div>
                            ) : (
                              <img src={msg.attachment.data} alt="attachment" className="w-full h-auto object-cover max-h-[300px]" />
                            )}
                          </div>
                        )}
                        {msg.content && <div>{msg.content}</div>}
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
                          {msg.isError ? (
                            <div className="flex flex-col gap-3">
                              <div className="glass rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
                                <p className="text-sm text-foreground/90">{msg.content}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
                                  if (lastUserMsg) {
                                    setMessages(prev => prev.filter(m => m.id !== msg.id));
                                    setInput(lastUserMsg.content);
                                  }
                                }}
                                className="self-start flex items-center gap-2 px-4 py-2 text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-xl hover:bg-violet-500/20 transition-colors active-scale"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Retry
                              </button>
                            </div>
                          ) : msg.isLoading ? (
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
                                  
                                  if (String(children).replace(/\n$/, '').trim().startsWith('<artifact-title>')) {
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
        <div className="max-w-3xl mx-auto bg-[#12131a] rounded-[28px] p-2 flex items-end gap-2 transition-all focus-within:border-violet/50 border border-border-glass shadow-lg pointer-events-auto relative">
          
          {/* Slash Command Menu Popup */}
          {showCommandMenu && (
            <div className="absolute bottom-[calc(100%+12px)] left-4 min-w-[240px] bg-[#12131a] border-2 border-border-glass rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[100] animate-fade-in-up">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${idx === selectedCommandIndex ? 'bg-violet/15' : 'hover:bg-surface'}`}
                    onClick={() => executeCommand(cmd.id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${idx === selectedCommandIndex ? 'bg-violet/20 text-violet' : 'bg-[#1a1b23] text-muted'}`}>
                      <cmd.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${idx === selectedCommandIndex ? 'text-violet' : 'text-foreground'}`}>/{cmd.id}</div>
                      <div className="text-[11px] text-muted truncate">{cmd.desc}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted">No commands found</div>
              )}
            </div>
          )}

          <div className="flex items-center shrink-0 mb-0.5 ml-1 gap-0.5">
            <button 
              onClick={() => {
                setInput('/');
                setShowCommandMenu(true);
                setCommandFilter('');
                setSelectedCommandIndex(0);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              title="Slash Commands"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all text-muted hover:text-violet hover:bg-violet/10 focus:outline-none"
            >
              <div className="w-5 h-5 flex items-center justify-center font-bold text-sm bg-border-glass rounded border border-muted/30">/</div>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Attach File or Image"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all text-muted hover:text-violet hover:bg-violet/10 focus:outline-none"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <input 
            type="file" 
            accept="image/*,application/pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[38px]">
            {chatMode !== 'normal' && (
              <div className="flex items-center gap-1.5 mb-1.5 self-start bg-violet/15 border border-violet/20 rounded-md px-2 py-0.5 ml-1 transition-all mt-1">
                <span className="text-[10px] font-bold text-violet uppercase tracking-wider">
                  {COMMANDS.find(c => c.id === chatMode)?.label}
                </span>
                <button 
                  onClick={() => setChatMode('normal')}
                  className="text-violet/70 hover:text-violet rounded-full p-0.5 transition-colors"
                  title="Clear Mode"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            {attachment && (
              <div className="flex items-center gap-2 mb-2 mt-1 p-1.5 pr-2 bg-surface border border-border-glass rounded-lg self-start max-w-full min-w-0 ml-1">
                <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-[#08090c] flex items-center justify-center">
                  {attachment.type === 'application/pdf' ? (
                    <FileText className="w-5 h-5 text-red-400" />
                  ) : (
                    <img src={attachment.data} alt="preview" className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="flex-1 min-w-0 text-[11px] font-medium text-foreground truncate">
                  {attachment.name}
                </span>
                <button 
                  onClick={() => setAttachment(null)}
                  className="w-6 h-6 rounded-full bg-[#1a1b23] hover:bg-red-500/20 text-muted hover:text-red-400 flex items-center justify-center transition-colors shrink-0 focus:outline-none"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            <textarea 
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                if (val === '/' || val.startsWith('/')) {
                  setShowCommandMenu(true);
                  setCommandFilter(val.substring(1).toLowerCase());
                  setSelectedCommandIndex(0);
                } else {
                  setShowCommandMenu(false);
                }
              }}
              onKeyDown={(e) => {
                if (showCommandMenu) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedCommandIndex(prev => (prev + 1) % (filteredCommands.length || 1));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedCommandIndex(prev => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredCommands[selectedCommandIndex]) {
                      executeCommand(filteredCommands[selectedCommandIndex].id);
                    }
                    return;
                  }
                  if (e.key === 'Escape') {
                    setShowCommandMenu(false);
                    return;
                  }
                }
                
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() || attachment) handleSend();
                }
              }}
              onPaste={handlePaste}
              placeholder={attachment ? "Message..." : "Message or type '/' for commands..."}
              className="w-full max-h-32 resize-none bg-transparent py-2 px-2 outline-none text-[15px] leading-relaxed text-foreground placeholder:text-muted/60 scrollbar-hide"
              rows={1}
            />
          </div>
          
          <div className="flex items-center shrink-0 mb-0.5 mr-1">
            <button 
              onClick={handleSend}
              disabled={(!input.trim() && !attachment) || isSending}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all focus:outline-none ${((!input.trim() && !attachment) || isSending) ? 'opacity-0 scale-90 w-0 md:w-0 overflow-hidden' : 'bg-violet/10 text-violet hover:bg-violet hover:text-white scale-100 ml-1'}`}
            >
              <Send className="w-4 h-4 -ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
