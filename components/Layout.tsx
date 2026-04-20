
import React from 'react';
import { AppScreen, ThemeConfig } from '../types.ts';

interface LayoutProps {
  children?: React.ReactNode;
  activeScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  title?: string;
  themeConfig: ThemeConfig;
  onLogoClick?: () => void;
}

export default function Layout({ children, activeScreen, setScreen, title, themeConfig, onLogoClick }: LayoutProps) {
  const navItems = [
    { 
      screen: AppScreen.HOUSE_SELECTION, 
      label: 'Home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
      )
    },
    { 
      screen: AppScreen.HACK_GENERATOR, 
      label: 'Hackear',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
      )
    },
    { 
      screen: AppScreen.HACKER_GERAL, 
      label: 'Hacker Geral',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
      )
    },
    { 
      screen: AppScreen.VIRTUAL_BOT, 
      label: 'Sinais',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
      )
    },
    { 
      screen: AppScreen.AGENDA, 
      label: 'Horários',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      )
    },
    { 
      screen: AppScreen.SIGNAL_ROOM, 
      label: 'Log',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>
      )
    }
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-[430px] mx-auto bg-transparent text-primary relative shadow-[0_0_100px_rgba(0,0,0,0.4)] border-x border-white/[0.02]">
      <header className="px-6 py-5 border-b border-white/[0.03] bg-[#05070a]/80 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div 
            onClick={onLogoClick}
            style={{ backgroundColor: themeConfig.accentColor }}
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-black text-[10px] shadow-lg cursor-pointer active:scale-90 transition-all border border-white/20"
          >
            V55
          </div>
          <div>
            <h1 className="font-black text-xs leading-tight tracking-tighter text-primary">Venom <span className="text-accent">Elite</span></h1>
            <p className="text-[8px] font-bold text-secondary uppercase tracking-[0.2em]">Hacker System</p>
          </div>
        </div>

        {title && (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
              <span className="text-[9px] font-black text-accent uppercase tracking-widest">{title}</span>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-1 pt-2 pb-32">
        {children}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-[410px] nav-dock rounded-[2rem] p-2 flex justify-between items-center z-50">
        {navItems.map((item) => {
          const isActive = activeScreen === item.screen;
          return (
            <button 
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-2xl transition-all duration-300 active:scale-90 flex-1 ${isActive ? 'text-accent' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                {item.icon}
              </div>
              <span className={`text-[8px] font-bold uppercase tracking-tighter transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -top-1 w-1 h-1 rounded-full bg-accent shadow-[0_0_8px_var(--accent-color)]"></div>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
