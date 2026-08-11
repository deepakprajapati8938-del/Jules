import { useState } from 'react';
import { FileText, Loader2, BookOpen } from 'lucide-react';
import { NEET_SYLLABUS } from '../../core/syllabus';
import CustomSelect from '../../components/CustomSelect';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function CheatSheet() {
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cheatSheetContent, setCheatSheetContent] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!chapter) return;
    setIsLoading(true);
    setCheatSheetContent(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cheatsheet?chapter_name=${encodeURIComponent(chapter)}`);
      if (!response.ok) {
        let errorMsg = "Failed to generate cheatsheet";
        try {
          const errorData = await response.json();
          if (errorData.detail) errorMsg = errorData.detail;
        } catch (e) {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setCheatSheetContent(data.content);
    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message || 'Make sure the backend is running.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const preprocessMath = (text: string) => {
    if (!text) return text;
    let processed = text.replace(/\$\$(.*?)\$\$/gs, '\n```math_block\n$1\n```\n');
    processed = processed.replace(/\$((?:\\.|[^$\n])*?)\$/g, '`math_inline $1`');
    
    // Artifact preprocessing
    processed = processed.replace(/```(?:html|jules-artifact)?\s*(<artifact-title>[\s\S]*?(?:<\/html>|$))\s*(?:```)?/ig, '$1');
    processed = processed.replace(/(<artifact-title>[\s\S]*?(?:<\/html>|$))/ig, '\n```jules-artifact\n$1\n```\n');
    
    return processed;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-foreground" />
          <h2 className="text-2xl font-semibold text-foreground">Cheat Sheet Generator</h2>
        </div>

        <div className="glass-strong rounded-3xl p-6 md:p-8 shadow-glass mb-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary flex items-center gap-2 uppercase tracking-wider">
                <BookOpen className="w-4 h-4" /> Subject
              </label>
              <CustomSelect
                value={subject}
                onChange={(val) => { setSubject(val); setChapter(''); }}
                placeholder="Select Subject..."
                options={[
                  { value: 'Physics', label: 'Physics' },
                  { value: 'Chemistry', label: 'Chemistry' },
                  { value: 'Biology', label: 'Biology' }
                ]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary flex items-center gap-2 uppercase tracking-wider">
                <FileText className="w-4 h-4" /> Chapter
              </label>
              <CustomSelect
                value={chapter}
                onChange={setChapter}
                placeholder="Select Chapter..."
                options={subject && NEET_SYLLABUS[subject] ? NEET_SYLLABUS[subject].map(ch => ({ value: ch, label: ch })) : []}
              />
            </div>
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={!chapter || isLoading}
            className="btn-accent w-full py-4 text-[15px] flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate Quick-Revision Sheet'}
          </button>
        </div>

        {cheatSheetContent && (
          <div className="glass rounded-3xl p-6 md:p-10 shadow-glass-inset animate-fade-in-up">
            <div className="text-lg md:text-[17px] text-foreground leading-relaxed markdown-body">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-foreground/90 marker:text-accent/50" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-foreground/90 marker:text-accent/50" {...props} />,
                  li: ({node, ...props}) => <li className="" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                  h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-white mb-6 tracking-tight border-b border-border-glass pb-4" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-2xl font-semibold text-white mt-8 mb-4 tracking-tight" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-accent mt-6 mb-2" {...props} />,
                  code: ({node, inline, className, children, ...props}: any) => {
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
                    
                    return <code className={`${className} bg-surface-strong px-1.5 py-0.5 rounded text-sm text-amber-400 font-mono`} {...props}>{children}</code>;
                  },
                }}
              >
                {preprocessMath(cheatSheetContent)}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
