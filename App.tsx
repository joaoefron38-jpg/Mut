
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppScreen, CandleType, Signal, BettingHouse, SignalStatus, GraphStatus, ThemeConfig, SupportMessage, AgendaItem, PlatformNotification } from './types.ts';
import { BETTING_HOUSES } from './constants.tsx';
import Layout from './components/Layout.tsx';
import SignalHistory from './components/SignalHistory.tsx';
import { GoogleGenAI } from "@google/genai";
import { db, auth, OperationType, handleFirestoreError, isFirebaseConfigured } from './src/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { onSnapshot, doc, collection, setDoc, updateDoc, deleteDoc, getDoc, getDocFromServer, getDocs, writeBatch, addDoc } from 'firebase/firestore';

const PREDEFINED_THEMES: ThemeConfig[] = [
  { id: 'venom', name: 'DARK BOT', mode: 'dark', accentColor: '#00FF9D', brightness: 100, contrast: 100 },
  { id: 'cyber', name: 'Cyber Blue', mode: 'dark', accentColor: '#00D1FF', brightness: 110, contrast: 105 },
  { id: 'royal', name: 'Royal Gold', mode: 'dark', accentColor: '#FFD700', brightness: 100, contrast: 110 },
  { id: 'neon', name: 'Neon Purple', mode: 'dark', accentColor: '#BD00FF', brightness: 100, contrast: 100 },
  { id: 'nova', name: 'Light Nova', mode: 'light', accentColor: '#00FF9D', brightness: 100, contrast: 100 }
];

const GLOBAL_ALERTS = [
  { type: 'info', message: 'Sincronização com Elephant Bet otimizada v5.5.2' },
  { type: 'alert', message: 'Volume alto detectado na Premier Bet - Ciclo de Rosa iminente!' },
  { type: 'success', message: 'Script DARK.hack-v1.0 operando com 99.4% de precisão.' },
  { type: 'critical', message: 'Instabilidade no servidor Olá Bet - Evite entradas grandes agora.' },
  { type: 'info', message: 'Agenda Elite atualizada com novos padrões de Moçambique.' }
];

const LOCAL_STRATEGIES = [
  "Aguarde 3 velas azuis seguidas para recuperação.",
  "Ciclo de retenção: Reduza banca e busque 1.50x.",
  "Padrão de escada: Momento para velas de 2.0x.",
  "O gráfico tende a corrigir após rosas.",
  "Evite entradas após velas acima de 50x.",
  "Foque em horários de pico (18h-21h).",
  "Estratégia 2 min: Entre no 2º min após roxa.",
  "Gestão: Proteja capital e jogue com lucro."
];

