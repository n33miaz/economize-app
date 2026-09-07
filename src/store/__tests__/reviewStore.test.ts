import {
  applyReview,
  confirmAllReview,
  getReviewCount,
  getReviewQueue,
} from "../../services/api";
import { REVIEW_APPLY_CHUNK, useReviewStore } from "../reviewStore";

import type { ReviewGroup } from "../../services/api";

jest.mock("../../services/api", () => ({
  applyReview: jest.fn(),
  confirmAllReview: jest.fn(),
  getReviewCount: jest.fn(),
  getReviewQueue: jest.fn(),
}));

const mockApply = applyReview as jest.MockedFunction<typeof applyReview>;
const mockConfirmAll = confirmAllReview as jest.MockedFunction<
  typeof confirmAllReview
>;
const mockCount = getReviewCount as jest.MockedFunction<typeof getReviewCount>;
const mockQueue = getReviewQueue as jest.MockedFunction<typeof getReviewQueue>;

/** Um grupo com `n` transações e ids previsíveis. */
const grupo = (id: string, n = 1, sugestao: string | null = null): ReviewGroup =>
  ({
    normalizedDescription: `norm-${id}`,
    sampleDescription: `Loja ${id}`,
    suggestedCategoryId: sugestao,
    totalAmount: -10 * n,
    transactions: Array.from({ length: n }, (_, i) => ({
      id: `${id}-tx${i}`,
      description: `Loja ${id}`,
      amount: -10,
      reviewStatus: sugestao ? "SUGGESTED" : "UNCATEGORIZED",
    })),
  }) as unknown as ReviewGroup;

const itemDe = (group: ReviewGroup, categoryId: string) => ({
  transactionIds: group.transactions.map((tx) => tx.id),
  categoryId,
});

describe("reviewStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useReviewStore.setState({
      groups: [],
      uploadId: null,
      pendingCount: null,
      applyProgress: null,
      isLoading: false,
      isApplying: false,
      error: null,
    });
  });

  it("carregar a fila já responde a contagem, sem uma segunda chamada", async () => {
    mockQueue.mockResolvedValue([grupo("a", 3), grupo("b", 2)]);

    await useReviewStore.getState().fetchQueue();

    expect(useReviewStore.getState().pendingCount).toBe(5);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it("a Home pede só o número", async () => {
    mockCount.mockResolvedValue(1656);

    await useReviewStore.getState().fetchPendingCount();

    expect(useReviewStore.getState().pendingCount).toBe(1656);
    // O ponto do endpoint: nada de baixar a fila agrupada de 92 KB
    expect(mockQueue).not.toHaveBeenCalled();
  });

  it("número que não vem não vira zero", async () => {
    useReviewStore.setState({ pendingCount: 7 });
    mockCount.mockRejectedValue(new Error("offline"));

    await useReviewStore.getState().fetchPendingCount();

    // "0 pendentes" seria uma afirmação falsa sobre o extrato de alguém
    expect(useReviewStore.getState().pendingCount).toBe(7);
  });

  describe("applyMany", () => {
    it("quebra em levas de 25 em vez de uma requisição gigante", async () => {
      const grupos = Array.from({ length: REVIEW_APPLY_CHUNK + 5 }, (_, i) =>
        grupo(`g${i}`),
      );
      useReviewStore.setState({ groups: grupos });
      mockApply.mockResolvedValue({ confirmed: 1, rulesSaved: 1 } as never);

      const items = grupos.map((g) => itemDe(g, "cat-1"));
      const { confirmed, failedItems } = await useReviewStore
        .getState()
        .applyMany(items);

      expect(mockApply).toHaveBeenCalledTimes(2);
      expect(mockApply.mock.calls[0][0]).toHaveLength(REVIEW_APPLY_CHUNK);
      expect(mockApply.mock.calls[1][0]).toHaveLength(5);
      expect(confirmed).toBe(2);
      expect(failedItems).toHaveLength(0);
      // fila esvaziada: tudo que foi mandado entrou
      expect(useReviewStore.getState().groups).toHaveLength(0);
      expect(useReviewStore.getState().pendingCount).toBe(0);
    });

    it("leva que falha não apaga o que as outras gravaram", async () => {
      const grupos = Array.from({ length: REVIEW_APPLY_CHUNK + 2 }, (_, i) =>
        grupo(`g${i}`),
      );
      useReviewStore.setState({ groups: grupos });
      mockApply.mockResolvedValueOnce({
        confirmed: REVIEW_APPLY_CHUNK,
        rulesSaved: 0,
      } as never);
      mockApply.mockRejectedValueOnce(new Error("timeout"));

      const items = grupos.map((g) => itemDe(g, "cat-1"));
      const { confirmed, failedItems } = await useReviewStore
        .getState()
        .applyMany(items);

      expect(confirmed).toBe(REVIEW_APPLY_CHUNK);
      // Os 2 que falharam voltam nomeados, para a tela mandar de novo
      expect(failedItems).toHaveLength(2);
      // e continuam na fila: só sai da tela o que o servidor confirmou
      const restantes = useReviewStore.getState().groups;
      expect(restantes).toHaveLength(2);
      expect(restantes.map((g) => g.sampleDescription)).toEqual([
        `Loja g${REVIEW_APPLY_CHUNK}`,
        `Loja g${REVIEW_APPLY_CHUNK + 1}`,
      ]);
      expect(useReviewStore.getState().error).toBeTruthy();
    });

    it("termina sem deixar a tela travada em 'salvando'", async () => {
      useReviewStore.setState({ groups: [grupo("a")] });
      mockApply.mockRejectedValue(new Error("offline"));

      await useReviewStore.getState().applyMany([itemDe(grupo("a"), "cat-1")]);

      expect(useReviewStore.getState().isApplying).toBe(false);
      expect(useReviewStore.getState().applyProgress).toBeNull();
    });

    it("lista vazia não gera requisição", async () => {
      const resultado = await useReviewStore.getState().applyMany([]);

      expect(mockApply).not.toHaveBeenCalled();
      expect(resultado).toEqual({ confirmed: 0, failedItems: [] });
    });
  });

  it("aprovar tudo não toca nos grupos sem sugestão", async () => {
    const comSugestao = grupo("a", 2, "cat-9");
    const semSugestao = grupo("b", 1, null);
    useReviewStore.setState({ groups: [comSugestao, semSugestao] });
    mockConfirmAll.mockResolvedValue({ confirmed: 2, rulesSaved: 2 } as never);

    const confirmadas = await useReviewStore.getState().confirmAll();

    expect(confirmadas).toBe(2);
    // O que exige escolha manual FICA — é exatamente o que o "salvar minhas
    // escolhas" existe para gravar
    const restantes = useReviewStore.getState().groups;
    expect(restantes).toHaveLength(1);
    expect(restantes[0].sampleDescription).toBe("Loja b");
    expect(useReviewStore.getState().pendingCount).toBe(1);
  });
});
