import { useState, useEffect } from 'react';
import { BookMarked, MessageSquareText, Image as ImageIcon, CheckSquare, ExternalLink } from 'lucide-react';
import { apiClient } from '../../core/api-client';
import type { SavedItem } from '../../core/api-client';

const CATEGORIES = ['All', 'notes', 'revision', 'favorites', 'read_later'];

export default function SavedItems() {
  const [activeTab, setActiveTab] = useState('All');
  
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    const categoryQuery = activeTab === 'All' ? undefined : activeTab;
    apiClient.saves.list(categoryQuery)
      .then(setItems)
      .catch(console.error);
  }, [activeTab]);

  const filteredItems = items;

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquareText className="w-5 h-5" />;
      case 'diagram': return <ImageIcon className="w-5 h-5" />;
      case 'answer': return <CheckSquare className="w-5 h-5" />;
      default: return <BookMarked className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-4 md:p-8 pb-0 max-w-4xl mx-auto w-full shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <BookMarked className="w-8 h-8 text-foreground" />
          <h2 className="text-2xl font-semibold text-foreground">Saved Items</h2>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                activeTab === cat 
                  ? 'bg-accent-tint text-accent border-accent/20 shadow-glow-accent-sm' 
                  : 'glass hover:bg-surface-hover'
              }`}
            >
              {cat === 'All' ? 'All Items' : cat.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-4 max-w-4xl mx-auto w-full">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <BookMarked className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No items found in this category.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredItems.map(item => (
              <div key={item.id} className="glass rounded-2xl p-4 shadow-glass-sm hover:shadow-glass transition-all group hover:bg-surface-hover flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-surface-strong rounded-lg text-secondary border border-border-glass">
                      {getIcon(item.item_type)}
                    </div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wider">
                      {item.item_type}
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <p className="text-sm text-foreground/80 line-clamp-3 mb-4 flex-1">
                  {item.source_reference}
                </p>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs font-medium bg-accent-tint text-accent px-2 py-1 rounded-md border border-accent/15">
                    {item.category.replaceAll('_', ' ')}
                  </span>
                  <button className="text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
