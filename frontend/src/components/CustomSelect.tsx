import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function CustomSelect({ value, onChange, options, placeholder, className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full glass-input px-5 py-4 text-left transition-all ${
          isOpen ? 'border-accent/40 shadow-[inset_0_1px_1px_rgba(255,138,61,0.2)]' : ''
        }`}
      >
        <span className={`text-[15px] ${selectedOption ? 'text-foreground' : 'text-foreground/50'}`}>
          {selectedOption ? selectedOption.label : placeholder || 'Select...'}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#08090c] border border-border-glass rounded-2xl shadow-glass overflow-hidden opacity-100 transform translate-y-0 transition-all">
          <div className="bg-[rgba(255,255,255,0.035)] backdrop-blur-xl max-h-60 overflow-y-auto py-2 flex flex-col gap-1 px-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl text-[15px] transition-colors flex items-center gap-3 ${
                  value === opt.value 
                    ? 'bg-accent-tint text-accent font-medium' 
                    : 'text-foreground/90 hover:bg-surface-strong'
                }`}
              >
                {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
