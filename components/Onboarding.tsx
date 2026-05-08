
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, GitPullRequest, Users, Zap, Square, Mail, MessageCircle } from 'lucide-react';
import { UserConfig } from '../types';
import { initiateOAuth, revokeConnection } from '../services/oauthService';
import { useConnections } from '../contexts/ConnectionContext';
import { getXUserProfile, clearUserProfileCache } from '../services/xOAuthService';
import xIcon from '../assets/x.png';
import redditIcon from '../assets/reddit.png';
import discordIcon from '../assets/discord.png';
import emailIcon from '../assets/email.png';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { connections, hasAnyConnection } = useConnections();
  
  // Restore step from localStorage or determine from connection status
  const [step, setStep] = useState(() => {
    const stored = localStorage.getItem('onboarding_step');
    if (stored) {
      return parseInt(stored, 10);
    }
    // If any platform is connected, start at step 5
    return 1;
  });
  
  const [config, setConfig] = useState<UserConfig>({
    xConnected: connections.x,
    redditConnected: connections.reddit,
    emailConnected: connections.email,
    discordConnected: connections.discord,
    setupComplete: false,
  });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [xUsername, setXUsername] = useState<string | null>(null);
  const hasAutoJumped = useRef(false);

  // Sync local config when global connections change
  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      xConnected: connections.x,
      redditConnected: connections.reddit,
      emailConnected: connections.email,
      discordConnected: connections.discord,
    }));
  }, [connections]);

  // Fetch X username when X is connected
  useEffect(() => {
    if (connections.x && !xUsername) {
      getXUserProfile()
        .then((profile) => {
          if (profile.data?.username) {
            setXUsername(profile.data.username);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch X username:', error);
        });
    } else if (!connections.x) {
      setXUsername(null);
    }
  }, [connections.x, xUsername]);

  // Smart restoration: check if onboarding was completed or restore to saved step
  useEffect(() => {
    if (hasAutoJumped.current) return; // Already processed
    
    const isManualNavigation = localStorage.getItem('manual_onboarding_navigation') === 'true';
    // Clear the manual navigation flag after checking
    if (isManualNavigation) {
      localStorage.removeItem('manual_onboarding_navigation');
      // For manual navigation, just restore to saved step, don't auto-complete
      const savedStep = localStorage.getItem('onboarding_step');
      if (savedStep) {
        const stepNum = parseInt(savedStep, 10);
        if (stepNum >= 1 && stepNum <= 5) {
          setStep(stepNum);
        }
      }
      hasAutoJumped.current = true;
      return;
    }
    
    const onboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
    
    // If onboarding was completed and user has connections, skip to main app
    if (onboardingComplete && hasAnyConnection()) {
      hasAutoJumped.current = true;
      onComplete();
      return;
    }
    
    // If user has connections but hasn't completed onboarding, jump to step 5
    if (hasAnyConnection() && step < 5) {
      hasAutoJumped.current = true;
      setStep(5);
      localStorage.setItem('onboarding_step', '5');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]); // Run when connections change, but ref prevents multiple jumps

  // Save step to storage whenever it changes
  useEffect(() => {
    localStorage.setItem('onboarding_step', step.toString());
  }, [step]);

  // Helper function to update step and save to localStorage
  const goToStep = (newStep: number) => {
    setStep(newStep);
    localStorage.setItem('onboarding_step', newStep.toString());
  };

  const handleConnect = async (key: keyof UserConfig) => {
    // Map UserConfig keys to OAuth platform names
    const platformMap: Record<string, 'x' | 'reddit' | 'discord' | 'email'> = {
      xConnected: 'x',
      redditConnected: 'reddit',
      discordConnected: 'discord',
      emailConnected: 'email',
    };

    const platform = platformMap[key];
    if (!platform) return;

    // If already connected, disconnect
    if (config[key]) {
      setConnecting(key);
      try {
        await revokeConnection(platform);
        // Clear cached profile data for X
        if (platform === 'x') {
          clearUserProfileCache();
          setXUsername(null);
        }
        // Update local state immediately for responsive UI
        setConfig((prev) => ({ ...prev, [key]: false }));
        // Dispatch event to update global connection state
        window.dispatchEvent(new CustomEvent('oauth-complete', {
          detail: { platform, connected: false }
        }));
      } catch (error) {
        console.error(`Failed to disconnect ${key}:`, error);
      } finally {
        setConnecting(null);
      }
      return;
    }

    // Not connected — initiate OAuth
    setConnecting(key);
    try {
      await initiateOAuth(platform);
      // OAuth flow will redirect, callback handler will update state
    } catch (error) {
      console.error(`Failed to connect ${key}:`, error);
      alert(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConnecting(null);
    }
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
         onClick={() => goToStep(2)}
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
          <button onClick={() => goToStep(1)} className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase">Back</button>
          <button onClick={() => goToStep(3)} className="flex-grow py-6 bg-df-white text-black hover:bg-df-gray text-xs font-bold uppercase flex items-center justify-center gap-2">Next <ArrowRight size={14}/></button>
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
          <button onClick={() => goToStep(2)} className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase">Back</button>
          <button onClick={() => goToStep(4)} className="flex-grow py-6 bg-df-white text-black hover:bg-df-gray text-xs font-bold uppercase flex items-center justify-center gap-2">Next <ArrowRight size={14}/></button>
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
          <button onClick={() => goToStep(3)} className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase">Back</button>
          <button onClick={() => goToStep(5)} className="flex-grow py-6 bg-df-white text-black hover:bg-df-gray text-xs font-bold uppercase flex items-center justify-center gap-2">Connect <ArrowRight size={14}/></button>
      </div>
    </div>
  );

  // --- STEP 5: CONNECTIONS ---
  const renderStep5 = () => {
    const platforms = [
      { id: 'xConnected' as keyof UserConfig, label: 'X', Icon: MessageCircle, imageSrc: xIcon },
      { id: 'redditConnected' as keyof UserConfig, label: 'REDDIT', Icon: Users, imageSrc: redditIcon },
      { id: 'discordConnected' as keyof UserConfig, label: 'DISCORD', Icon: MessageCircle, imageSrc: discordIcon },
      { id: 'emailConnected' as keyof UserConfig, label: 'EMAIL', Icon: Mail, imageSrc: emailIcon },
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
            {platforms.map(({ id, label, Icon, imageSrc }) => {
              const isConnected = config[id];
              const isConnecting = connecting === id;
              // For X platform, show username if connected
              const displayLabel = id === 'xConnected' && isConnected && xUsername 
                ? `X: ${xUsername}` 
                : label;
              return (
                <button
                  key={id}
                  onClick={() => handleConnect(id)}
                  disabled={isConnecting}
                  className={`
                    flex flex-col items-center gap-4 group transition-all duration-300
                    ${isConnected ? 'text-df-orange hover:text-df-gray' : 'text-df-gray hover:text-df-white'}
                    ${isConnecting ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                  `}
                >
                  <div className={`
                    w-16 h-16 flex items-center justify-center border-2 shrink-0
                    transition-all duration-300
                    ${isConnected 
                        ? 'border-df-orange bg-df-orange/10 shadow-[4px_4px_0px_rgba(255,98,0,0.2)] group-hover:border-red-500 group-hover:bg-red-900/10 group-hover:shadow-none' 
                        : 'border-[#222] bg-[#080808] group-hover:border-df-gray'}
                  `}>
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={`${label} icon`}
                        className={`w-8 h-8 object-contain transition-all duration-300 ${
                          isConnected
                            ? 'opacity-100'
                            : 'opacity-80 group-hover:opacity-100'
                        }`}
                      />
                    ) : (
                      Icon && <Icon 
                        size={32} 
                        className={`transition-colors duration-300 ${isConnected ? 'text-df-orange' : 'text-df-gray group-hover:text-df-white'}`} 
                      />
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center w-16">
                    <div 
                      className="font-black text-[10px] uppercase tracking-widest w-16 text-center overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden relative"
                      style={{
                        maxWidth: '64px',
                      }}
                      title={displayLabel}
                    >
                      <span 
                        className={`inline-block whitespace-nowrap ${
                          id === 'xConnected' && isConnected && xUsername 
                            ? 'animate-scroll-text' 
                            : ''
                        }`}
                        style={
                          id === 'xConnected' && isConnected && xUsername
                            ? {
                                animation: 'scroll-text 8s linear infinite',
                              }
                            : {}
                        }
                      >
                        {displayLabel}
                      </span>
                    </div>
                    <div className={`h-0.5 w-4 mt-1 transition-all duration-300 ${isConnected ? 'bg-df-orange opacity-100' : 'bg-transparent opacity-0'}`}></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex border-t border-df-border">
          <button 
            onClick={() => goToStep(4)} 
            className="w-1/3 py-6 text-df-gray hover:text-white border-r border-df-border text-xs font-bold uppercase"
          >
            Back
          </button>
          <button 
            onClick={() => {
              localStorage.setItem('onboarding_complete', 'true');
              onComplete();
            }}
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
      {/* CSS Animation for scrolling text */}
      <style>{`
        @keyframes scroll-text {
          0% {
            transform: translateX(64px);
          }
          100% {
            transform: translateX(calc(-100%));
          }
        }
      `}</style>
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
