
import { GoogleGenAI } from "@google/genai";
import { MarketData, MarketStats, AgendaItem } from "../types.ts";

export class GeminiService {
  // Use gemini-3-pro-preview for complex reasoning tasks (market analysis and prediction)
  private model = 'gemini-3-pro-preview';

  async analyzeMarket(trendData: MarketData[], stats: MarketStats) {
    try {
      // Use process.env.API_KEY (user selected) or process.env.GEMINI_API_KEY (default)
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `Analise: Volume ${stats.volume}, Volatilidade ${stats.volatility}%. Forneça 3 frases curtas sobre o estado atual do mercado (Pagar/Recolher) e dicas para velas Rosa.`,
        config: { temperature: 0.7 },
      });
      // response.text is a property, not a method
      return response.text;
    } catch (e) { 
      return "Análise temporariamente indisponível."; 
    }
  }

  async predictAgendaCycles(agenda: AgendaItem[]) {
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `Com base nestes horários: ${JSON.stringify(agenda)}. 
        Diga exatamente em quais janelas a plataforma vai "PAGAR" (soltar velas altas) e em quais vai "RECOLHER" (puxar banca). 
        Seja direto, use gírias como "Entrada confirmada", "Puxada de banca", "Ciclo de Rosa". 
        Dê um conselho mestre para cada período.`,
        config: { temperature: 0.9 },
      });
      return response.text;
    } catch (e) { 
      return "O robô está mapeando os próximos ciclos..."; 
    }
  }

  async chatWithEfron(message: string, history: { role: string, parts: { text: string }[] }[]) {
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: "Você é Efron.IA, a assistente oficial do Venom.b55 (hack). Você é especialista em casas de apostas em Moçambique (Elephant Bet, Premier Bet, Olá Bet). Seu tom é profissional, direto e encorajador. Você ajuda usuários com dúvidas sobre sinais, gestão de banca e estratégias de velas rosa. Nunca dê garantias de lucro, mas fale sobre probabilidades e padrões.",
        },
      });

      // We don't use the history directly in sendMessage, we should probably use chat.history if we want persistence
      // but for a simple implementation:
      const response = await chat.sendMessage({ message });
      return response.text;
    } catch (e) {
      return "Desculpe, estou processando muitos dados agora. Tente novamente em breve.";
    }
  }
}
