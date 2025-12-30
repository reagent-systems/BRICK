
import React, { useState } from 'react';
import { ArrowRight, Check, GitPullRequest, Users, Zap, Square, Mail, MessageSquare, MessageCircle, X as XIcon } from 'lucide-react';
import { UserConfig } from '../types';

interface OnboardingProps {
  onComplete: () => void;
}

// High-quality vector sources for brand logos
const X_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/5/53/X_logo_2023_original.svg";
const REDDIT_LOGO_URL = "https://www.svgrepo.com/show/354256/reddit-icon.svg";
const DISCORD_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/8/89/Discord_Logo_sans_text.svg";

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<UserConfig>({
    xConnected: false,
    redditConnected: false,
    emailConnected: false,
    discordConnected: false,
    setupComplete: false,
  });

  const handleConnect = (key: keyof UserConfig) => {
    if (config[key]) return;
    
    setTimeout(() => {
      setConfig((prev) => ({ ...prev, [key]: true }));
    }, 400);
  };

  // --- STEP 1: TITLE SCREEN ---
  const renderStep1 = () => (
    <div className="flex flex-col h-full animate-in fade-in zoom-in duration-500 bg-df-black">
       <div className="flex-grow flex flex-col justify-center items-center text-center p-8 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-[#222] rotate-45 pointer-events-none"></div>
          
          <div className="w-20 h-20 bg-df-orange text-black flex items-center justify-center mb-8 relative z-10 shadow-[8px_8px_0px_rgba(255,255,255,0.2)]">
             <Square size={40} strokeWidth={4} fill="black" />
          </div>
          <h1 className="text-8xl font-black tracking-tighter leading-none mb-4 relative z-10">
             BRICK
          </h1>
          <div className="h-2 w-24 bg-df-orange mb-6"></div>
          <p className="text-sm text-df-gray font-mono max-w-[260px] leading-relaxed uppercase tracking-widest">
             Code. Share. Listen.
          </p>
       </div>
       <button 
         onClick={() => setStep(2)}
         className="w-full py-6 bg-df-white text-black font-bold hover:bg-df-orange transition-colors flex items-center justify-center gap-2 group tracking-widest text-sm"
       >
         INITIATE <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
       </button>
    </div>
  );

  // --- STEP 2: USE CASE (Drafting) ---
  const renderStep2 = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 bg-[#050505]">
      <div className="p-6 pt-12 flex-grow flex flex-col justify-center">
        <div className="mb-2 text-df-orange font-bold text-xs uppercase tracking-widest">Use Case 01</div>
        <h2 className="text-3xl font-bold text-df-white mb-8 leading-tight">NEVER WRITE A CHANGELOG FROM SCRATCH.</h2>
        
        <div className="flex items-center gap-4 mb-8">
            <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 border border-df-gray flex items-center justify-center text-df-gray">
                    <GitPullRequest size={24} />
                </div>
                <span className="text-[10px] uppercase text-df-gray">You Push</span>
            </div>
            <ArrowRight className="text-df-orange" />
            <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-[#222] border border-df-white flex items-center justify-center text-df-white">
                    <Zap size={24} className="fill-current" />
                </div>
                <span className="text-[10px] uppercase text-df-white">AI Drafts</span>
            </div>
        </div>

        <p className="text-df-gray text-xs font-mono leading-relaxed uppercase">
            BRICK OBSERVES YOUR LOCAL GIT COMMITS AND GENERATES CONTEXT-AWARE POSTS FOR X AND REDDIT INSTANTLY.
        </p>
      </div>

      <div className="flex border-t border-df-border">
          <button onClick={() => setStep(1)} className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase">Back</button>
          <button onClick={() => setStep(3)} className="flex-grow py-6 bg-df-white text-black hover:bg-df-gray text-xs font-bold uppercase flex items-center justify-center gap-2">Next <ArrowRight size={14}/></button>
      </div>
    </div>
  );

  // --- STEP 3: USE CASE (Feedback) ---
  const renderStep3 = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 bg-[#050505]">
      <div className="p-6 pt-12 flex-grow flex flex-col justify-center">
        <div className="mb-2 text-df-orange font-bold text-xs uppercase tracking-widest">Use Case 02</div>
        <h2 className="text-3xl font-bold text-df-white mb-8 leading-tight">ONE INBOX FOR ALL THE NOISE.</h2>
        
        <div className="flex flex-col gap-4 mb-8 pl-4 border-l-2 border-df-border">
            <div className="flex items-center gap-3">
                <Users size={16} className="text-df-gray" />
                <span className="text-xs text-df-gray font-mono uppercase">"Is this a bug?" (Reddit)</span>
            </div>
            <div className="flex items-center gap-3">
                <Users size={16} className="text-df-gray" />
                <span className="text-xs text-df-gray font-mono uppercase">"Feature request!" (X)</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
                <ArrowRight size={16} className="text-df-orange rotate-90" />
                <div className="px-3 py-1 bg-df-orange text-black text-xs font-bold uppercase">
                    Unified Dashboard
                </div>
            </div>
        </div>

        <p className="text-df-gray text-xs font-mono leading-relaxed uppercase">
            FILTER BUG REPORTS, PRAISE, AND QUESTIONS FROM MULTIPLE PLATFORMS IN A BRUTALLY FOCUSED VIEW.
        </p>
      </div>

      <div className="flex border-t border-df-border">
          <button onClick={() => setStep(2)} className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase">Back</button>
          <button onClick={() => setStep(4)} className="flex-grow py-6 bg-df-white text-black hover:bg-df-gray text-xs font-bold uppercase flex items-center justify-center gap-2">Next <ArrowRight size={14}/></button>
      </div>
    </div>
  );

  // --- STEP 4: PROTOCOL SYNC ---
  const renderStep4 = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-500 bg-[#050505]">
      <div className="p-6 pt-12 flex-grow flex flex-col justify-center">
        <div className="mb-2 text-df-orange font-bold text-xs uppercase tracking-widest">Protocol Sync</div>
        <h2 className="text-3xl font-bold text-df-white mb-8 leading-tight uppercase">THE IDE CONNECTION.</h2>
        
        <div className="bg-[#111] p-4 border border-df-border font-mono text-[10px] mb-8 relative">
           <div className="text-df-orange uppercase">$ mcp install brick --local-server</div>
           <div className="text-df-orange mt-1 uppercase">[SYSTEM] Handshaking with Local Host</div>
           <div className="text-df-orange mt-1 uppercase">[SYSTEM] Connection Established via Port 3000</div>
        </div>

        <p className="text-df-gray text-xs font-mono leading-relaxed uppercase">
            BRICK HOOKS INTO YOUR CODING AGENT (CLAUDE, WINDSURF) TO CAPTURE ITS REASONING AND TECHNICAL DECISIONS AS THEY HAPPEN.
        </p>
      </div>

      <div className="flex border-t border-df-border">
          <button onClick={() => setStep(3)} className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase">Back</button>
          <button onClick={() => setStep(5)} className="flex-grow py-6 bg-df-white text-black hover:bg-df-gray text-xs font-bold uppercase flex items-center justify-center gap-2">Connect <ArrowRight size={14}/></button>
      </div>
    </div>
  );

  // --- STEP 5: CONNECTIONS ---
  const renderStep5 = () => {
    const platforms = [
      { id: 'xConnected' as keyof UserConfig, label: 'X', Icon: null, imageUrl: X_LOGO_URL },
      { id: 'redditConnected' as keyof UserConfig, label: 'REDDIT', Icon: null, imageUrl: REDDIT_LOGO_URL },
      { id: 'discordConnected' as keyof UserConfig, label: 'DISCORD', Icon: null, imageUrl: DISCORD_LOGO_URL },
      { id: 'emailConnected' as keyof UserConfig, label: 'EMAIL', Icon: Mail, imageUrl: null },
    ];

    const isAnyConnected = config.xConnected || config.redditConnected || config.emailConnected || config.discordConnected;

    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500 bg-[#050505]">
        <div className="flex-grow flex flex-col justify-center overflow-y-auto py-8">
          <div className="mb-12 px-6">
              <div className="mb-2 text-df-orange font-bold text-xs uppercase tracking-widest">Final Step</div>
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter text-df-white">CONNECT ACCOUNTS</h2>
              <p className="text-[10px] text-df-gray uppercase tracking-widest font-bold">
                ESTABLISH THE OUTBOUND CHANNELS.
              </p>
          </div>

          <div className="flex flex-row flex-wrap justify-between px-6 w-full max-w-2xl">
            {platforms.map(({ id, label, Icon, imageUrl }) => {
              const isConnected = config[id];
              return (
                <button
                  key={id}
                  onClick={() => handleConnect(id)}
                  className={`
                    flex flex-col items-center gap-4 group transition-all duration-300
                    ${isConnected ? 'text-df-orange' : 'text-df-gray hover:text-df-white'}
                  `}
                >
                  <div className={`
                    w-16 h-16 flex items-center justify-center border-2 shrink-0
                    transition-all duration-300
                    ${isConnected 
                        ? 'border-df-orange bg-df-orange/10 shadow-[4px_4px_0px_rgba(255,98,0,0.2)]' 
                        : 'border-[#222] bg-[#080808] group-hover:border-df-gray'}
                  `}>
                    {imageUrl ? (
                      <div 
                        className={`w-10 h-10 transition-all duration-300 ${isConnected ? 'bg-df-orange' : 'bg-df-gray group-hover:bg-df-white'}`}
                        style={{
                          maskImage: `url(${imageUrl})`,
                          maskRepeat: 'no-repeat',
                          maskPosition: 'center',
                          maskSize: 'contain',
                          WebkitMaskImage: `url(${imageUrl})`,
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskPosition: 'center',
                          WebkitMaskSize: 'contain',
                        }}
                      />
                    ) : (
                      Icon && <Icon 
                        size={32} 
                        className={`transition-colors duration-300 ${isConnected ? 'text-df-orange' : 'text-df-gray group-hover:text-df-white'}`} 
                      />
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span className="font-black text-[10px] uppercase tracking-widest">{label}</span>
                    <div className={`h-0.5 w-4 mt-1 transition-all duration-300 ${isConnected ? 'bg-df-orange opacity-100' : 'bg-transparent opacity-0'}`}></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex border-t border-df-border">
          <button 
            onClick={() => setStep(4)} 
            className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase"
          >
            Back
          </button>
          <button 
            onClick={onComplete}
            disabled={!isAnyConnected}
            className={`flex-grow py-6 text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors
              ${isAnyConnected ? 'bg-df-white text-black hover:bg-df-gray' : 'bg-[#111] text-df-gray cursor-not-allowed'}
            `}
          >
            Enter Brick <ArrowRight size={14}/>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-black text-df-white overflow-hidden relative">
      {/* Step Indicator */}
      <div className="absolute top-0 left-0 h-1 bg-df-orange transition-all duration-500 ease-out z-50" style={{ width: `${(step / 5) * 100}%` }}></div>
      
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
    </div>
  );
};

export default Onboarding;
