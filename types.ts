
export enum CandleType {
  BLUE = 'BLUE',
  PURPLE = 'PURPLE',
  PINK = 'PINK'
}

export enum SignalStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  WIN = 'WIN',
  LOSS = 'LOSS',
  SENT = 'SENT'
}

export type GraphStatus = 'BOM' | 'RAZOAVEL' | 'RUIM';
export type ThemeMode = 'dark' | 'light';

export interface ThemeConfig {
  id: string;
  name: string;
  mode: ThemeMode;
  accentColor: string;
  brightness: number;
  contrast: number;
  isCustom?: boolean;
}

export interface Signal {
  id: string;
  time: string;
  house: string;
  type: CandleType;
  probability: number;
  multiplier: string;
  timestamp: number;
  status?: SignalStatus;
  seedHash?: string;
  confidence?: number;
  gale?: number;
  secondaryMultiplier?: string;
  quantumVerification?: string;
}

export interface SupportMessage {
  id: string;
  text: string;
  timestamp: number;
  isUser?: boolean;
}

export interface AgendaItem {
  id: string;
  house: string;
  logo: string;
  paying: number;
  reclining: number;
  graphStatus: GraphStatus;
  graphAnalysis: string;
  efronInsight: string;
  isAnalyzing: boolean;
  isGraphAnalyzing: boolean;
}

export interface BettingHouse {
  id: string;
  name: string;
  logo: string;
  color: string;
  url?: string;
}

export enum AppScreen {
  HOUSE_SELECTION = 'HOUSE_SELECTION',
  HACK_GENERATOR = 'HACK_GENERATOR',
  HACKER_GERAL = 'HACKER_GERAL',
  MARKET_ANALYSIS = 'MARKET_ANALYSIS',
  AGENDA = 'AGENDA',
  SIGNAL_ROOM = 'SIGNAL_ROOM',
  VIRTUAL_BOT = 'VIRTUAL_BOT',
  SUPPORT = 'SUPPORT',
  SETTINGS = 'SETTINGS'
}

export interface PlatformNotification {
  id: string;
  type: 'info' | 'success' | 'alert' | 'critical';
  message: string;
  timestamp: number;
}

export interface MarketData {
  time: string;
  value: number;
}

export interface MarketStats {
  volume: string;
  volatility: number;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
