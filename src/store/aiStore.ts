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
  sendMessage: (text: string) => Promise<boolean>;
  retryMessage: (id: string) => Promise<boolean>;
  clearHistory: () => void;
}

const trim = (messages: ChatMessage[]) =>
  messages.length > MAX_MESSAGES ? messages.slice(0, MAX_MESSAGES) : messages;

export const useAiStore = create(
  persist<AiState>(
    (set, get) => {
      // Entrega compartilhada entre envio e retry: chama a IA e marca a
      // mensagem do usuário como erro quando falha. Retorna sucesso para a
      // UI decidir o haptic certo (antes vibrava "sucesso" até no erro).
      const deliver = async (userMsgId: string, text: string) => {
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
          return true;
        } catch (error) {
          console.error("Erro ao consultar IA:", error);
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === userMsgId ? { ...msg, isError: true } : msg,
            ),
            isLoading: false,
          }));
          return false;
        }
      };

      return {
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

          return deliver(userMsgId, text);
        },

        retryMessage: async (id: string) => {
          const target = get().messages.find(
            (msg) => msg.id === id && msg.isUser && msg.isError,
          );
          if (!target) return false;

          // Reaproveita a mensagem existente (sem duplicar o balão) e só
          // limpa a marca de erro enquanto a nova tentativa está no ar
          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === id ? { ...msg, isError: false } : msg,
            ),
            isLoading: true,
          }));

          return deliver(id, target.text);
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
      };
    },
    {
      name: "@ai_chat_storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) =>
        ({ messages: state.messages.slice(0, MAX_MESSAGES) }) as AiState,
    },
  ),
);
