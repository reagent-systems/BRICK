import React, { useState, useEffect } from 'react';
import { RefreshCw, MessageSquare, ExternalLink, AlertCircle } from 'lucide-react';
import { FeedbackItem } from '../types';
import { fetchAllFeedback, FeedbackFetchOptions } from '../services/feedbackService';
import { useConnections } from '../contexts/ConnectionContext';

const FeedbackPanel: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'question' | 'bug' | 'request' | 'positive'>('all');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  const { hasAnyConnection, connections } = useConnections();

  // Fetch feedback on mount and when connections change
  useEffect(() => {
    if (hasAnyConnection()) {
      loadFeedback();
    } else {
      setItems([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.x, connections.reddit, connections.discord, connections.email]);

  const loadFeedback = async (options?: FeedbackFetchOptions) => {
    if (!hasAnyConnection()) {
      setItems([]);
      setLoading(false);
      return;
    }

    // Prevent requests if we've made one in the last 15 minutes (rate limit protection)
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds
    if (timeSinceLastRequest < FIFTEEN_MINUTES && lastRequestTime > 0) {
      const minutesRemaining = Math.ceil((FIFTEEN_MINUTES - timeSinceLastRequest) / (60 * 1000));
      setError(`Please wait ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} before refreshing again to avoid rate limits.`);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setLastRequestTime(now);
      const feedback = await fetchAllFeedback(options);
      setItems(feedback);
      setLastFetchTime(now);
    } catch (err) {
      console.error('Failed to load feedback:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load feedback';
      setError(errorMessage);
      
      // If it's a rate limit error, show a more helpful message
      if (errorMessage.includes('Rate limit')) {
        setError('X API rate limit exceeded. Please wait a few minutes before refreshing.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    // Prevent rapid refreshes
    if (loading) return;
    await loadFeedback({ since: lastFetchTime || undefined });
  };

  // When "all" is selected, show all items without filtering
  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(item => item.type === filter);

  // Group by thread
  const groupedItems: Record<string, FeedbackItem[]> = {};
  filteredItems.forEach(item => {
    if (!groupedItems[item.threadTitle]) {
      groupedItems[item.threadTitle] = [];
    }
    groupedItems[item.threadTitle].push(item);
  });

  return (
    <div className="flex flex-col h-full w-full bg-df-black">
      
      {/* FILTER BAR */}
      <div className="flex items-center justify-between p-4 border-b border-df-border">
         <div className="flex gap-4 text-[10px] font-bold overflow-x-auto no-scrollbar">
            {['ALL', 'QUESTION', 'BUG', 'REQUEST', 'POSITIVE'].map((f) => (
                <button
                    key={f}
                    onClick={() => setFilter(f.toLowerCase() as any)}
                    className={`pb-1 border-b-4 transition-colors whitespace-nowrap ${filter === f.toLowerCase() ? 'border-df-orange text-df-white' : 'border-transparent text-df-gray hover:text-df-white'}`}
                >
                    {f}s
                </button>
            ))}
         </div>
         <button 
            onClick={handleRefresh}
            disabled={loading || !hasAnyConnection()}
            className={`text-df-gray hover:text-df-orange transition-colors ${loading ? 'animate-spin' : ''} ${!hasAnyConnection() ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Refresh feedback"
         >
            <RefreshCw size={14} />
         </button>
      </div>

      {/* FEED */}
      <div className="flex-grow overflow-y-auto p-4">
        {!hasAnyConnection() && (
          <div className="text-center text-df-gray text-xs mt-10 flex flex-col items-center gap-2">
            <AlertCircle size={16} className="text-df-orange" />
            <div>Connect a platform in Settings to see feedback.</div>
          </div>
        )}
        
        {hasAnyConnection() && loading && items.length === 0 && (
          <div className="text-center text-df-gray text-xs mt-10">Loading feedback...</div>
        )}
        
        {hasAnyConnection() && error && (
          <div className="text-center text-df-gray text-xs mt-10 flex flex-col items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <div>{error}</div>
            <button 
              onClick={() => loadFeedback()}
              className="text-df-orange hover:text-df-white text-[10px] mt-2"
            >
              Retry
            </button>
          </div>
        )}
        
        {hasAnyConnection() && !loading && Object.keys(groupedItems).length === 0 && (
            <div className="text-center text-df-gray text-xs mt-10">No feedback matching this filter.</div>
        )}

        {Object.entries(groupedItems).map(([threadTitle, feedbackList]) => (
            <div key={threadTitle} className="mb-8">
                <div className="flex items-center gap-2 mb-4 text-df-gray group cursor-pointer hover:text-df-white transition-colors">
                   <MessageSquare size={12} />
                   <h3 className="text-xs uppercase tracking-wider font-bold truncate max-w-[280px]">{threadTitle}</h3>
                   <div className="h-[1px] bg-df-border flex-grow"></div>
                </div>

                <div className="flex flex-col gap-4">
                    {feedbackList.map(item => (
                        <div key={item.id} className="relative pl-4 border-l border-df-border hover:border-df-orange transition-colors group/item">
                            {/* Priority Indicator */}
                            {(item.type === 'bug' || item.type === 'question') && (
                                <div className="absolute left-[-1px] top-0 bottom-0 w-[1px] bg-df-orange"></div>
                            )}

                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-df-white">{item.username}</span>
                                <span className="text-[10px] text-df-gray">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>

                            <p className="text-xs text-df-gray leading-relaxed font-mono mb-2 group-hover/item:text-df-white transition-colors">
                                {item.content}
                            </p>

                            <div className="flex items-center justify-between">
                                <span className={`text-[9px] uppercase px-1 border ${
                                    item.type === 'bug' ? 'border-red-900 text-red-500' :
                                    item.type === 'positive' ? 'border-green-900 text-green-500' :
                                    'border-df-border text-df-gray'
                                }`}>
                                    {item.type}
                                </span>
                                
                                <button className="text-[10px] text-df-orange flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    REPLY <ExternalLink size={10} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>

    </div>
  );
};

export default FeedbackPanel;