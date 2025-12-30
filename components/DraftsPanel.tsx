
import React, { useState, useEffect, useRef } from 'react';
import { Play, Check, Edit2 } from 'lucide-react';
import { Draft, Platform } from '../types';
import { generateDraftContent } from '../services/geminiService';
import { SAMPLE_CODE_SNIPPET } from '../constants';

interface DraftsPanelProps {
  activePlatform: Platform;
  setActivePlatform: (p: Platform) => void;
  triggerContext: string | null; // Simulates "External" event like code change
  toneContext: string;
}

const DraftsPanel: React.FC<DraftsPanelProps> = ({ activePlatform, setActivePlatform, triggerContext, toneContext }) => {
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Draft[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Effect to handle incoming "triggers" from the mock IDE
  useEffect(() => {
    if (triggerContext) {
      handleGenerate(triggerContext);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerContext]);

  const handleGenerate = async (context: string) => {
    setIsGenerating(true);
    setCurrentDraft(null); // Clear previous draft visual immediately
    
    // Simulate thinking/network
    const result = await generateDraftContent(activePlatform, context, SAMPLE_CODE_SNIPPET, toneContext);
    
    const newDraft: Draft = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      platform: activePlatform,
      content: result.content,
      title: result.title,
      mediaUrl: "placeholder",
      posted: false,
    };

    setCurrentDraft(newDraft);
    setIsGenerating(false);
  };

  const handlePost = () => {
    if (!currentDraft) return;
    const postedDraft = { ...currentDraft, posted: true };
    setHistory(prev => [postedDraft, ...prev]);
    setCurrentDraft(null);
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
          <div className="flex items-center justify-center h-full text-df-gray text-sm">
            Start coding – I’m watching.
          </div>
        )}

        {currentDraft && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             {/* Platform Badge for context */}
            <div className="mb-4 text-xs font-bold text-df-orange uppercase tracking-widest">
                DRAFTING FOR {activePlatform}
            </div>

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
      <div className="h-16 flex items-center border-b border-df-border bg-df-black shrink-0">
        <button className="h-full px-4 text-df-white text-xs font-bold hover:text-df-orange border-r border-df-border flex items-center gap-2 transition-colors">
          <Edit2 size={14} /> EDIT
        </button>
        
        <div className="flex-grow flex items-center justify-center gap-4 px-2">
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
        </div>

        <button 
          onClick={handlePost}
          disabled={!currentDraft}
          className={`
            h-full px-8 text-sm font-bold transition-all
            ${currentDraft 
              ? 'bg-df-orange text-df-black hover:bg-white' 
              : 'bg-df-black text-df-gray cursor-not-allowed border-l border-df-border'}
          `}
        >
          {currentDraft ? 'POST' : 'WAITING'}
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
