import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  isError?: boolean;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-msg",
  text: "Olá! Sou o Nino, seu assistente financeiro. Posso analisar gastos, sugerir investimentos e resumir as notícias do mercado. Como posso ajudar hoje?",
  isUser: false,
  timestamp: Date.now(),
};

const MAX_MESSAGES = 50;

interface AiState {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
}

const trim = (messages: ChatMessage[]) =>
  messages.length > MAX_MESSAGES ? messages.slice(0, MAX_MESSAGES) : messages;

export const useAiStore = create(
  persist<AiState>(
    (set) => ({
      messages: [WELCOME_MESSAGE],
      isLoading: false,

      sendMessage: async (text: string) => {
        const userMsgId = Date.now().toString();
        const userMessage: ChatMessage = {
          id: userMsgId,
          text,
          isUser: true,
          timestamp: Date.now(),
        };

        set((state) => ({
          messages: trim([userMessage, ...state.messages]),
          isLoading: true,
        }));

        try {
          const response = await api.post<{ reply: string }>("/chat", {
            message: text,
          });

          const botMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            text: response.data.reply,
            isUser: false,
            timestamp: Date.now(),
          };

          set((state) => ({
            messages: trim([botMessage, ...state.messages]),
            isLoading: false,
          }));
        } catch (error) {
          console.error("Erro ao consultar IA:", error);
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === userMsgId ? { ...msg, isError: true } : msg,
            ),
            isLoading: false,
          }));
        }
      },

      clearHistory: () => {
        set({
          messages: [
            {
              ...WELCOME_MESSAGE,
              text: "Histórico limpo. Como posso ajudar agora?",
              timestamp: Date.now(),
            },
          ],
        });
      },
    }),
    {
      name: "@ai_chat_storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        ({ messages: state.messages.slice(0, MAX_MESSAGES) }) as AiState,
    },
  ),
);
