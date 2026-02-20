
import React, { useState, useEffect, useRef } from 'react';
import { Play, Check, Edit2, Server, GitBranch, Folder } from 'lucide-react';
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
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [history, setHistory] = useState<Draft[]>([]);
  const [lastEvent, setLastEvent] = useState<InputEvent | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedEvents = useRef<Set<number>>(new Set());
  
  const platforms = [Platform.ALL, Platform.X, Platform.REDDIT, Platform.DISCORD, Platform.EMAIL];

  // Effect to handle incoming input channel events
  useEffect(() => {
    if (triggerEvent && !processedEvents.current.has(triggerEvent.timestamp)) {
      processedEvents.current.add(triggerEvent.timestamp);
      setLastEvent(triggerEvent);
      handleGenerate(triggerEvent.context, triggerEvent.codeSnippet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerEvent]);

  const itemHeight = 48;

  // Effect to initialize carousel position
  useEffect(() => {
    if (carouselRef.current) {
      const activeIndex = platforms.indexOf(activePlatform);
      // Start in the middle section (second set of platforms)
      const scrollPosition = platforms.length * itemHeight + (activeIndex * itemHeight);
      carouselRef.current.scrollTop = scrollPosition;
    }
  }, []); // Only run once on mount

  // Handle scroll to detect which platform is centered and handle infinite loop
  const handleScroll = () => {
    if (!carouselRef.current) return;
    
    const scrollTop = carouselRef.current.scrollTop;
    const totalHeight = platforms.length * itemHeight;
    
    // Infinite scroll loop - seamless jumping
    if (scrollTop < totalHeight * 0.5) {
      // Near the top, jump to middle section
      carouselRef.current.scrollTop = scrollTop + totalHeight;
    } else if (scrollTop >= totalHeight * 2.5) {
      // Near the bottom, jump to middle section
      carouselRef.current.scrollTop = scrollTop - totalHeight;
    }
    
    // Detect which platform is centered
    const centerOffset = scrollTop % totalHeight;
    const index = Math.round(centerOffset / itemHeight);
    const normalizedIndex = index >= platforms.length ? index % platforms.length : index;
    
    if (platforms[normalizedIndex] && platforms[normalizedIndex] !== activePlatform) {
      setActivePlatform(platforms[normalizedIndex]);
    }
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set timeout to snap when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      handleScrollEnd();
    }, 150);
  };

  // Handle scroll end - snap to nearest item
  const handleScrollEnd = () => {
    if (!carouselRef.current) return;
    
    const scrollTop = carouselRef.current.scrollTop;
    const totalHeight = platforms.length * itemHeight;
    const centerOffset = scrollTop % totalHeight;
    
    // Find nearest item
    const nearestIndex = Math.round(centerOffset / itemHeight);
    const normalizedIndex = nearestIndex >= platforms.length ? nearestIndex % platforms.length : nearestIndex;
    
    // Calculate target scroll position (center the item)
    const targetOffset = normalizedIndex * itemHeight;
    const currentSection = Math.floor(scrollTop / totalHeight);
    const targetScrollTop = currentSection * totalHeight + targetOffset;
    
    // Smooth scroll to center the item
    carouselRef.current.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
    
    if (platforms[normalizedIndex] && platforms[normalizedIndex] !== activePlatform) {
      setActivePlatform(platforms[normalizedIndex]);
    }
  };

  const handleGenerate = async (context: string, codeSnippet?: string) => {
    // If ALL is selected, default to X for generation
    const targetPlatform = activePlatform === Platform.ALL ? Platform.X : activePlatform;

    setIsGenerating(true);
    setCurrentDraft(null); // Clear previous draft visual immediately

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

      setCurrentDraft(newDraft);
    } catch (err) {
      console.error('[DraftsPanel] Generate failed:', err);
      const message = err instanceof Error ? err.message : 'Generation failed';
      setCurrentDraft({
        id: Date.now().toString(),
        timestamp: Date.now(),
        platform: targetPlatform,
        content: `[Error] ${message}`,
        title: 'Error generating draft',
        mediaUrl: "placeholder",
        posted: false,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!currentDraft) return;

    // Validate connection for the platform
    const platformMap: Record<Platform, 'x' | 'reddit' | 'discord' | 'email' | null> = {
      [Platform.ALL]: null,
      [Platform.X]: 'x',
      [Platform.REDDIT]: 'reddit',
      [Platform.DISCORD]: 'discord',
      [Platform.EMAIL]: 'email',
    };

    const platformKey = platformMap[currentDraft.platform];
    if (platformKey && !isConnected(platformKey)) {
      alert(`Please connect your ${currentDraft.platform} account first. Go to Settings to connect.`);
      return;
    }

    setIsPosting(true);

    try {
      // Check credits for paid platforms (X, Reddit, Discord)
      const platformKey = platformMap[currentDraft.platform];
      if (platformKey && costsCreditForPlatform(platformKey)) {
        const creditCheck = await requireCredits(platformKey, `Post to ${currentDraft.platform}`);
        if (!creditCheck.allowed) {
          alert(creditCheck.error || 'Insufficient credits');
          setIsPosting(false);
          return;
        }
      }

      // Handle X/Twitter posting
      if (currentDraft.platform === Platform.X) {
        // Check if content contains double newlines (thread indicator)
        // Split by double newlines and filter out empty tweets
        const threadTweets = currentDraft.content
          .split(/\n\n+/)
          .map(t => t.trim())
          .filter(t => t.length > 0);
        
        if (threadTweets.length > 1) {
          // Post as thread
          const result = await postTweetThread(threadTweets);
          console.log(`Posted thread with ${result.tweets.length} tweets:`, result);
          
          // Log rate limit info if available
          if (result.rateLimit) {
            console.log(`Rate limit: ${result.rateLimit.remaining}/${result.rateLimit.limit} remaining, resets at ${new Date(result.rateLimit.reset * 1000).toLocaleTimeString()}`);
          }
        } else {
          // Post as single tweet
          const result = await postTweet(currentDraft.content.trim());
          console.log('Posted tweet:', result);
          
          // Log rate limit info if available
          if (result.rateLimit) {
            console.log(`Rate limit: ${result.rateLimit.remaining}/${result.rateLimit.limit} remaining, resets at ${new Date(result.rateLimit.reset * 1000).toLocaleTimeString()}`);
          }
        }
      } else {
        // TODO: Implement posting for other platforms (Reddit, Discord, Email)
        console.warn(`Posting to ${currentDraft.platform} not yet implemented`);
        alert(`Posting to ${currentDraft.platform} is not yet implemented.`);
        setIsPosting(false);
        return;
      }

      // Mark as posted and add to history
      const postedDraft = { ...currentDraft, posted: true };
      setHistory(prev => [postedDraft, ...prev]);
      setCurrentDraft(null);
    } catch (error) {
      console.error('Failed to post:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      // Refund credit if posting failed on a paid platform
      if (platformKey && costsCreditForPlatform(platformKey)) {
        await refundCredits(1, `Refund: failed to post to ${currentDraft.platform}`);
      }
      alert(`Failed to post: ${errorMessage}`);
    } finally {
      setIsPosting(false);
    }
  };

  const loadFromHistory = (draft: Draft) => {
    // Switch platform if needed
    if (draft.platform !== activePlatform) setActivePlatform(draft.platform);
    setCurrentDraft({ ...draft, posted: false }); // Reset posted state to allow "Repost" or edit
  };

  return (
    <div className="flex flex-col h-full w-full bg-df-black relative">
      
      {/* 1. TOP: CURRENT DRAFT */}
      <div className="flex-grow flex flex-col p-6 border-b border-df-border overflow-y-auto relative min-h-[50%]">
        {isGenerating && (
          <div className="absolute top-0 left-0 w-full h-1 bg-df-border overflow-hidden">
             <div className="h-full bg-df-orange animate-pulse w-1/3 mx-auto"></div>
          </div>
        )}

        {!currentDraft && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="text-df-gray text-sm">
              {lastEvent ? 'Ready for next event.' : 'Start coding – I’m watching.'}
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

        {currentDraft && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             {/* Platform Badge for context */}
            {activePlatform !== Platform.ALL && (
              <div className="mb-4 text-xs font-bold text-df-orange uppercase tracking-widest">
                  DRAFTING FOR {activePlatform}
              </div>
            )}

            {activePlatform === Platform.REDDIT && currentDraft.title && (
              <div className="mb-4 font-bold text-lg text-df-white border-l-2 border-df-border pl-3">
                {currentDraft.title}
              </div>
            )}

            <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-df-white">
              {currentDraft.content}
            </div>

            {/* Media Attachment Stub */}
            <div className="mt-6 border border-df-border bg-black w-full max-w-[240px] relative group cursor-pointer">
               <div className="aspect-video bg-[#111] p-2 flex flex-col gap-1 overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
                  <div className="h-1 w-2/3 bg-df-gray/20"></div>
                  <div className="h-1 w-1/2 bg-df-gray/20"></div>
                  <div className="h-1 w-3/4 bg-df-gray/20"></div>
                  <div className="mt-2 text-[10px] text-df-orange font-mono">diff --git a/auth.ts</div>
               </div>
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-df-orange/10 p-2 rounded-full border border-df-orange">
                     <Play className="w-4 h-4 text-df-orange fill-current" />
                  </div>
               </div>
            </div>
            
          </div>
        )}
      </div>

      {/* 2. MIDDLE: ACTION BAR */}
      <div className="h-20 lg:h-16 flex items-center border-b border-df-border bg-df-black shrink-0">
        <button className="h-full px-4 text-df-white text-xs font-bold hover:text-df-orange border-r border-df-border flex items-center gap-2 transition-colors">
          <Edit2 size={14} /> EDIT
        </button>
        
        <div className="flex-grow flex items-center justify-center">
          {/* Mobile Vertical Carousel Selector */}
          <div className="lg:hidden relative w-full h-12 overflow-hidden">
            {/* Orange downward arrow on the right */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 pointer-events-none">
              <svg 
                className="w-3 h-3 text-df-orange"
                fill="none" 
                viewBox="0 0 12 12"
              >
                <path fill="currentColor" d="M6 9L1 4h10z" />
              </svg>
            </div>
            
            {/* Mask gradients for fade effect */}
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-df-black to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-df-black to-transparent z-10 pointer-events-none" />
            
            {/* Infinite scrollable carousel */}
            <div
              ref={carouselRef}
              className="h-full w-full overflow-y-scroll scrollbar-hide"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'auto'
              }}
              onScroll={handleScroll}
            >
              {/* First set of platforms (for infinite scroll) */}
              {platforms.map((platform, index) => (
                <div
                  key={`first-${platform}-${index}`}
                  className="h-12 flex items-center justify-center"
                >
                  <span className="text-sm font-bold text-df-orange">
                    {platform}
                  </span>
                </div>
              ))}
              
              {/* Second set of platforms (for infinite scroll) */}
              {platforms.map((platform, index) => (
                <div
                  key={`second-${platform}-${index}`}
                  className="h-12 flex items-center justify-center"
                >
                  <span className="text-sm font-bold text-df-orange">
                    {platform}
                  </span>
                </div>
              ))}
              
              {/* Third set of platforms (for infinite scroll) */}
              {platforms.map((platform, index) => (
                <div
                  key={`third-${platform}-${index}`}
                  className="h-12 flex items-center justify-center"
                >
                  <span className="text-sm font-bold text-df-orange">
                    {platform}
                  </span>
                </div>
              ))}
            </div>
            
            <style>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
            `}</style>
          </div>
          
          {/* Desktop Buttons */}
          <div className="hidden lg:flex items-center justify-center gap-4">
            <button 
              onClick={() => setActivePlatform(Platform.ALL)}
              className={`text-[10px] font-bold transition-colors ${activePlatform === Platform.ALL ? 'text-df-orange' : 'text-df-gray hover:text-white'}`}
            >
              ALL
            </button>
            <button 
              onClick={() => setActivePlatform(Platform.X)}
              className={`text-[10px] font-bold transition-colors ${activePlatform === Platform.X ? 'text-df-orange' : 'text-df-gray hover:text-white'}`}
            >
              X
            </button>
            <button 
               onClick={() => setActivePlatform(Platform.REDDIT)}
               className={`text-[10px] font-bold transition-colors ${activePlatform === Platform.REDDIT ? 'text-df-orange' : 'text-df-gray hover:text-white'}`}
            >
              REDDIT
            </button>
            <button 
               onClick={() => setActivePlatform(Platform.DISCORD)}
               className={`text-[10px] font-bold transition-colors ${activePlatform === Platform.DISCORD ? 'text-df-orange' : 'text-df-gray hover:text-white'}`}
            >
              DISCORD
            </button>
            <button 
               onClick={() => setActivePlatform(Platform.EMAIL)}
               className={`text-[10px] font-bold transition-colors ${activePlatform === Platform.EMAIL ? 'text-df-orange' : 'text-df-gray hover:text-white'}`}
            >
              EMAIL
            </button>
          </div>
        </div>

        <button 
          onClick={handlePost}
          disabled={!currentDraft || isPosting}
          className={`
            h-full px-8 text-sm font-bold transition-all
            ${currentDraft && !isPosting
              ? 'bg-df-orange text-df-black hover:bg-white' 
              : 'bg-df-black text-df-gray cursor-not-allowed border-l border-df-border'}
          `}
        >
          {isPosting ? 'POSTING...' : currentDraft ? 'POST' : 'WAITING'}
        </button>
      </div>

      {/* 3. BOTTOM: SESSION LOG */}
      <div className="h-48 overflow-y-auto bg-black p-4">
         <div className="text-[10px] text-df-gray mb-3 uppercase tracking-wider font-bold">Session History</div>
         <div className="flex flex-col gap-2">
            {history.length === 0 && (
                <div className="text-df-gray/50 text-xs italic">No posts yet this session.</div>
            )}
            {history.map((draft) => (
                <div 
                  key={draft.id} 
                  onClick={() => loadFromHistory(draft)}
                  className="group flex items-start gap-3 p-2 hover:bg-[#111] border border-transparent hover:border-df-border cursor-pointer transition-colors"
                >
                    <div className="text-[10px] text-df-gray min-w-[30px] pt-1">
                        {new Date(draft.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div className="flex-grow">
                        <div className="text-xs text-df-white line-clamp-1 font-mono">
                            {draft.title || draft.content}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-df-orange uppercase">{draft.platform}</span>
                        </div>
                    </div>
                    {draft.posted && <Check size={12} className="text-df-orange mt-1" />}
                </div>
            ))}
         </div>
      </div>

    </div>
  );
};

export default DraftsPanel;
