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

/**
 * Id único de mensagem.
 *
 * <p>Era `Date.now()` para a pergunta e `Date.now() + 1` para a resposta — e
 * os dois COLIDEM: a resposta enviada no instante T nasce com o id T+1, e a
 * pergunta seguinte digitada no milissegundo T+1 nasce com o mesmo. Duas
 * mensagens com o mesmo id quebram a chave da lista e fazem `retryMessage`
 * reenviar a mensagem errada. O contador cresce sempre, dentro da sessão.
 */
let nextMessageId = 0;
const newMessageId = () => `msg-${Date.now()}-${(nextMessageId += 1)}`;

/**
 * Quantas falas anteriores viajam junto da pergunta.
 *
 * <p>Sem isto o Nino não tinha memória NENHUMA: "e no mês passado?" chegava ao
 * servidor como uma primeira pergunta solta, e a resposta era necessariamente
 * sobre nada. Doze é o teto que o servidor aceita, e é uma escolha de custo —
 * cada fala vira token pago no provedor, e conversa antiga demais só ancora o
 * modelo em números que já mudaram (os dados vêm do banco a cada chamada).
 *
 * <p>O par ida-e-volta conta como duas: doze são seis trocas.
 */
const MAX_HISTORY_TURNS = 12;

/**
 * As falas anteriores no formato do servidor: da mais ANTIGA para a mais
 * recente. A lista em memória está ao contrário (a mais nova primeiro, que é a
 * ordem em que a tela desenha), e mandar assim faria o modelo ler a conversa
 * de trás para a frente.
 */
export function historyFor(messages: ChatMessage[]): {
  role: "user" | "assistant";
  content: string;
}[] {
  return messages
    // a saudação não é conversa, e mensagem que falhou nunca chegou ao modelo
    .filter((msg) => msg.id !== WELCOME_MESSAGE.id && !msg.isError)
    .slice(0, MAX_HISTORY_TURNS)
    .reverse()
    .map((msg) => ({
      role: msg.isUser ? ("user" as const) : ("assistant" as const),
      content: msg.text,
    }));
}

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
          // A conversa até aqui SEM a pergunta que está sendo enviada — ela vai
          // no `message`, e repetida no histórico o modelo a leria duas vezes
          const history = historyFor(
            get().messages.filter((msg) => msg.id !== userMsgId),
          );
          const response = await api.post<{ reply: string }>("/chat", {
            message: text,
            history,
          });

          const botMessage: ChatMessage = {
            id: newMessageId(),
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
          const userMsgId = newMessageId();
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
