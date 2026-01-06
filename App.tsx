
import React, { useState } from 'react';
import { Activity, Settings, ShieldCheck, Square } from 'lucide-react';
import DraftsPanel from './components/DraftsPanel';
import FeedbackPanel from './components/FeedbackPanel';
import SettingsPanel from './components/SettingsPanel';
import Onboarding from './components/Onboarding';
import InputChannelsSetup from './components/InputChannelsSetupModal';
import { Platform } from './types';

export type ActivityTab = 'devflow' | 'settings';

const App: React.FC = () => {
  const [view, setView] = useState<'onboarding' | 'setup' | 'main'>('onboarding');
  const [activeActivity, setActiveActivity] = useState<ActivityTab>('devflow');
  const [activeTab, setActiveTab] = useState<'drafts' | 'feedback'>('drafts');
  const [activePlatform, setActivePlatform] = useState<Platform>(Platform.X);
  // triggerContext is kept for prop interface, but currently unused without the simulator or real backend
  const [triggerContext, setTriggerContext] = useState<string | null>(null);
  const [isIdeConnected, setIsIdeConnected] = useState(false);
  
  // State for AI Voice Calibration
  const [toneContext, setToneContext] = useState<string>('');
  
  // State for Credits
  const [credits] = useState(85);

  const renderContent = () => {
    switch (activeActivity) {
      case 'settings':
        return (
          <SettingsPanel 
            toneContext={toneContext} 
            setToneContext={setToneContext} 
          />
        );
        
      case 'devflow':
      default:
        if (!isIdeConnected) {
          return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-df-black animate-in fade-in duration-300">
              <h2 className="text-df-white font-bold text-sm mb-2 uppercase tracking-tighter">DISCONNECTED</h2>
              <p className="text-df-gray text-[10px] leading-relaxed mb-8 max-w-xs mx-auto">
                BRICK needs to be initialized.
              </p>
              <button 
                onClick={() => {
                  setView('setup');
                }}
                className="w-full max-w-xs py-3 bg-df-orange text-df-black font-bold text-xs hover:bg-white transition-colors uppercase border border-df-orange"
              >
                Establish Link
              </button>
            </div>
          );
        }
        return (
          <div className="flex flex-col h-full animate-in fade-in duration-200">
            {/* Mobile/Tablet Tabs - Hidden on Desktop */}
            <div className={`flex border-b border-df-border bg-df-black shrink-0 lg:hidden ${isIdeConnected ? 'pt-[env(safe-area-inset-top,44px)] lg:pt-0 min-h-[48px]' : 'h-12'}`}>
              <button 
                onClick={() => setActiveTab('drafts')}
                className={`flex-1 text-xs font-bold tracking-wider hover:bg-[#111] transition-colors flex items-center justify-center ${activeTab === 'drafts' ? 'text-df-white border-b-4 border-df-orange py-2' : 'text-df-gray py-2 border-b-4 border-transparent'}`}
              >
                DRAFTS
              </button>
              <button 
                onClick={() => setActiveTab('feedback')}
                className={`flex-1 text-xs font-bold tracking-wider hover:bg-[#111] transition-colors flex items-center justify-center ${activeTab === 'feedback' ? 'text-df-white border-b-4 border-df-orange py-2' : 'text-df-gray py-2 border-b-4 border-transparent'}`}
              >
                FEEDBACK
              </button>
            </div>

            {/* Content Area - Responsive Grid */}
            <div className="flex-grow overflow-hidden relative flex flex-col lg:flex-row">
              {/* Left Column (Drafts) */}
              <div className={`flex-grow h-full lg:w-1/2 lg:border-r border-df-border ${activeTab === 'drafts' ? 'block' : 'hidden lg:block'}`}>
                 {/* Desktop Header */}
                 <div className="hidden lg:flex h-10 border-b border-df-border items-center px-4 bg-df-black shrink-0">
                    <span className="text-xs font-bold text-df-white tracking-wider">DRAFTS</span>
                 </div>
                 <div className="h-full lg:h-[calc(100%-40px)]">
                    <DraftsPanel 
                      activePlatform={activePlatform} 
                      setActivePlatform={setActivePlatform} 
                      triggerContext={triggerContext}
                      toneContext={toneContext}
                    />
                 </div>
              </div>

              {/* Right Column (Feedback) */}
              <div className={`flex-grow h-full lg:w-1/2 ${activeTab === 'feedback' ? 'block' : 'hidden lg:block'}`}>
                 {/* Desktop Header */}
                 <div className="hidden lg:flex h-10 border-b border-df-border items-center px-4 bg-df-black shrink-0 relative">
                    <span className="text-xs font-bold text-df-white tracking-wider">FEEDBACK</span>
                    <span className="absolute top-3 right-4 w-1.5 h-1.5 bg-df-orange rounded-full animate-pulse"></span>
                 </div>
                 <div className="h-full lg:h-[calc(100%-40px)]">
                    <FeedbackPanel />
                 </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (view === 'onboarding') {
    return (
      <div className="h-screen w-screen bg-black font-mono overflow-hidden">
        <Onboarding onComplete={() => setView('main')} />
      </div>
    );
  }

  if (view === 'setup') {
    return (
      <InputChannelsSetup
        onClose={() => setView('main')}
        onComplete={() => {
          setIsIdeConnected(true);
          setView('main');
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[#1e1e1e] text-gray-400 font-mono overflow-hidden selection:bg-df-orange/30">
      {/* 1. Activity Bar (Far Left) - Keep w-12 */}
      <div className="w-12 bg-[#181818] flex flex-col items-center py-4 shrink-0 border-r border-[#000]">
        
        {/* BRICK Tab */}
        <button 
          title="BRICK"
          onClick={() => setActiveActivity('devflow')}
          className={`relative p-1 transition-transform active:scale-95 group mt-2 mb-4`}
        >
          <div className={`w-8 h-8 flex items-center justify-center text-black font-bold text-lg transition-all ${activeActivity === 'devflow' ? 'bg-df-orange' : 'bg-[#333] hover:bg-[#444]'}`}>
            <Square size={20} strokeWidth={4} fill={activeActivity === 'devflow' ? 'black' : 'none'} className={activeActivity === 'devflow' ? 'text-black' : 'text-df-gray group-hover:text-white'} />
          </div>
        </button>

        {/* Vertical Credit Meter - Wider (w-8) within the w-12 sidebar */}
        <div className="flex-grow w-full flex flex-col items-center justify-center py-4 px-2 group cursor-help">
          <div className="w-8 h-full bg-black border border-df-border relative overflow-hidden flex flex-col justify-end shadow-inner">
            <div 
              className="bg-df-orange w-full transition-all duration-1000 ease-in-out" 
              style={{ height: `${credits}%` }}
            ></div>
            {/* Meter Grid Overlay: 16 lines = 15 gaps/squares */}
            <div className="absolute inset-0 flex flex-col justify-between py-0 opacity-25 pointer-events-none">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="h-[1px] w-full bg-[#444]" />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center leading-none mt-4 shrink-0">
            <span className="text-base font-black text-df-white tracking-tighter">{credits}</span>
            <span className="text-[10px] font-black text-df-orange uppercase tracking-widest mt-0.5">CR</span>
          </div>
        </div>
        
        <div className="mt-4 mb-2 flex flex-col gap-6 items-center shrink-0">
          <button 
            title="Settings"
            onClick={() => setActiveActivity('settings')}
            className={`p-1 transition-all hover:scale-110 ${activeActivity === 'settings' ? 'text-df-orange border-l-2 border-df-orange pl-2' : 'text-gray-600 hover:text-gray-300'}`}
          >
            <Settings size={24} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-grow flex flex-col bg-[#111] relative overflow-hidden items-center justify-center">
         {/* Background Decoration */}
         <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none">
            <div className="text-[20vw] font-black text-white/[0.02] select-none -rotate-6 tracking-tighter">BRICK</div>
         </div>
         
         {/* Central Panel Container */}
         <div className="w-full max-w-2xl lg:max-w-7xl h-full flex flex-col bg-df-black border-x border-[#333] shadow-2xl relative z-10 transition-all duration-300">
            {renderContent()}
         </div>
      </div>
    </div>
  );
};

export default App;
