
import React, { useState, useEffect, useRef } from 'react';
import { Check, Edit2, Server, GitBranch, Folder, Play } from 'lucide-react';
import { Draft, Platform, InputEvent } from '../types';
import { generateDraftContent } from '../services/geminiService';
import { useConnections } from '../contexts/ConnectionContext';
import { postTweet, postTweetThread } from '../services/xOAuthService';
import { requireCredits, refundCredits, costsCreditForPlatform } from '../services/creditGate';

interface DraftsPanelProps {
  activePlatform: Platform;
  setActivePlatform: (p: Platform) => void;
  triggerEvent: InputEvent | null;
  toneContext: string;
}

const DraftsPanel: React.FC<DraftsPanelProps> = ({ activePlatform, setActivePlatform, triggerEvent, toneContext }) => {
  const { isConnected } = useConnections();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [lastEvent, setLastEvent] = useState<InputEvent | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedEvents = useRef<Set<number>>(new Set());

  const selectedDraft = drafts.find(d => d.id === selectedDraftId) ?? drafts[0] ?? null;

  const platforms = [Platform.ALL, Platform.X, Platform.REDDIT, Platform.DISCORD, Platform.EMAIL];
  const itemHeight = 48;

  useEffect(() => {
    if (carouselRef.current) {
      const activeIndex = platforms.indexOf(activePlatform);
      const scrollPosition = platforms.length * itemHeight + (activeIndex * itemHeight);
      carouselRef.current.scrollTop = scrollPosition;
    }
  }, []);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const scrollTop = carouselRef.current.scrollTop;
    const totalHeight = platforms.length * itemHeight;
    if (scrollTop < totalHeight * 0.5) {
      carouselRef.current.scrollTop = scrollTop + totalHeight;
    } else if (scrollTop >= totalHeight * 2.5) {
      carouselRef.current.scrollTop = scrollTop - totalHeight;
    }
    const centerOffset = scrollTop % totalHeight;
    const index = Math.round(centerOffset / itemHeight);
    const normalizedIndex = index >= platforms.length ? index % platforms.length : index;
    if (platforms[normalizedIndex] && platforms[normalizedIndex] !== activePlatform) {
      setActivePlatform(platforms[normalizedIndex]);
    }
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => handleScrollEnd(), 150);
  };

  const handleScrollEnd = () => {
    if (!carouselRef.current) return;
    const scrollTop = carouselRef.current.scrollTop;
    const totalHeight = platforms.length * itemHeight;
    const centerOffset = scrollTop % totalHeight;
    const nearestIndex = Math.round(centerOffset / itemHeight);
    const normalizedIndex = nearestIndex >= platforms.length ? nearestIndex % platforms.length : nearestIndex;
    const targetOffset = normalizedIndex * itemHeight;
    const currentSection = Math.floor(scrollTop / totalHeight);
    const targetScrollTop = currentSection * totalHeight + targetOffset;
    carouselRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    if (platforms[normalizedIndex] && platforms[normalizedIndex] !== activePlatform) {
      setActivePlatform(platforms[normalizedIndex]);
    }
  };

  useEffect(() => {
    if (triggerEvent && !processedEvents.current.has(triggerEvent.timestamp)) {
      processedEvents.current.add(triggerEvent.timestamp);
      setLastEvent(triggerEvent);
      handleGenerate(triggerEvent.context, triggerEvent.codeSnippet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerEvent]);

  const handleGenerate = async (context: string, codeSnippet?: string) => {
    const targetPlatform = activePlatform === Platform.ALL ? Platform.X : activePlatform;

    setIsGenerating(true);

    try {
      const result = await generateDraftContent(targetPlatform, context, codeSnippet, toneContext);

      const newDraft: Draft = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        platform: targetPlatform,
        content: result?.content ?? 'No content generated.',
        title: result?.title,
        mediaUrl: "placeholder",
        posted: false,
      };

      setDrafts(prev => [newDraft, ...prev]);
      setSelectedDraftId(newDraft.id);
    } catch (err) {
      console.error('[DraftsPanel] Generate failed:', err);
      const message = err instanceof Error ? err.message : 'Generation failed';
      const errorDraft: Draft = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        platform: targetPlatform,
        content: `[Error] ${message}`,
        title: 'Error generating draft',
        mediaUrl: "placeholder",
        posted: false,
      };
      setDrafts(prev => [errorDraft, ...prev]);
      setSelectedDraftId(errorDraft.id);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!selectedDraft) return;

    const platformMap: Record<Platform, 'x' | 'reddit' | 'discord' | 'email' | null> = {
      [Platform.ALL]: null,
      [Platform.X]: 'x',
      [Platform.REDDIT]: 'reddit',
      [Platform.DISCORD]: 'discord',
      [Platform.EMAIL]: 'email',
    };

    const platformKey = platformMap[selectedDraft.platform];
    if (platformKey && !isConnected(platformKey)) {
      alert(`Please connect your ${selectedDraft.platform} account first. Go to Settings to connect.`);
      return;
    }

    setIsPosting(true);

    try {
      if (platformKey && costsCreditForPlatform(platformKey)) {
        const creditCheck = await requireCredits(platformKey, `Post to ${selectedDraft.platform}`);
        if (!creditCheck.allowed) {
          alert(creditCheck.error || 'Insufficient credits');
          setIsPosting(false);
          return;
        }
      }

      if (selectedDraft.platform === Platform.X) {
        const threadTweets = selectedDraft.content
          .split(/\n\n+/)
          .map(t => t.trim())
          .filter(t => t.length > 0);

        if (threadTweets.length > 1) {
          const result = await postTweetThread(threadTweets);
          console.log(`Posted thread with ${result.tweets.length} tweets:`, result);
          if (result.rateLimit) {
            console.log(`Rate limit: ${result.rateLimit.remaining}/${result.rateLimit.limit} remaining, resets at ${new Date(result.rateLimit.reset * 1000).toLocaleTimeString()}`);
          }
        } else {
          const result = await postTweet(selectedDraft.content.trim());
          console.log('Posted tweet:', result);
          if (result.rateLimit) {
            console.log(`Rate limit: ${result.rateLimit.remaining}/${result.rateLimit.limit} remaining, resets at ${new Date(result.rateLimit.reset * 1000).toLocaleTimeString()}`);
          }
        }
      } else {
        console.warn(`Posting to ${selectedDraft.platform} not yet implemented`);
        alert(`Posting to ${selectedDraft.platform} is not yet implemented.`);
        setIsPosting(false);
        return;
      }

      setDrafts(prev => prev.map(d => d.id === selectedDraft.id ? { ...d, posted: true } : d));
    } catch (error) {
      console.error('Failed to post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (platformKey && costsCreditForPlatform(platformKey)) {
        await refundCredits(1, `Refund: failed to post to ${selectedDraft.platform}`);
      }
      alert(`Failed to post: ${errorMessage}`);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-df-black relative">

      {/* DRAFT FEED */}
      <div ref={feedRef} className="flex-grow overflow-y-auto relative">
        {isGenerating && (
          <div className="sticky top-0 left-0 w-full h-1 bg-df-border overflow-hidden z-10">
            <div className="h-full bg-df-orange animate-pulse w-1/3 mx-auto" />
          </div>
        )}

        {drafts.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
            <span className="text-df-gray text-sm">
              {lastEvent ? 'Ready for next event.' : 'Start coding \u2013 I\u2019m watching.'}
            </span>
            {lastEvent && (
              <div className="flex items-center gap-2 text-[9px] text-df-gray">
                <span>Last:</span>
                {lastEvent.source === 'mcp' && <Server size={10} className="text-df-orange" />}
                {lastEvent.source === 'git' && <GitBranch size={10} className="text-df-orange" />}
                {lastEvent.source === 'watcher' && <Folder size={10} className="text-df-orange" />}
                <span className="text-df-white truncate max-w-[200px]">{lastEvent.context}</span>
              </div>
            )}
          </div>
        )}

        {drafts.map((draft) => {
          const isSelected = draft.id === selectedDraft?.id;
          return (
            <div
              key={draft.id}
              onClick={() => setSelectedDraftId(draft.id)}
              className={`p-5 border-b border-df-border cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-[#111] border-l-2 border-l-df-orange'
                  : 'hover:bg-[#0a0a0a] border-l-2 border-l-transparent'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-df-gray">
                    {new Date(draft.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[9px] font-bold text-df-orange uppercase">{draft.platform}</span>
                </div>
                {draft.posted && (
                  <span className="flex items-center gap-1 text-[9px] text-green-500 font-bold uppercase">
                    <Check size={10} /> Posted
                  </span>
                )}
              </div>

              {/* Title (Reddit) */}
              {draft.title && draft.platform === Platform.REDDIT && (
                <div className="font-bold text-sm text-df-white border-l-2 border-df-border pl-3 mb-2">
                  {draft.title}
                </div>
              )}

              {/* Content */}
              <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-df-white">
                {draft.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* ACTION BAR */}
      <div className="h-20 lg:h-16 flex items-center border-b border-df-border bg-df-black shrink-0">
        <button className="h-full px-4 text-df-white text-xs font-bold hover:text-df-orange border-r border-df-border flex items-center gap-2 transition-colors">
          <Edit2 size={14} /> EDIT
        </button>

        <div className="flex-grow flex items-center justify-center">
          {/* Mobile Vertical Carousel Selector */}
          <div className="lg:hidden relative w-full h-12 overflow-hidden">
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 pointer-events-none">
              <svg className="w-3 h-3 text-df-orange" fill="none" viewBox="0 0 12 12">
                <path fill="currentColor" d="M6 9L1 4h10z" />
              </svg>
            </div>
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-df-black to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-df-black to-transparent z-10 pointer-events-none" />
            <div
              ref={carouselRef}
              className="h-full w-full overflow-y-scroll scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', scrollBehavior: 'auto' }}
              onScroll={handleScroll}
            >
              {[0, 1, 2].map((set) =>
                platforms.map((platform, index) => (
                  <div key={`${set}-${platform}-${index}`} className="h-12 flex items-center justify-center">
                    <span className="text-sm font-bold text-df-orange">{platform}</span>
                  </div>
                ))
              )}
            </div>
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
          </div>

          {/* Desktop Buttons */}
          <div className="hidden lg:flex items-center justify-center gap-4">
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setActivePlatform(p)}
                className={`text-[10px] font-bold transition-colors ${activePlatform === p ? 'text-df-orange' : 'text-df-gray hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handlePost}
          disabled={!selectedDraft || selectedDraft.posted || isPosting}
          className={`h-full px-8 text-sm font-bold transition-all ${
            selectedDraft && !selectedDraft.posted && !isPosting
              ? 'bg-df-orange text-df-black hover:bg-white'
              : 'bg-df-black text-df-gray cursor-not-allowed border-l border-df-border'
          }`}
        >
          {isPosting ? 'POSTING...' : selectedDraft?.posted ? 'POSTED' : selectedDraft ? 'POST' : 'WAITING'}
        </button>
      </div>

      {/* SESSION HISTORY */}
      <div className="h-48 overflow-y-auto bg-black p-4">
        <div className="text-[10px] text-df-gray mb-3 uppercase tracking-wider font-bold">Session History</div>
        <div className="flex flex-col gap-2">
          {drafts.filter(d => d.posted).length === 0 && (
            <div className="text-df-gray/50 text-xs italic">No posts yet this session.</div>
          )}
          {drafts.filter(d => d.posted).map((draft) => (
            <div
              key={draft.id}
              onClick={() => setSelectedDraftId(draft.id)}
              className="group flex items-start gap-3 p-2 hover:bg-[#111] border border-transparent hover:border-df-border cursor-pointer transition-colors"
            >
              <div className="text-[10px] text-df-gray min-w-[30px] pt-1">
                {new Date(draft.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="flex-grow">
                <div className="text-xs text-df-white line-clamp-1 font-mono">
                  {draft.title || draft.content}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-df-orange uppercase">{draft.platform}</span>
                </div>
              </div>
              <Check size={12} className="text-green-500 mt-1" />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default DraftsPanel;
