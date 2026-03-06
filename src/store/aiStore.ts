import { create } from "zustand";
import api from "../services/api";

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isError?: boolean;
}

interface AiState {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
}

export const useAiStore = create<AiState>((set, get) => ({
  messages:[
    {
      id: "welcome-msg",
      text: "Olá! Sou seu assistente financeiro inteligente. Posso analisar seus gastos, sugerir investimentos ou resumir as notícias do mercado. Como posso ajudar hoje?",
      isUser: false,
      timestamp: new Date(),
    },
  ],
  isLoading: false,

  sendMessage: async (text: string) => {
    const userMsgId = Date.now().toString();
    const userMessage: ChatMessage = {
      id: userMsgId,
      text,
      isUser: true,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [userMessage, ...state.messages],
      isLoading: true,
    }));

    try {
      const response = await api.post<{ reply: string }>("/chat", { message: text });

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.data.reply,
        isUser: false,
        timestamp: new Date(),
      };

      set((state) => ({
        messages: [botMessage, ...state.messages],
        isLoading: false,
      }));
    } catch (error) {
      console.error("Erro ao consultar IA:", error);
      
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === userMsgId ? { ...msg, isError: true } : msg
        ),
        isLoading: false,
      }));
    }
  },

  clearHistory: () => {
    set({
      messages:[
        {
          id: "welcome-msg",
          text: "Histórico limpo. Como posso ajudar agora?",
          isUser: false,
          timestamp: new Date(),
        },
      ],
    });
  },
}));