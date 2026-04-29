
import React from 'react';
import { Signal, CandleType, SignalStatus } from '../types.ts';

interface SignalHistoryProps {
  history: Signal[];
  mentorAnalysis?: string;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onCopy: (message: string) => void;
  currentTime: Date;
}

const CountdownProgress = ({ targetTimestamp, currentTime }: { targetTimestamp: number, currentTime: Date }) => {
  const timeLeftMs = targetTimestamp - currentTime.getTime();
  const secondsTotal = Math.max(0, Math.floor(timeLeftMs / 1000));
  
  const mins = Math.floor(secondsTotal / 60);
  const secs = secondsTotal % 60;

  // Calculate percentage (assuming a typical signal cycle is around 3 mins / 180s)
  const percentage = Math.min(100, Math.max(0, (secondsTotal / 180) * 100));

  let label = 'ESTÁVEL';
  let colorClass = 'text-secondary';
  let barColorClass = 'bg-accent/20';
  let glowClass = '';

  if (secondsTotal > 0) {
    if (secondsTotal <= 15) {
      label = 'INJETAR AGORA';
      colorClass = 'text-rose-500 font-black scale-105 transition-transform';
      barColorClass = 'bg-rose-500';
      glowClass = 'shadow-[0_0_15px_rgba(244,63,94,0.4)]';
    } else if (secondsTotal <= 45) {
      label = 'AGUARDAR CONFIRMAÇÃO';
      colorClass = 'text-yellow-400 font-bold';
      barColorClass = 'bg-yellow-400/60';
    } else {
      label = 'JANELA EM FORMAÇÃO';
      colorClass = 'text-accent font-bold';
      barColorClass = 'bg-accent/40';
    }
  } else {
    label = 'LOG ENCERRADO';
    colorClass = 'text-slate-600';
    barColorClass = 'bg-slate-800';
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex justify-between items-end">
        <div className="flex flex-col">
          <span className="text-[7px] uppercase tracking-[0.3em] font-black text-secondary opacity-50 mb-1">Status de Injeção</span>
          <span className={`text-[10px] uppercase tracking-widest font-black ${colorClass} transition-all duration-300`}>
            {label}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[8px] uppercase tracking-widest font-bold text-secondary opacity-40 block mb-0.5">Time Left</span>
          <span className="text-[14px] font-mono text-primary font-bold tabular-nums">
            {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
      
      <div className="relative h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
        <div 
          className={`h-full transition-all duration-1000 ease-linear ${barColorClass} ${glowClass} rounded-full`} 
          style={{ width: `${percentage}%` }} 
        />
        {secondsTotal <= 15 && secondsTotal > 0 && (
          <div className="absolute inset-0 bg-rose-500 animate-pulse opacity-20" />
        )}
      </div>
      
      <div className="flex justify-between text-[7px] font-mono text-secondary uppercase opacity-30 tracking-tighter">
        <span>0s</span>
        <span>90s</span>
        <span>180s</span>
      </div>
    </div>
  );
};

export default function SignalHistory({ history, mentorAnalysis, onRemove, onClearAll, onCopy, currentTime }: SignalHistoryProps) {
  const formatText = (sig: Signal) => {
    return `💎 *DARK BOT - SINAL CONFIRMADO* 💎\n\n🏛️ *CASA:* ${sig.house.toUpperCase()}\n⏰ *HORARIO:* ${sig.time}\n🎯 *ALVO:* ${sig.multiplier}\n🔥 *ASSERTIVIDADE:* ${sig.probability.toFixed(1)}%\n\n✅ *ENTRADA AUTORIZADA*\n🤖 *dark.bot (hack)*`;
  };

  return (
    <div className="space-y-6">
      {mentorAnalysis && history.length > 0 && (
        <div className="mx-4 p-4 bg-black/60 border border-accent/20 rounded-2xl font-mono text-[9px] space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-accent">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <span className="font-black uppercase tracking-widest">Mentor Analysis</span>
          </div>
          <p className="text-primary/80 leading-relaxed italic">
            <span className="text-accent mr-1">{'>'}</span>
            {mentorAnalysis}
          </p>
          <div className="flex justify-between text-[6px] text-secondary/40 uppercase">
            <span>Protocol: VENOM_V5.5</span>
            <span>Status: INJECTED</span>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex justify-between items-center px-4">
          <span className="text-[9px] font-mono text-secondary uppercase tracking-widest">Logs em Cache: {history.length}</span>
          <button onClick={onClearAll} className="text-[9px] text-rose-500 font-black uppercase tracking-widest active:scale-95">Flush Terminal</button>
        </div>
      )}

      <div className="space-y-5">
        {history.length === 0 ? (
          <div className="py-24 text-center bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[3rem]">
            <div className="w-12 h-12 border-2 border-white/5 rounded-full mx-auto flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <p className="text-secondary text-[9px] font-black uppercase tracking-[0.4em]">Aguardando Protocolos de Injeção</p>
          </div>
        ) : (
          history.map((signal) => (
            <div key={signal.id} className="glass-card p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:border-accent/30 transition-all shadow-2xl">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-primary tabular-nums tracking-tighter leading-none">{signal.time}</span>
                    <span className="text-[7px] font-mono text-secondary uppercase tracking-widest mt-2">HACK_REF_{signal.id.substring(0, 4).toUpperCase()}</span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10 mx-1"></div>
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${signal.type === CandleType.PINK ? 'text-pink-500' : 'text-purple-500'}`}>
                      {signal.multiplier}
                    </span>
                    <span className="text-[8px] text-accent font-bold uppercase tracking-widest mt-1">Ready v5.5</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(formatText(signal)); onCopy("Sinal Copiado!"); }}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-secondary hover:text-primary transition-all active:scale-90">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1"/></svg>
                  </button>
                  <button onClick={() => onRemove(signal.id)} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-secondary hover:text-rose-500 transition-all active:scale-90">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
              
              <CountdownProgress targetTimestamp={signal.timestamp} currentTime={currentTime} />
              
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-accent opacity-5 blur-[40px] rounded-full" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