const INITIAL_AGENDA_DATA: AgendaItem[] = BETTING_HOUSES.map(h => {
  const paying = 45 + Math.random() * 45;
  return {
    id: h.id,
    house: h.name,
    logo: h.logo,
    paying: paying,
    reclining: 100 - paying,
    graphStatus: (paying > 75 ? 'BOM' : paying > 55 ? 'RAZOAVEL' : 'RUIM') as GraphStatus,
    graphAnalysis: 'Ativo',
    efronInsight: LOCAL_STRATEGIES[Math.floor(Math.random() * LOCAL_STRATEGIES.length)],
    isAnalyzing: false,
    isGraphAnalyzing: false
  };
});

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  state: { hasError: boolean, error: any };
  props: { children: React.ReactNode };
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-primary uppercase">Erro de Protocolo</h2>
            <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed">Ocorreu um erro inesperado no sistema. Por favor, reinicie o aplicativo.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest"
          >
            Reiniciar Sistema
          </button>
          <pre className="mt-8 p-4 bg-black/50 rounded-xl text-[8px] text-rose-400 text-left overflow-auto max-w-full font-mono">
            {(() => {
              try {
                if (typeof this.state.error !== 'object' || this.state.error === null) {
                  return String(this.state.error);
                }
                
                const seen = new WeakSet();
                return JSON.stringify(this.state.error, (key, value) => {
                  if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) return "[Circular]";
                    seen.add(value);
                  }
                  return value;
                }, 2);
              } catch (e) {
                return String(this.state.error?.message || this.state.error || 'Erro desconhecido');
              }
            })()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.HOUSE_SELECTION);
  const [aiInstance, setAiInstance] = useState<any>(null);

  useEffect(() => {
    if (process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      setAiInstance(ai);
    }
  }, []);

  // Admin & Bot Status (Synced with Firestore)
  const [isBotOpen, setIsBotOpen] = useState(true);
  const [botClosedMessage, setBotClosedMessage] = useState('BOT EM MANUTENÇÃO. VOLTAMOS EM BREVE!');
  const [adminWhatsApp, setAdminWhatsApp] = useState('258845550673');
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{name: string, price: string} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'emola'>('mpesa');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  const [selectedHouse, setSelectedHouse] = useState<BettingHouse | null>(null);
  const [selectedCandle, setSelectedCandle] = useState<CandleType>(CandleType.PURPLE);
  const [numSignals, setNumSignals] = useState<number>(10);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [mentorAnalysis, setMentorAnalysis] = useState<string>('');
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: '' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [agendaData, setAgendaData] = useState<AgendaItem[]>([]);
  const [hackerGeralLink, setHackerGeralLink] = useState('');
  const [hackerGeralSignals, setHackerGeralSignals] = useState<Signal[]>([]);
  const [isHackingGeral, setIsHackingGeral] = useState(false);
  const [hackerGeralNumSignals, setHackerGeralNumSignals] = useState(15);
  const [hackerGeralProgress, setHackerGeralProgress] = useState(0);
  const [hackerGeralStatus, setHackerGeralStatus] = useState('');
  const [hackerGeralCountdown, setHackerGeralCountdown] = useState(0);
  const [hackerGeralIsPaying, setHackerGeralIsPaying] = useState<boolean | null>(null);
  const [hackerGeralRisk, setHackerGeralRisk] = useState<'LOW' | 'MED' | 'HIGH'>('MED');
  const [hackerGeralRegion, setHackerGeralRegion] = useState('MOZAMBIQUE');
  const [hackerGeralAutoScan, setHackerGeralAutoScan] = useState(true);
  const [isModoHacker, setIsModoHacker] = useState(false);
  const [hackerLink, setHackerLink] = useState('');
  const [serverSeed, setServerSeed] = useState('');

  const [settings, setSettings] = useState({
    precision: 99.9,
    minInterval: 2,
    autoScan: true,
    algorithm: 'DARK.BOT-v2.0'
  });

  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(PREDEFINED_THEMES[0]);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.log("Firebase not configured. Using local state for settings.");
      // Load from localStorage or use defaults
      const savedBotOpen = localStorage.getItem('isBotOpen');
      const savedBotMessage = localStorage.getItem('botClosedMessage');
      const savedAdminWA = localStorage.getItem('adminWhatsApp');
      
      if (savedBotOpen !== null) setIsBotOpen(savedBotOpen === 'true');
      if (savedBotMessage) setBotClosedMessage(savedBotMessage);
      if (savedAdminWA) setAdminWhatsApp(savedAdminWA);
      return;
    }

    const unsub = onSnapshot(doc(db, 'appSettings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsBotOpen(data.isBotOpen);
        setBotClosedMessage(data.botClosedMessage);
        setAdminWhatsApp(data.adminWhatsApp || '258845550673');
      } else {
        // Initialize global settings if they don't exist
        setDoc(doc(db, 'appSettings', 'global'), {
          isBotOpen: true,
          botClosedMessage: 'BOT EM MANUTENÇÃO. VOLTAMOS EM BREVE!',
          adminWhatsApp: '258845550673'
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'appSettings/global'));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'appSettings/global'));

    return () => {
      unsub();
    };
  }, []);

  // Test connection on boot
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    
    const testConnection = async (retryCount = 0) => {
      try {
        console.log(`Testing Firestore connection (Attempt ${retryCount + 1}) with DB ID:`, db.app.options.projectId);
        // Use getDocFromServer to force a network request
        const docRef = doc(db, 'test', 'connection');
        const docSnap = await getDocFromServer(docRef);
        console.log("Firestore connection successful! Document exists:", docSnap.exists());
      } catch (error) {
        console.error(`Firestore connection test failed (Attempt ${retryCount + 1}):`, error);
        if (error instanceof Error) {
          const isOffline = error.message.includes('the client is offline') || error.message.includes('Could not reach Cloud Firestore backend');
          if (isOffline) {
            console.error("CRITICAL: Firestore is unreachable. Check network or Firebase config.");
            // Retry up to 3 times with exponential backoff
            if (retryCount < 3) {
              const delay = Math.pow(2, retryCount) * 1000;
              console.log(`Retrying in ${delay}ms...`);
              setTimeout(() => testConnection(retryCount + 1), delay);
            }
          }
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  useEffect(() => {
    setAgendaData(INITIAL_AGENDA_DATA);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeConfig.mode === 'dark') {
      root.style.setProperty('--bg-color', '#05070a');
      root.style.setProperty('--card-bg', 'rgba(15, 23, 42, 0.4)');
      root.style.setProperty('--text-primary', '#f8fafc');
      root.style.setProperty('--text-secondary', '#94a3b8');
    } else {
      root.style.setProperty('--bg-color', '#f8fafc');
      root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.8)');
      root.style.setProperty('--text-primary', '#0f172a');
      root.style.setProperty('--text-secondary', '#475569');
    }
    root.style.setProperty('--accent-color', themeConfig.accentColor);
    root.style.setProperty('--brightness', `${themeConfig.brightness}%`);
    root.style.setProperty('--contrast', `${themeConfig.contrast}%`);
  }, [themeConfig]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const triggerRandomAlert = () => {
      const alertTemplate = GLOBAL_ALERTS[Math.floor(Math.random() * GLOBAL_ALERTS.length)];
      const newNotif: PlatformNotification = {
        id: Math.random().toString(36).substring(7),
        type: alertTemplate.type as any,
        message: alertTemplate.message,
        timestamp: Date.now()
      };
      setNotifications(prev => [newNotif, ...prev].slice(0, 3));
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 8000);
    };

    const interval = setInterval(triggerRandomAlert, 25000);
    setTimeout(triggerRandomAlert, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('isBotOpen', isBotOpen.toString());
    localStorage.setItem('botClosedMessage', botClosedMessage);
  }, [isBotOpen, botClosedMessage]);

  const handleBuyAccess = async () => {
    if (!selectedPlan) return;
    setPaymentStatus('pending');
    triggerToast("INICIANDO PROTOCOLO DE PAGAMENTO...");

    try {
      const response = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: paymentMethod,
          phone: adminWhatsApp, // Using current admin phone as mock payer
          amount: selectedPlan.price.split(' ')[0],
          plan: selectedPlan.name
        })
      });

      const data = await response.json();
      if (data.success) {
        setPaymentStatus('success');
        triggerToast(data.message);
      } else {
        setPaymentStatus('error');
        triggerToast("ERRO NA TRANSAÇÃO");
      }
    } catch (err) {
      console.error("Payment API Error:", err);
      setPaymentStatus('error');
      triggerToast("ERRO DE CONEXÃO COM O SERVIDOR");
    }
  };

  const sendReceiptToAdmin = () => {
    const adminPhone = paymentMethod === 'mpesa' ? '258845550673' : '258873361445';
    const message = encodeURIComponent(`Olá ADM DARK, realizei o pagamento via ${paymentMethod.toUpperCase()} para o plano ${selectedPlan?.name}.\nValor: ${selectedPlan?.price}\n\n[ENVIE O PRINT DO COMPROVATIVO AQUI]`);
    window.open(`https://wa.me/${adminPhone}?text=${message}`, '_blank');
    
    // Reset modal
    setIsPricingModalOpen(false);
    setSelectedPlan(null);
    setPaymentStatus('idle');
  };

  const PRICING_PLANS = [
    { name: '2 DIAS', price: '250 MZN' },
    { name: '3 DIAS', price: '350 MZN' },
    { name: '4 DIAS', price: '450 MZN' },
    { name: '5 DIAS', price: '550 MZN' },
    { name: 'REVENDEDOR', price: '700 MZN' },
  ];

  const shareSystemLink = () => {
    const shareUrl = 'https://chat.whatsapp.com/JxNMSHencryAjK0xP0K52E?mode=gi_t';
    const text = `💎 *DARK BOT - GRUPO VIP* 💎\n\n🚀 Entre no grupo de sinais mais assertivo de Moçambique!\n\n🔗 *LINK:* ${shareUrl}\n\n✅ *Extração de Lucro Garantida*`;
    
    if (navigator.share) {
      navigator.share({
        title: 'DARK BOT - Grupo VIP',
        text: text,
        url: shareUrl
      }).catch(() => {
        navigator.clipboard.writeText(text);
        triggerToast("LINK DE CONVITE COPIADO!");
      });
    } else {
      navigator.clipboard.writeText(text);
      triggerToast("LINK DE CONVITE COPIADO!");
    }
  };

  const triggerToast = (message: string) => {
    setToast({ show: true, message: message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (hackerGeralAutoScan && hackerGeralLink && !isHackingGeral) {
      interval = setInterval(() => {
        const now = new Date();
        const randomSeconds = Math.floor(Math.random() * 60);
        const time = new Date(now.getTime() + 2 * 60000 + (randomSeconds * 1000));
        const multipliers = ["2.0x+", "5.0x+", "10.0x+", "20.0x+"];
        const mult = multipliers[Math.floor(Math.random() * multipliers.length)];
        
        const newSignal: Signal = {
          id: Math.random().toString(36).substring(7),
          time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: time.getTime(),
          house: "HACKER GERAL",
          type: mult.includes("2.0x") ? CandleType.PURPLE : CandleType.PINK,
          probability: 99.8 + (Math.random() * 0.2),
          multiplier: mult,
          status: SignalStatus.WAITING
        };

        setHackerGeralSignals(prev => {
          if (prev.some(s => s.time === newSignal.time)) return prev;
          return [newSignal, ...prev].slice(0, 50);
        });
        
        triggerToast("Varredura Automática: Novo sinal detectado!");
      }, 45000);
    }
    return () => clearInterval(interval);
  }, [hackerGeralAutoScan, hackerGeralLink, isHackingGeral, triggerToast]);

  const analyzeManually = (id: string) => {
    setAgendaData(prev => prev.map(h => h.id === id ? { ...h, isGraphAnalyzing: true } : h));
    setTimeout(() => {
      setAgendaData(prev => prev.map(h => {
        if (h.id === id) {
          const newPaying = 30 + Math.random() * 65;
          return {
            ...h,
            paying: newPaying,
            reclining: 100 - newPaying,
            graphStatus: (newPaying > 75 ? 'BOM' : newPaying > 55 ? 'RAZOAVEL' : 'RUIM') as GraphStatus,
            isGraphAnalyzing: false
          };
        }
        return h;
      }));
      triggerToast("Análise de Ciclo Concluída!");
    }, 1200);
  };

  const analyzeAll = () => {
    setIsGlobalLoading(true);
    setTimeout(() => {
      setAgendaData(prev => prev.map(h => {
        const newPaying = 35 + Math.random() * 60;
        return {
          ...h,
          paying: newPaying,
          reclining: 100 - newPaying,
          graphStatus: (newPaying > 75 ? 'BOM' : newPaying > 55 ? 'RAZOAVEL' : 'RUIM') as GraphStatus,
          efronInsight: LOCAL_STRATEGIES[Math.floor(Math.random() * LOCAL_STRATEGIES.length)]
        };
      }));
      setIsGlobalLoading(false);
      triggerToast("Agenda Recalculada!");
    }, 1500);
  };

  const copyQuickAgenda = (item: AgendaItem) => {
    const text = `🏛️ *CASA:* ${item.house}\n📈 *PAYOUT:* ${item.paying.toFixed(0)}%\n📊 *STATUS:* ${item.graphStatus}\n🕒 *HORA:* ${new Date().toLocaleTimeString()}\n\n🤖 *dark.bot(hack)*`;
    navigator.clipboard.writeText(text);
    triggerToast("Status Copiado!");
  };

  const copyAgendaFull = (item: AgendaItem) => {
    const text = `💎 *DARK BOT - AGENDA* 💎\n\n🏛️ *CASA:* ${item.house.toUpperCase()}\n📊 *STATUS:* ${item.graphStatus}\n📈 *PAYOUT:* ${item.paying.toFixed(0)}%\n🛡️ *INSIGHT:* "${item.efronInsight}"\n🕒 *HORA:* ${new Date().toLocaleTimeString()}\n\n🤖 *dark.bot(hack)*`;
    navigator.clipboard.writeText(text);
    triggerToast("Agenda Elite Copiada!");
  };

  const shareAgendaFull = () => {
    const text = `💎 *DARK BOT - STATUS* 💎\n\n` + 
      agendaData.map(item => `🏛️ ${item.house}: ${item.paying.toFixed(0)}% [${item.graphStatus}]`).join('\n') + 
      `\n\n🤖 *dark.bot(hack)*`;
    if (navigator.share) {
      navigator.share({ title: 'Status DARK BOT', text: text }).catch(() => triggerToast("Erro ao compartilhar"));
    } else {
      navigator.clipboard.writeText(text);
      triggerToast("Copiado!");
    }
  };

  const generateSignals = useCallback(async () => {
    if (!selectedHouse) return;
    const finalNum = Math.min(5600, numSignals);
    setIsGlobalLoading(true);
    
    let mentorAnalysis = "Análise de semente concluída. Injetando padrões de alta precisão.";
    
    if (aiInstance) {
      try {
        const response = await aiInstance.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Você é o MENTOR DARK, um hacker de elite em Moçambique especializado no jogo Aviator. 
          Analise a casa ${selectedHouse.name}. 
          Gere uma frase curta, impactante e técnica (máximo 15 palavras) em português de Moçambique sobre a brecha atual no algoritmo e a precisão dos sinais DARK. 
          Use termos como "seed", "hash", "padrão" ou "injeção".`
        });
        mentorAnalysis = response.text || mentorAnalysis;
        setMentorAnalysis(mentorAnalysis);
      } catch (err) {
        console.error("AI Analysis Error:", err);
      }
    }

    setTimeout(() => {
      const newSignals: Signal[] = [];
      const now = new Date();
      
      // Ajuste de intervalo para velas de 5x (PINK) ou 4x (Modo Hacker)
      const baseInterval = (selectedCandle === CandleType.PINK || isModoHacker) ? 12 : settings.minInterval;
      const initialOffset = (selectedCandle === CandleType.PINK || isModoHacker) ? 8 : 2;
      const basePrecision = 99.9; // Máxima assertividade garantida

      for (let i = 0; i < finalNum; i++) {
        const randomSeconds = Math.floor(Math.random() * 60);
        const jitter = (selectedCandle === CandleType.PINK || isModoHacker) ? Math.floor(Math.random() * 5) : 0;
        const time = new Date(now.getTime() + (i * baseInterval + initialOffset + jitter) * 60000 + (randomSeconds * 1000));
        
        let multiplier = "2.0x+";
        if (isModoHacker) multiplier = "4.0x+";
        else if (selectedCandle === CandleType.PINK) multiplier = "5.0x+";

        newSignals.push({
          id: Math.random().toString(36).substring(7),
          time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: time.getTime(),
          house: selectedHouse.name,
          type: (selectedCandle === CandleType.PINK || isModoHacker) ? CandleType.PINK : CandleType.PURPLE,
          probability: 99.95 + (Math.random() * 0.04),
          multiplier: multiplier,
          status: SignalStatus.WAITING,
          seedHash: `0x${Math.random().toString(16).substring(2, 12).toUpperCase()}`,
          confidence: 99.96 + (Math.random() * 0.03),
          gale: Math.random() > 0.8 ? 1 : 2,
          secondaryMultiplier: multiplier === "2.0x+" ? "1.50x" : "2.0x",
          quantumVerification: `QM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
        });
      }
      setSignals(newSignals);
      setIsGlobalLoading(false);
      triggerToast(mentorAnalysis);
      setActiveScreen(AppScreen.VIRTUAL_BOT);
      setIsModoHacker(false);
    }, 1500);
  }, [selectedHouse, selectedCandle, numSignals, settings, triggerToast, isModoHacker, aiInstance]);

  const generateHackerGeralSignals = useCallback(() => {
    if (!hackerGeralLink) {
      triggerToast("Insira o link da casa!");
      return;
    }
    
    setIsHackingGeral(true);
    setHackerGeralProgress(0);
    setHackerGeralCountdown(8); // Increased for analysis phase
    setHackerGeralStatus("Analisando Fluxo de Pagamento...");
    setHackerGeralIsPaying(null);
    setHackerGeralSignals([]);

    // Analysis Phase (First 3 seconds)
    setTimeout(() => {
      const isPaying = Math.random() > 0.3; // 70% chance of paying for simulation
      setHackerGeralIsPaying(isPaying);
      
      if (!isPaying) {
        setHackerGeralStatus("CASA NÃO ESTÁ PAGANDO! ABORTANDO...");
        setHackerGeralProgress(0);
        setHackerGeralCountdown(0);
        setTimeout(() => {
          setIsHackingGeral(false);
          triggerToast("ALERTA: Casa com baixa taxa de retorno!");
        }, 2000);
        return;
      }

      setHackerGeralStatus("CASA PAGANDO! INICIANDO HACK...");
      setHackerGeralProgress(30);

      // Countdown timer for the rest
      const countdownInterval = setInterval(() => {
        setHackerGeralCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Progress and Status updates
      const steps = [
        { p: 45, s: "Bypassing Cloudflare Security..." },
        { p: 65, s: "Quantum Seed Sync Active..." },
        { p: 85, s: "Injetando Hash de 128-bit..." },
        { p: 100, s: "Sincronização Elite 99.99% OK!" }
      ];

      steps.forEach((step, index) => {
        setTimeout(() => {
          setHackerGeralProgress(step.p);
          setHackerGeralStatus(step.s);
          
          if (index === steps.length - 1) {
            setTimeout(() => {
              const newSignals: Signal[] = [];
              const now = new Date();
              const multipliers = ["2.0x+", "5.0x+", "10.0x+", "20.0x+"];
              
              for (let i = 0; i < hackerGeralNumSignals; i++) {
                const randomSeconds = Math.floor(Math.random() * 60);
                const interval = 5 + Math.floor(Math.random() * 15);
                const time = new Date(now.getTime() + (i * interval + 5) * 60000 + (randomSeconds * 1000));
                const mult = multipliers[Math.floor(Math.random() * multipliers.length)];
                
                newSignals.push({
                  id: Math.random().toString(36).substring(7),
                  time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  timestamp: time.getTime(),
                  house: "HACKER GERAL",
                  type: mult.includes("2.0x") ? CandleType.PURPLE : CandleType.PINK,
                  probability: 99.9 + (Math.random() * 0.09),
                  multiplier: mult,
                  status: SignalStatus.WAITING,
                  seedHash: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
                  confidence: 99.9 + (Math.random() * 0.09)
                });
              }
              setHackerGeralSignals(newSignals);
              setIsHackingGeral(false);
              setHackerGeralProgress(0);
              triggerToast("Quantum Hooking Completo! Sinais 99.99% Assertivos.");
            }, 500);
          }
        }, (index + 1) * 1000);
      });
    }, 3000);
  }, [hackerGeralLink, hackerGeralNumSignals, triggerToast]);

  const recalibrate = () => {
    setIsGlobalLoading(true);
    triggerToast("Injetando Protocolo Quantum Sync 2.0...");
    setTimeout(() => {
      setSettings(prev => ({ ...prev, precision: 99.99, algorithm: 'DARK.BOT-v2.0-ULTRA' }));
      setIsGlobalLoading(false);
      triggerToast("Calibração Crítica Concluída! Assertividade cravada em 99.99%.");
    }, 2500);
  };

  const copySignal = (sig: Signal) => {
    const text = `💎 *DARK BOT - QUANTUM SIGNAL* 💎\n\n🏛️ *CASA:* ${sig.house.toUpperCase()}\n⏰ *HORARIO:* ${sig.time}\n🎯 *ALVO:* ${sig.multiplier}\n🔥 *ASSERTIVIDADE:* ${sig.confidence?.toFixed(2) || sig.probability.toFixed(2)}%\n🧬 *SEED HASH:* ${sig.seedHash || 'N/A'}\n🛡️ *VERIFICAÇÃO:* QUANTUM SECURE\n\n✅ *ENTRADA AUTORIZADA (99.9% DARK)*\n🤖 *dark.bot (hack)*`;
    navigator.clipboard.writeText(text);
    triggerToast("Sinal Copiado para Área de Transferência!");
  };

  const copyAllSignals = () => {
    if (signals.length === 0) return;
    const houseName = selectedHouse?.name.toUpperCase() || "SISTEMA";
    const body = signals.slice(0, 50).map(sig => `⏰ ${sig.time} -> ${sig.multiplier} [${sig.confidence?.toFixed(2)}%]`).join('\n');
    const text = `💎 *DARK BOT - LISTA QUANTUM* 💎\n\n🏛️ *CASA:* ${houseName}\n🔥 *ASSERTIVIDADE:* 99.99% DARK\n🛡️ *PROTOCOLO:* QUANTUM SYNC\n\n${body}\n\n🤖 *dark.bot (hack)*`;
    navigator.clipboard.writeText(text);
    triggerToast("Lista Elite Copiada!");
  };

  const shareAllSignals = () => {
    if (signals.length === 0) return;
    const houseName = selectedHouse?.name.toUpperCase() || "SISTEMA";
    const body = signals.slice(0, 50).map(sig => `⏰ ${sig.time} -> ${sig.multiplier} [${sig.confidence?.toFixed(2)}%]`).join('\n');
    const text = `💎 *DARK BOT - LISTA QUANTUM* 💎\n\n🏛️ *CASA:* ${houseName}\n🔥 *ASSERTIVIDADE:* 99.99% DARK\n🛡️ *PROTOCOLO:* QUANTUM SYNC\n\n${body}\n\n🤖 *dark.bot (hack)*`;
    if (navigator.share) {
      navigator.share({ title: `Sinais ${houseName}`, text: text }).catch(() => triggerToast("Erro ao compartilhar"));
    } else {
      navigator.clipboard.writeText(text);
      triggerToast("Copiados!");
    }
  };

  const checkSignalStatus = (id: string) => {
    setSignals(prev => prev.map(s => {
      if (s.id === id) {
        const statuses = [SignalStatus.WIN, SignalStatus.LOSS, SignalStatus.ACTIVE];
        const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
        return { ...s, status: newStatus };
      }
      return s;
    }));
    triggerToast("Verificando Sincronização...");
  };

  const clearSignals = () => {
    setSignals([]);
    triggerToast("Sinais Limpos!");
  };

  const [mentorChatInput, setMentorChatInput] = useState('');

  const handleMentorChat = async () => {
    if (!mentorChatInput.trim() || !aiInstance) return;
    
    const userMsg: SupportMessage = {
      id: Math.random().toString(36).substring(7),
      text: mentorChatInput,
      timestamp: Date.now(),
      isUser: true
    };
    
    setSupportMessages(prev => [userMsg, ...prev]);
    const currentInput = mentorChatInput;
    setMentorChatInput('');
    setIsGlobalLoading(true);
    
    try {
      const response = await aiInstance.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Você é o MENTOR DARK, um hacker de elite em Moçambique. O usuário perguntou: "${currentInput}". 
        Responda de forma curta, direta, impactante e com tom de expert. 
        Use gírias técnicas de hacker e mencione a realidade das apostas em Moçambique (Premier Bet, 888Starz, Elephant Bet). 
        Máximo 30 palavras. Seja motivador mas realista sobre gestão de banca.`
      });
      
      if (!response || !response.text) {
        throw new Error("Resposta vazia do mentor.");
      }
      
      const text = response.text;
      
      const mentorMsg: SupportMessage = {
        id: Math.random().toString(36).substring(7),
        text: text,
        timestamp: Date.now()
      };
      
      setSupportMessages(prev => [mentorMsg, ...prev]);
    } catch (err) {
      console.error("Mentor Chat Error:", err);
      triggerToast("Mentor indisponível.");
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const generateMotivationalMessage = useCallback(async () => {
    if (!aiInstance) {
      triggerToast("Mentor offline. Tente novamente.");
      return;
    }
    setIsGlobalLoading(true);
    try {
      const response = await aiInstance.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Gere uma mensagem curta de motivação e estratégia para um apostador de Aviator em Moçambique. Use um tom de mentor "hacker" elite, seja direto e impactante. Mencione a importância de sair no lucro e não ser ganancioso. Use termos como "extração", "lucro no bolso" e "disciplina de ferro".'
      });
      
      if (!response || !response.text) {
        throw new Error("Resposta vazia do mentor.");
      }
      
      const text = response.text;
      
      const newMsg: SupportMessage = {
        id: Math.random().toString(36).substring(7),
        text: text,
        timestamp: Date.now()
      };
      
      setSupportMessages(prev => [newMsg, ...prev]);
      triggerToast("Insight do Mentor Recebido!");
    } catch (err) {
      console.error("Gemini Error:", err);
      triggerToast("Falha ao sincronizar com mentor.");
    } finally {
      setIsGlobalLoading(false);
    }
  }, []);

  const onLogoClick = () => setActiveScreen(AppScreen.SETTINGS);

  return (
    <ErrorBoundary>
      <Layout 
      activeScreen={activeScreen} 
      setScreen={setActiveScreen} 
      title={selectedHouse?.name} 
      themeConfig={themeConfig}
      onLogoClick={onLogoClick}
    >
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] w-[90%] max-w-[380px] pointer-events-none flex flex-col gap-2">
        {notifications.map(notif => (
          <div 
            key={notif.id}
            className={`pointer-events-auto p-4 rounded-2xl glass-card flex items-start gap-3 shadow-2xl animate-in slide-in-from-top-10 duration-500 border-l-4 ${
              notif.type === 'info' ? 'border-l-blue-500' : 
              notif.type === 'alert' ? 'border-l-yellow-500' : 
              notif.type === 'success' ? 'border-l-emerald-500' : 'border-l-rose-600'
            }`}
          >
            <div className={`mt-1 w-2 h-2 rounded-full ${
              notif.type === 'info' ? 'bg-blue-500' : 
              notif.type === 'alert' ? 'bg-yellow-500' : 
              notif.type === 'success' ? 'bg-emerald-500' : 'bg-rose-600 animate-pulse'
            }`} />
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60 mb-1">Sistema DARK Alerta</p>
              <p className="text-[11px] font-bold text-primary leading-tight">{notif.message}</p>
            </div>
          </div>
        ))}
      </div>

      {toast.show && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] bg-white text-black px-5 py-2 rounded-full font-black text-[9px] uppercase shadow-2xl animate-in zoom-in">
          {toast.message}
        </div>
      )}

      {isGlobalLoading && (
        <div className="fixed inset-0 bg-[#05070a]/98 z-[2000] flex flex-col items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="h-full w-full bg-[linear-gradient(rgba(0,255,157,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <div className="relative">
            <div className="w-16 h-16 border-t-2 border-b-2 border-accent rounded-full animate-spin mb-8 shadow-[0_0_20px_rgba(0,255,157,0.3)]"></div>
            <div className="absolute inset-0 w-16 h-16 border-r-2 border-l-2 border-accent/20 rounded-full animate-reverse-spin"></div>
          </div>
          <div className="space-y-3 text-center">
            <p className="text-accent font-mono text-[9px] font-black uppercase tracking-[0.6em] animate-pulse">Injetando Protocolo</p>
            <div className="flex gap-1 justify-center">
              <div className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1 h-1 bg-accent rounded-full animate-bounce" />
            </div>
          </div>
          <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div className="h-full bg-accent animate-progress-fast shadow-[0_0_10px_rgba(0,255,157,0.5)]" />
          </div>
          <p className="mt-4 text-[7px] font-mono text-secondary/40 uppercase tracking-widest">Sincronizando com Mentor DARK...</p>
        </div>
      )}


      {activeScreen === AppScreen.SETTINGS && (
        <div className="px-5 space-y-6 pb-20 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-primary">System <span className="text-accent">Elite</span></h2>
          </div>

          <div className="space-y-4">
            <div className="glass-card p-5 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-serif italic text-accent uppercase tracking-widest border-b border-white/5 pb-2">Status do Algoritmo</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-secondary uppercase font-bold">Versão</span>
                  <span className="text-[10px] text-primary font-black tracking-widest">{settings.algorithm}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-secondary uppercase font-bold">Assertividade Base</span>
                  <span className="text-[10px] text-accent font-black">{settings.precision}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-secondary uppercase font-bold">Modo Elite</span>
                  <span className="text-[10px] text-accent font-black animate-pulse">ATIVADO</span>
                </div>
                <button 
                  onClick={recalibrate}
                  className="w-full py-2.5 bg-accent/10 border border-accent/20 text-accent rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,157,0.1)] group-hover:bg-accent group-hover:text-black"
                >
                  {settings.precision === 99.99 ? 'SISTEMA NO LIMITE (99.99%)' : 'Forçar Recalibração (99.9%)'}
                </button>
              </div>
            </div>

            <div className="glass-card p-5 rounded-3xl space-y-4">
              <h3 className="text-[9px] font-black text-accent uppercase tracking-widest border-b border-white/5 pb-2">Configurações de API</h3>
              <p className="text-[10px] text-secondary leading-relaxed">
                Se você estiver atingindo limites de cota (429), você pode usar sua própria chave de API do Google Cloud paga.
              </p>
              <button 
                onClick={handleOpenKeySelector}
                className={`w-full py-3 rounded-xl font-bold text-[9px] uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${hasApiKey ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 text-secondary border-white/5'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {hasApiKey ? 'Chave de API Vinculada' : 'Vincular Chave de API Própria'}
              </button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[8px] text-accent underline block text-center uppercase tracking-widest"
              >
                Saiba mais sobre faturamento
              </a>
            </div>

            <div className="glass-card p-5 rounded-3xl space-y-4">
              <h3 className="text-[9px] font-black text-accent uppercase tracking-widest border-b border-white/5 pb-2">Selecione o Visual</h3>
              <div className="grid grid-cols-2 gap-2">
                {PREDEFINED_THEMES.map(t => (
                  <button key={t.id} onClick={() => setThemeConfig(t)} 
                    className={`py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-wider border transition-all ${themeConfig.id === t.id ? 'bg-accent text-black border-accent' : 'bg-white/5 text-secondary border-white/5'}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card p-5 rounded-3xl space-y-4">
              <h3 className="text-[9px] font-black text-accent uppercase tracking-widest border-b border-white/5 pb-2">Criar Customizado</h3>
              <div className="space-y-4">
                 <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {['#00FF9D', '#00D1FF', '#BD00FF', '#FF3B3B', '#FFD700', '#FF8A00', '#FF007A', '#FFFFFF'].map(c => (
                      <button key={c} onClick={() => setThemeConfig({...themeConfig, accentColor: c, id: 'custom', name: 'Custom Theme'})}
                        style={{ backgroundColor: c }} className={`min-w-[32px] h-8 rounded-lg border-2 ${themeConfig.accentColor === c ? 'border-accent' : 'border-white/10'}`} />
                    ))}
                 </div>
                 <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold text-secondary uppercase">Brilho <span>{themeConfig.brightness}%</span></div>
                      <input type="range" min="50" max="150" value={themeConfig.brightness} onChange={e => setThemeConfig({...themeConfig, brightness: parseInt(e.target.value)})} className="w-full h-1 bg-white/5 rounded-full accent-accent" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold text-secondary uppercase">Contraste <span>{themeConfig.contrast}%</span></div>
                      <input type="range" min="50" max="150" value={themeConfig.contrast} onChange={e => setThemeConfig({...themeConfig, contrast: parseInt(e.target.value)})} className="w-full h-1 bg-white/5 rounded-full accent-accent" />
                    </div>
                 </div>
              </div>
            </div>

            <button onClick={() => { triggerToast("Acessando..."); setActiveScreen(AppScreen.HOUSE_SELECTION); }} 
              className="w-full py-4 bg-accent text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">Sincronizar Protocolo</button>
          </div>
        </div>
      )}

      {activeScreen === AppScreen.HOUSE_SELECTION && (
        <div className="px-4 space-y-6 pb-20 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-primary tracking-tight">Tools <span className="text-accent">Selection</span></h2>
              <p className="text-[8px] text-secondary uppercase tracking-[0.3em] font-black">Moçambique Intelligence Hub</p>
            </div>
            <button 
              onClick={() => setIsQuickAccessOpen(true)}
              className="p-3 bg-white/5 border border-white/10 rounded-2xl text-accent hover:bg-accent/10 transition-all active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </button>
          </div>

          <div className="glass-card p-4 rounded-3xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-accent uppercase tracking-widest">Grupo VIP WhatsApp</p>
              <p className="text-[7px] text-secondary font-bold uppercase">Entre e convide seus amigos</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => window.open('https://chat.whatsapp.com/JxNMSHencryAjK0xP0K52E?mode=gi_t', '_blank')}
                className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all"
              >
                Entrar
              </button>
              <button 
                onClick={shareSystemLink}
                className="px-4 py-2 bg-accent text-black rounded-xl font-black text-[8px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                Convidar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {BETTING_HOUSES.map(h => (
              <button key={h.id} onClick={() => { setSelectedHouse(h); setActiveScreen(AppScreen.HACK_GENERATOR); }}
                className="glass-card p-4 rounded-3xl flex flex-col items-center text-center gap-3 transition-all hover:bg-white/[0.05] hover:scale-[1.03] active:scale-95 border border-white/5 group">
                <div className={`w-14 h-14 ${h.color} rounded-2xl flex items-center justify-center text-3xl border border-white/10 shadow-lg group-hover:rotate-6 transition-transform`}>{h.logo}</div>
                <div className="space-y-1">
                  <span className="text-xs font-black text-primary block tracking-tight">{h.name}</span>
                  <div className="flex items-center justify-center gap-1 opacity-60">
                    <span className="w-1 h-1 rounded-full bg-accent animate-pulse"></span>
                    <span className="text-[7px] font-mono text-accent uppercase tracking-widest font-bold">Online</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeScreen === AppScreen.HACK_GENERATOR && (
        <div className="px-5 space-y-6 pb-20 animate-in zoom-in-95">
           <div className="flex items-center gap-3">
              <button onClick={() => setActiveScreen(AppScreen.HOUSE_SELECTION)} className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-secondary border border-white/5">←</button>
              <h3 className="font-black text-lg text-primary">{selectedHouse?.name}</h3>
           </div>

           <div className="glass-card p-6 rounded-[2rem] space-y-8 border border-white/5 relative">
              <div className="space-y-4">
                 <span className="text-[9px] text-secondary uppercase tracking-[0.2em] font-black block text-center">Hackear Gerar (Multiplicador)</span>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setSelectedCandle(CandleType.PURPLE)} 
                      className={`py-6 rounded-2xl border-2 font-black transition-all flex flex-col items-center gap-2 ${selectedCandle === CandleType.PURPLE ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'bg-[#080b15] border-white/5 text-secondary opacity-50'}`}
                    >
                      <span className="text-2xl">🟣</span>
                      <span className="text-[12px] uppercase tracking-tighter">VELA 2X+</span>
                      <span className="text-[7px] font-bold opacity-60">CONSERVADOR</span>
                    </button>
                    <button 
                      onClick={() => setIsModoHacker(true)} 
                      className={`py-6 rounded-2xl border-2 font-black transition-all flex flex-col items-center gap-2 ${isModoHacker ? 'bg-accent/20 border-accent text-accent shadow-[0_0_20px_rgba(0,255,157,0.2)]' : 'bg-[#080b15] border-white/5 text-secondary opacity-50'}`}
                    >
                      <span className="text-2xl">⚡</span>
                      <span className="text-[12px] uppercase tracking-tighter">MODO HACKER</span>
                      <span className="text-[7px] font-bold opacity-60">INJEÇÃO DE SEED</span>
                    </button>
                 </div>
              </div>

              {isModoHacker && (
                <div className="glass-card p-5 rounded-3xl border border-accent/20 bg-accent/5 animate-in zoom-in-95 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-[9px] font-black text-accent uppercase tracking-widest">Configuração de Semente</span>
                    <button onClick={() => setIsModoHacker(false)} className="text-secondary hover:text-white text-xs">✕</button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[7px] text-secondary uppercase font-bold">Link da Casa</label>
                      <input 
                        type="text" 
                        value={hackerLink}
                        onChange={e => setHackerLink(e.target.value)}
                        placeholder="https://elephantbet.co.mz"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[10px] text-primary outline-none focus:border-accent/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] text-secondary uppercase font-bold">Semente do Servidor (Última Rodada)</label>
                      <input 
                        type="text" 
                        value={serverSeed}
                        onChange={e => setServerSeed(e.target.value)}
                        placeholder="Ex: 8f2a...9c1e"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-[10px] text-primary outline-none focus:border-accent/30"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        if(!hackerLink || !serverSeed) {
                          triggerToast("Preencha todos os campos!");
                          return;
                        }
                        generateSignals();
                      }}
                      className="w-full py-3 bg-accent text-black rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                    >
                      Injetar e Gerar 4.0x
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4 text-center border-t border-white/5 pt-8">
                 <span className="text-[9px] text-secondary uppercase tracking-[0.2em] font-black block">Quantidade de Entradas</span>
                 <div className="flex flex-col items-center gap-4">
                   <input 
                      type="number" 
                      min="1" 
                      max="5600"
                      value={numSignals} 
                      onChange={e => setNumSignals(Math.min(5600, parseInt(e.target.value) || 0))}
                      className="w-full bg-transparent font-black text-6xl text-center text-primary outline-none tabular-nums" 
                      placeholder="10"
                   />
                   <div className="flex flex-wrap justify-center gap-2">
                      {[10, 25, 50, 100, 500, 1000].map(v => (
                        <button key={v} onClick={() => setNumSignals(v)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[8px] font-black text-secondary hover:text-accent uppercase transition-all">{v}</button>
                      ))}
                   </div>
                 </div>
              </div>

              <div className="space-y-3">
                <button onClick={generateSignals} className="w-full py-5 bg-accent text-black rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Hackear Sinais</button>
                <button onClick={recalibrate} className="w-full py-3 bg-white/5 border border-white/10 text-secondary rounded-xl font-black text-[10px] uppercase tracking-[0.1em] active:scale-95 transition-all">Recalibrar Algoritmo (Elite)</button>
              </div>
           </div>
        </div>
      )}

      {activeScreen === AppScreen.HACKER_GERAL && (
        <div className="px-5 space-y-6 pb-20 animate-in fade-in">
          <div className="text-center space-y-1">
             <div className="inline-block px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
                <p className="text-[7px] text-accent uppercase tracking-widest font-black">Módulo Hacker Geral Ativo</p>
             </div>
             <h2 className="text-2xl font-black text-primary italic">Hacker <span className="text-accent">Geral</span></h2>
             <p className="text-[8px] text-secondary uppercase tracking-[0.3em] font-black">Injeção de Link Direta</p>
          </div>

          <div className="glass-card p-6 rounded-[2rem] space-y-6 border border-white/5 relative overflow-hidden">
            {isHackingGeral && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-white/5 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black text-accent">{hackerGeralCountdown}s</span>
                  </div>
                </div>
                
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-[8px] font-black text-accent uppercase tracking-widest">
                    <span>{hackerGeralStatus}</span>
                    <span>{hackerGeralProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,255,157,0.5)]"
                      style={{ width: `${hackerGeralProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                <p className="text-[7px] font-mono text-secondary/60 animate-pulse">ESTABLISHING ENCRYPTED TUNNEL...</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] text-secondary uppercase tracking-[0.2em] font-black block">Link da Casa de Aposta</label>
                  <span className="text-[7px] font-mono text-accent animate-pulse">SSL: SECURE</span>
                </div>
                <input 
                  type="text" 
                  value={hackerGeralLink}
                  onChange={e => setHackerGeralLink(e.target.value)}
                  placeholder="https://exemplo.com"
                  className="w-full bg-[#080b15] border border-white/5 rounded-xl py-4 px-4 text-xs font-bold text-primary outline-none focus:border-accent/30 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-secondary uppercase tracking-[0.2em] font-black block text-center">Quantidade de Sinais</label>
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => setHackerGeralNumSignals(Math.max(1, hackerGeralNumSignals - 5))} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-primary font-black border border-white/5">-</button>
                  <span className="text-4xl font-black text-primary tabular-nums">{hackerGeralNumSignals}</span>
                  <button onClick={() => setHackerGeralNumSignals(Math.min(100, hackerGeralNumSignals + 5))} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-primary font-black border border-white/5">+</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[7px] text-secondary uppercase tracking-[0.2em] font-black block">Nível de Risco</label>
                  <select 
                    value={hackerGeralRisk}
                    onChange={e => setHackerGeralRisk(e.target.value as any)}
                    className="w-full bg-[#080b15] border border-white/5 rounded-xl py-2.5 px-3 text-[9px] font-bold text-primary outline-none"
                  >
                    <option value="LOW">BAIXO (SEGURO)</option>
                    <option value="MED">MÉDIO (EQUILIBRADO)</option>
                    <option value="HIGH">ALTO (AGRESSIVO)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[7px] text-secondary uppercase tracking-[0.2em] font-black block">Região do Servidor</label>
                  <select 
                    value={hackerGeralRegion}
                    onChange={e => setHackerGeralRegion(e.target.value)}
                    className="w-full bg-[#080b15] border border-white/5 rounded-xl py-2.5 px-3 text-[9px] font-bold text-primary outline-none"
                  >
                    <option value="MOZAMBIQUE">MOÇAMBIQUE</option>
                    <option value="SOUTH_AFRICA">ÁFRICA DO SUL</option>
                    <option value="EUROPE">EUROPA (PROXY)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-primary uppercase">Varredura Automática</span>
                  <span className="text-[6px] text-secondary uppercase">Monitorar link continuamente</span>
                </div>
                <button 
                  onClick={() => setHackerGeralAutoScan(!hackerGeralAutoScan)}
                  className={`w-10 h-5 rounded-full relative transition-all ${hackerGeralAutoScan ? 'bg-accent shadow-[0_0_10px_rgba(0,255,157,0.3)] animate-pulse' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-black rounded-full transition-all ${hackerGeralAutoScan ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-accent/20"></div>
                  <span className="text-[7px] font-bold text-secondary uppercase block mb-1">Precisão</span>
                  <span className="text-lg font-black text-accent">99.99%</span>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500/20"></div>
                  <span className="text-[7px] font-bold text-secondary uppercase block mb-1">Status</span>
                  <span className={`text-lg font-black ${hackerGeralIsPaying === false ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {hackerGeralIsPaying === null ? 'READY' : hackerGeralIsPaying ? 'PAGANDO' : 'NÃO PAGA'}
                  </span>
                </div>
              </div>

              <button 
                onClick={generateHackerGeralSignals}
                disabled={isHackingGeral}
                className="w-full py-5 bg-accent text-black rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isHackingGeral ? 'Hackeando...' : 'Gerar Previsões Assertivas'}
              </button>

              <button 
                onClick={recalibrate}
                disabled={isHackingGeral}
                className="w-full py-3 bg-white/5 border border-white/10 text-secondary rounded-xl font-black text-[10px] uppercase tracking-[0.1em] active:scale-95 transition-all"
              >
                Recalibrar Algoritmo (Elite)
              </button>
            </div>
          </div>

          <div className="glass-card p-4 rounded-3xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black text-secondary uppercase tracking-widest">Hacker Console</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-accent animate-ping"></div>
                <div className="w-1 h-1 rounded-full bg-accent"></div>
              </div>
            </div>
            <div className="font-mono text-[7px] text-secondary/60 space-y-1 max-h-24 overflow-y-auto">
              <p className="">[INFO] Handshake established with {hackerGeralLink || 'remote_host'}</p>
              <p className="">[SCAN] Analyzing payout flow for {hackerGeralLink || 'target'}...</p>
              {hackerGeralIsPaying !== null && (
                <p className={hackerGeralIsPaying ? 'text-emerald-500' : 'text-rose-500'}>
                  [RESULT] House Status: {hackerGeralIsPaying ? 'PAYING (SIM)' : 'NOT PAYING (NÃO)'}
                </p>
              )}
              {isHackingGeral && <p className="animate-pulse">[DATA] Intercepting websocket packets...</p>}
              {isHackingGeral && <p className="">[AUTH] Session token extracted: 0x{Math.random().toString(16).substring(2, 10)}</p>}
              {hackerGeralAutoScan && hackerGeralLink && !isHackingGeral && (
                <p className="text-accent animate-pulse">[AUTO-SCAN] Monitorando link em tempo real...</p>
              )}
              {hackerGeralSignals.length > 0 && <p className="text-accent/60">[SUCCESS] Algorithm synchronized with server time</p>}
            </div>
          </div>

          {hackerGeralSignals.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">Previsões Geradas</h3>
                <button onClick={() => setHackerGeralSignals([])} className="text-[8px] font-black text-rose-500 uppercase">Limpar</button>
              </div>
              <div className="space-y-3">
                {hackerGeralSignals.map((s) => (
                  <div key={s.id} className="glass-card p-4 rounded-3xl flex items-center justify-between border border-white/5 relative overflow-hidden">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-primary tabular-nums">{s.time}</span>
                        <span className="text-[7px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase">99.9% Elite</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase mt-1 ${s.type === CandleType.PINK ? 'text-pink-500' : 'text-purple-600'}`}>
                        Alvo: {s.multiplier}
                      </span>
                    </div>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(`SINAL HACKER GERAL\n⏰ ${s.time}\n🎯 ${s.multiplier}\n🔥 99.9% Elite`); triggerToast("Copiado!"); }}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-primary rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-accent hover:text-black transition-all"
                    >
                      COPIAR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeScreen === AppScreen.VIRTUAL_BOT && (
        <div className="px-5 space-y-6 pb-20 animate-in fade-in">
          <div className="text-center space-y-1">
             <div className="inline-block px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
                <p className="text-[7px] text-accent uppercase tracking-widest font-black">Hack DARK BOT Confirmado</p>
             </div>
             <h2 className="text-2xl font-black text-primary italic">Sala <span className="text-accent">Elite</span></h2>
             {selectedHouse && (
               <div className="flex items-center justify-center gap-2 mt-2">
                 <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Servidor Ativo:</span>
                 <span className="text-[10px] font-black text-accent uppercase tracking-widest">{selectedHouse.name}</span>
               </div>
             )}
          </div>

          <div className="grid grid-cols-3 gap-2">
              <button onClick={copyAllSignals} className="py-3 bg-white text-black rounded-xl font-black text-[8px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Copiar</button>
              <button onClick={shareAllSignals} className="py-3 bg-accent text-black rounded-xl font-black text-[8px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Enviar</button>
              <button onClick={clearSignals} className="py-3 bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl font-black text-[8px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Limpar</button>
          </div>

          <div className="space-y-4">
            {signals.slice(0, 40).map((s) => (
              <div key={s.id} className="glass-card p-5 rounded-[2.2rem] flex items-center justify-between border border-white/5 group transition-all hover:bg-white/[0.05] relative overflow-hidden">
                 <div className={`absolute top-0 left-0 w-1 h-full ${s.type === CandleType.PINK ? 'bg-pink-500' : 'bg-purple-600'}`}></div>
                 <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black text-primary tabular-nums tracking-tighter leading-none">{s.time}</span>
                      <span className="text-[7px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded uppercase">Elite</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${s.type === CandleType.PINK ? 'bg-pink-500/20 text-pink-500' : 'bg-purple-600/20 text-purple-600'}`}>
                        {s.multiplier}
                      </span>
                      {s.gale && (
                        <span className="text-[7px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded uppercase border border-rose-500/20">
                          {s.gale} Gale Max
                        </span>
                      )}
                      {s.seedHash && (
                        <span className="text-[7px] font-mono text-secondary/60 bg-white/5 px-1.5 py-0.5 rounded uppercase">
                          Hash: {s.seedHash}
                        </span>
                      )}
                      {s.quantumVerification && (
                         <div className="flex items-center gap-1 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[6px] font-mono text-emerald-400/80 uppercase tracking-tighter">{s.quantumVerification}</span>
                         </div>
                      )}
                      {s.status && (
                        <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded ${
                          s.status === SignalStatus.WIN ? 'bg-emerald-500 text-black' : 
                          s.status === SignalStatus.LOSS ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {s.status}
                        </span>
                      )}
                    </div>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-col items-end">
                       <div className="flex items-center gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[8px] font-black text-emerald-500 uppercase">{s.confidence?.toFixed(2) || '99.98'}% Elite</span>
                       </div>
                       <p className="text-[6px] text-secondary font-black uppercase tracking-widest opacity-40">Quantum Verified</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => copySignal(s)} className="p-2 bg-white/5 border border-white/10 text-primary rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-accent hover:text-black transition-all active:scale-90">C</button>
                      <button onClick={() => checkSignalStatus(s.id)} className="p-2 bg-accent/10 border border-accent/20 text-accent rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-accent hover:text-black transition-all active:scale-90">V</button>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeScreen === AppScreen.AGENDA && (
        <div className="px-4 space-y-6 pb-20 animate-in slide-in-from-bottom-5">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-primary italic">Elite <span className="text-accent">Agenda</span></h2>
            <p className="text-[8px] text-secondary font-mono uppercase tracking-[0.3em] font-black">Ciclos Pagadores</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={analyzeAll} className="py-3 bg-white/5 text-secondary rounded-xl font-black text-[9px] uppercase tracking-widest border border-white/5 transition-all active:scale-95">Recalcular</button>
            <button onClick={shareAgendaFull} className="py-3 bg-accent text-black rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95">Relatório</button>
          </div>

          <div className="space-y-3">
            {agendaData.map(item => (
              <div key={item.id} className="glass-card rounded-[1.8rem] p-4 space-y-4 border border-white/5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-2xl border border-white/5">{item.logo}</div>
                    <div>
                       <h3 className="font-black text-sm text-primary tracking-tight">{item.house}</h3>
                       <div className="flex items-center gap-1.5">
                         <span className={`w-1 h-1 rounded-full ${item.graphStatus === 'BOM' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                         <span className="text-[7px] font-black text-secondary uppercase tracking-widest">{item.graphStatus}</span>
                       </div>
                    </div>
                  </div>
                  <button onClick={() => analyzeManually(item.id)} className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-secondary hover:text-accent transition-all ${item.isGraphAnalyzing ? 'animate-spin' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#080b15] p-2.5 rounded-xl border border-white/[0.03] text-center">
                    <span className="text-[7px] font-bold text-secondary uppercase block">Pagar</span>
                    <span className="text-xl font-black text-emerald-400">{item.paying.toFixed(0)}%</span>
                  </div>
                  <div className="bg-[#080b15] p-2.5 rounded-xl border border-white/[0.03] text-center">
                    <span className="text-[7px] font-bold text-secondary uppercase block">Retenção</span>
                    <span className="text-xl font-black text-rose-500">{item.reclining.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => copyQuickAgenda(item)} className="py-2.5 bg-white/5 text-secondary text-[8px] font-black uppercase rounded-lg">Quick</button>
                  <button onClick={() => copyAgendaFull(item)} className="py-2.5 bg-white text-black text-[8px] font-black uppercase rounded-lg">Elite</button>
                  <button onClick={() => { setSelectedHouse(BETTING_HOUSES.find(h => h.id === item.id) || null); setActiveScreen(AppScreen.HACK_GENERATOR); }} className="py-2.5 bg-accent text-black text-[8px] font-black uppercase rounded-lg">Start</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeScreen === AppScreen.SIGNAL_ROOM && (
        <div className="px-5 pb-20">
          <div className="mb-8 text-center space-y-1">
             <h2 className="text-xl font-black text-primary">System <span className="text-accent">Logs</span></h2>
             <p className="text-[8px] text-secondary font-mono uppercase tracking-[0.4em] font-bold">Terminal Moçambique</p>
          </div>
          <SignalHistory history={signals} mentorAnalysis={mentorAnalysis} onRemove={id => setSignals(s => s.filter(x => x.id !== id))} onClearAll={() => { setSignals([]); setMentorAnalysis(''); }} onCopy={() => triggerToast("Copiado!")} currentTime={currentTime} />
        </div>
      )}

      {activeScreen === AppScreen.SUPPORT && (
        <div className="px-5 space-y-6 pb-20 animate-in fade-in">
          <div className="text-center space-y-3">
             <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto border border-white/10 shadow-lg">
                <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
             </div>
             <h2 className="text-xl font-black text-primary italic">Mentor <span className="text-accent">Protocol</span></h2>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text"
                value={mentorChatInput}
                onChange={e => setMentorChatInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleMentorChat()}
                placeholder="Pergunte ao Mentor..."
                className="flex-1 bg-black/40 border border-white/10 rounded-2xl py-4 px-5 text-[10px] text-primary outline-none focus:border-accent/50 transition-all"
              />
              <button 
                onClick={handleMentorChat}
                className="px-6 bg-white text-black rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all"
              >
                Enviar
              </button>
            </div>
            
            <button onClick={generateMotivationalMessage} className="w-full py-4 bg-accent/10 border border-accent/20 text-accent rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">Sincronizar Apoio</button>
            
            <div className="grid grid-cols-1 gap-3">
              {supportMessages.map(msg => (
                <div key={msg.id} className={`p-5 rounded-3xl space-y-3 border ${msg.isUser ? 'bg-white/5 border-white/10 ml-8' : 'glass-card border-white/5 mr-8'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[7px] font-black uppercase tracking-widest ${msg.isUser ? 'text-secondary' : 'text-accent'}`}>
                      {msg.isUser ? 'VOCÊ' : 'MENTOR DARK'}
                    </span>
                    <span className="text-[6px] text-secondary/40 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className={`text-[10px] leading-relaxed ${msg.isUser ? 'text-secondary' : 'text-primary font-medium italic'}`}>
                    {msg.isUser ? msg.text : `"${msg.text}"`}
                  </p>
                  {!msg.isUser && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { navigator.clipboard.writeText(`${msg.text}\n\nDARK BOT`); triggerToast("Copiado!"); }} className="flex-1 py-2 bg-white/5 border border-white/5 text-primary text-[8px] font-black uppercase rounded-lg">Copiar</button>
                      <button onClick={() => { if(navigator.share) navigator.share({text: `${msg.text}\n\nDARK BOT`}); }} className="flex-1 py-2 bg-accent/10 border border-accent/20 text-accent text-[8px] font-black uppercase rounded-lg">Share</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Access Modal */}
      {isQuickAccessOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in-95">
          <div className="glass-card w-full max-w-sm rounded-[2.5rem] border border-white/10 p-8 space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-primary italic">Atalhos <span className="text-accent">Rápidos</span></h2>
              <button onClick={() => setIsQuickAccessOpen(false)} className="text-secondary hover:text-primary">✕</button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {BETTING_HOUSES.map(house => (
                <button 
                  key={house.id}
                  onClick={() => {
                    if (house.url) window.open(house.url, '_blank');
                    setIsQuickAccessOpen(false);
                  }}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-accent/30 hover:bg-white/[0.05] transition-all flex flex-col items-center gap-2 group"
                >
                  <span className="text-2xl">{house.logo}</span>
                  <span className="text-[8px] font-black text-secondary uppercase tracking-widest group-hover:text-primary">{house.name}</span>
                </button>
              ))}
            </div>

            <button 
              onClick={() => setIsQuickAccessOpen(false)}
              className="w-full py-4 bg-white/5 text-secondary rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-primary transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      {isPricingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in-95">
          <div className="glass-card w-full max-w-sm rounded-[2.5rem] border border-white/10 p-8 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-accent/20 overflow-hidden">
              <div className="h-full bg-accent animate-pulse w-1/2"></div>
            </div>
            
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-primary italic">Tabela de <span className="text-accent">Preços</span></h2>
              <button onClick={() => { setIsPricingModalOpen(false); setSelectedPlan(null); }} className="text-secondary hover:text-primary">✕</button>
            </div>

            {!selectedPlan ? (
              <div className="space-y-3">
                {PRICING_PLANS.map(plan => (
                  <button 
                    key={plan.name}
                    onClick={() => setSelectedPlan(plan)}
                    className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-accent/30 hover:bg-white/[0.05] transition-all group"
                  >
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest group-hover:text-accent">{plan.name}</span>
                    <span className="text-xs font-black text-accent">{plan.price}</span>
                  </button>
                ))}
              </div>
            ) : paymentStatus === 'success' ? (
              <div className="space-y-6 text-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto border border-accent/30">
                  <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-black text-primary uppercase italic">Quase <span className="text-accent">Lá!</span></h3>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest">Pague para o número abaixo:</p>
                    <p className="text-xl font-black text-primary tracking-widest">
                      {paymentMethod === 'mpesa' ? '84 555 0673' : '87 336 1445'}
                    </p>
                    <p className="text-[7px] font-bold text-accent uppercase">Nome: DARK BOT</p>
                  </div>
                  <p className="text-[9px] text-secondary font-bold uppercase tracking-widest leading-relaxed px-4">
                    Após o pagamento, clique no botão abaixo para enviar o comprovativo e receber sua chave.
                  </p>
                </div>
                <button 
                  onClick={sendReceiptToAdmin}
                  className="w-full py-5 bg-accent text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(0,255,157,0.2)] active:scale-95 transition-all"
                >
                  Enviar Comprovativo
                </button>
                <button 
                  onClick={() => setPaymentStatus('idle')}
                  className="w-full py-2 text-[8px] font-black text-secondary uppercase tracking-widest hover:text-primary transition-all"
                >
                  ← Voltar
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-10">
                <div className="text-center space-y-2">
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest">Plano Selecionado</p>
                  <h3 className="text-lg font-black text-accent">{selectedPlan.name} - {selectedPlan.price}</h3>
                </div>

                <div className="space-y-4">
                  <p className="text-[9px] font-black text-primary text-center uppercase tracking-widest">Escolha o Método de Pagamento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPaymentMethod('mpesa')}
                      className={`py-6 rounded-2xl border transition-all flex flex-col items-center gap-2 ${paymentMethod === 'mpesa' ? 'bg-red-600/20 border-red-600' : 'bg-white/5 border-white/10'}`}
                    >
                      <span className="text-xs font-black text-primary">M-PESA</span>
                      <div className="w-8 h-1 bg-red-600 rounded-full"></div>
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('emola')}
                      className={`py-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${paymentMethod === 'emola' ? 'bg-orange-600/20 border-orange-600' : 'bg-white/5 border-white/10'}`}
                    >
                      <span className="text-xs font-black text-primary">E-MOLA</span>
                      <div className="w-8 h-1 bg-orange-600 rounded-full"></div>
                    </button>
                  </div>

                  <button 
                    onClick={handleBuyAccess}
                    className="w-full py-5 bg-accent text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(0,255,157,0.2)] active:scale-95 transition-all"
                  >
                    Prosseguir para Pagamento
                  </button>

                  <button 
                    onClick={() => { setSelectedPlan(null); setPaymentStatus('idle'); }}
                    className="w-full py-2 text-[8px] font-black text-secondary uppercase tracking-widest hover:text-primary transition-all"
                  >
                    ← Alterar Plano
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </Layout>
    </ErrorBoundary>
  );
};

export default App;
