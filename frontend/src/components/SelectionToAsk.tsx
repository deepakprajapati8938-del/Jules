import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SelectionToAsk() {
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const handleSelectionChange = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed) {
            setSelectionRect(null);
            setSelectedText('');
            return;
          }
  
          const text = selection.toString().trim();
          if (text.length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            // Don't show if rect is collapsed (width/height 0)
            if (rect.width > 0 && rect.height > 0) {
              setSelectionRect(rect);
              setSelectedText(text);
            }
          } else {
            setSelectionRect(null);
            setSelectedText('');
          }
        }, 100); // Small debounce
      };
  
      document.addEventListener('selectionchange', handleSelectionChange);
  
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        clearTimeout(timeoutId);
      };
  }, []);

  const handleAskJules = () => {
    // Clear selection so the tooltip goes away
    window.getSelection()?.removeAllRanges();
    setSelectionRect(null);
    
    // Navigate to NCERT chat and pass the selected text
    navigate('/chat', { state: { prefill: `Regarding: "${selectedText}"\n\nI didn't understand this. Can you explain?` } });
  };

  if (!selectionRect || !selectedText) return null;

  return createPortal(
    <div 
      className="fixed z-[300] animate-fade-in-up"
      style={{
        top: selectionRect.top - 48, // show above the selection
        left: selectionRect.left + (selectionRect.width / 2) - 60, // center it horizontally
      }}
    >
      <button 
        onClick={handleAskJules}
        className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-full shadow-glow-accent text-xs font-semibold hover:scale-105 transition-transform"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Ask Jules
      </button>
    </div>,
    document.body
  );
}
