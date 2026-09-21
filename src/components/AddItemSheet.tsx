import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Camera from "lucide-react-native/dist/esm/icons/camera";
import Minus from "lucide-react-native/dist/esm/icons/minus";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Trash from "lucide-react-native/dist/esm/icons/trash";
import X from "lucide-react-native/dist/esm/icons/x";

import type { PriceSummary } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import { detectCamera, shrinkImageForWeb } from "../utils/camera";
import * as Haptics from "../utils/haptics";
import { parseAmount } from "../utils/money";
import {
  type ItemInput,
  type ShoppingItem,
  describePriceHint,
  formatQuantity,
  parseQuantity,
} from "../utils/shopping";
import CustomModal from "./CustomModal";

/** Espera depois da última tecla antes de perguntar o preço ao servidor. */
const PRICE_LOOKUP_DEBOUNCE_MS = 400;

interface AddItemSheetProps {
  visible: boolean;
  /** A loja da compra em curso: é o que decide "aqui" na linha de preço. */
  storeName: string;
  /** Item sendo editado; nulo é "novo item". */
  editing: ShoppingItem | null;
  /** Nomes já usados que casam com o que foi digitado. */
  suggestionsFor: (query: string) => string[];
  /** O que o aparelho sabe do preço sem rede. */
  priceSummaryFor: (name: string) => PriceSummary | null;
  /** Pergunta ao servidor; devolve o melhor resumo (ou nulo). */
  lookupPrice: (name: string) => Promise<PriceSummary | null>;
  onSave: (input: ItemInput) => void;
  onDelete?: (item: ShoppingItem) => void;
  onClose: () => void;
}

/**
 * A folha do item — o gesto que se repete quarenta vezes numa compra.
 *
 * <p><b>Salvar em UM toque e já limpar para o próximo.</b> O dono está no
 * corredor com o carrinho numa mão e o celular na outra. Cada item que exige
 * "salvar, fechar, abrir de novo" custa três toques a mais vezes quarenta. A
 * folha fica aberta depois de adicionar, o campo do nome recebe o foco de
 * volta e a vibração confirma que entrou — a pessoa nem precisa olhar.
 *
 * <p><b>Quantidade nasce em 1 e o preço pode ficar vazio.</b> Pegar um item e
 * anotar o preço depois é o fluxo real; obrigar o preço na hora travaria a
 * fila. Sem preço o item entra como "sem preço" e não soma.
 *
 * <p><b>"Da última vez R$ X".</b> Enquanto o nome é digitado, a folha diz
 * quanto o produto custou nas outras compras — do aparelho na hora, e do
 * servidor quando ele responde. É o que responde "está caro?" no corredor.
 */
export default function AddItemSheet({
  visible,
  storeName,
  editing,
  suggestionsFor,
  priceSummaryFor,
  lookupPrice,
  onSave,
  onDelete,
  onClose,
}: AddItemSheetProps) {
  const t = useTheme();
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");
  const [promocao, setPromocao] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dica, setDica] = useState<string | null>(null);
  // Na web começa escondido até a resposta chegar: botão de câmera que abre
  // "escolher arquivo" num desktop sem webcam é promessa quebrada
  const [temCamera, setTemCamera] = useState(Platform.OS !== "web");
  const nomeRef = useRef<TextInput>(null);
  const precoRef = useRef<TextInput>(null);
  // Descarta a resposta de uma consulta velha: quem digitou "arroz" e depois
  // "arroz integral" não pode ver o preço do arroz chegar por último
  const consultaRef = useRef(0);

  useEffect(() => {
    let vivo = true;
    detectCamera().then((tem) => {
      if (vivo) setTemCamera(tem);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Cada abertura recomeça do item (editar) ou em branco (novo): rascunho de
  // um item não pode reaparecer sobre outro
  useEffect(() => {
    if (!visible) return;
    setNome(editing?.name ?? "");
    setQuantidade(editing ? formatQuantity(editing.quantity) : "1");
    setPreco(
      editing && editing.unitPrice > 0
        ? editing.unitPrice.toFixed(2).replace(".", ",")
        : "",
    );
    setPromocao(editing?.promoNote ?? "");
    setFoto(editing?.photoRef ?? null);
    setErro(null);
    setDica(null);
    // Depois da animação da folha: focar antes de ela existir na tela não
    // abre o teclado
    const foco = setTimeout(() => nomeRef.current?.focus(), 350);
    return () => clearTimeout(foco);
  }, [visible, editing]);

  // A linha de preço: o aparelho responde na hora, o servidor quando puder
  useEffect(() => {
    if (!visible) return;
    const alvo = nome.trim();
    if (!alvo) {
      setDica(null);
      return;
    }
    setDica(describePriceHint(priceSummaryFor(alvo), storeName));
    const id = ++consultaRef.current;
    const espera = setTimeout(() => {
      lookupPrice(alvo).then((resumo) => {
        if (consultaRef.current !== id) return;
        setDica(describePriceHint(resumo, storeName));
      });
    }, PRICE_LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(espera);
  }, [nome, visible, storeName, priceSummaryFor, lookupPrice]);

  const sugestoes = visible && !editing ? suggestionsFor(nome) : [];

  const limpar = useCallback(() => {
    setNome("");
    setQuantidade("1");
    setPreco("");
    setPromocao("");
    setFoto(null);
    setErro(null);
    setDica(null);
  }, []);

  const ajustarQuantidade = (delta: number) => {
    const atual = parseQuantity(quantidade) ?? 1;
    const proxima = Math.max(1, Math.round((atual + delta) * 1000) / 1000);
    setQuantidade(formatQuantity(proxima));
    Haptics.selectionAsync();
  };

  const salvar = () => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro("Diga o que você pegou.");
      nomeRef.current?.focus();
      return;
    }
    const qtd = quantidade.trim() ? parseQuantity(quantidade) : 1;
    if (qtd == null) {
      setErro("Quantidade inválida — use um número maior que zero.");
      return;
    }
    const valor = preco.trim() ? parseAmount(preco) : 0;
    if (valor == null || valor < 0) {
      setErro("Preço inválido.");
      precoRef.current?.focus();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      name: nomeLimpo,
      quantity: qtd,
      unitPrice: valor,
      promoNote: promocao.trim() || null,
      photoRef: foto,
      checked: editing?.checked,
    });
    if (editing) {
      onClose();
      return;
    }
    // Novo item: a folha continua aberta, limpa e com o foco no nome — o
    // próximo produto já pode ser digitado
    limpar();
    nomeRef.current?.focus();
  };

  const tirarFoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissao.granted) {
          setErro("Sem permissão para usar a câmera.");
          return;
        }
      }
      // 0,5 já deixa a etiqueta legível e poupa o disco do aparelho
      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.5,
      });
      const uri = resultado.assets?.[0]?.uri;
      if (resultado.canceled || !uri) return;
      setFoto(await shrinkImageForWeb(uri));
      Haptics.selectionAsync();
    } catch {
      setErro("Não consegui abrir a câmera agora.");
    }
  };

  const remover = () => {
    if (!editing || !onDelete) return;
    onDelete(editing);
  };

  const rotuloCampo = {
    color: t.text.tertiary,
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  };

  const campo = {
    color: t.text.primary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: t.border.subtle,
    borderRadius: radius.lg,
    backgroundColor: t.background.elevated,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    minHeight: 48,
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={SHEET_PADDING}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing[3],
          }}
        >
          <Text style={{ flex: 1, color: t.text.primary, ...SHEET_TITLE }}>
            {editing ? "Editar item" : "Novo item"}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={8}
          >
            <X size={20} color={t.text.tertiary} />
          </Pressable>
        </View>

        <Text style={rotuloCampo}>O que você pegou</Text>
        <TextInput
          ref={nomeRef}
          value={nome}
          onChangeText={(texto) => {
            setNome(texto);
            if (erro) setErro(null);
          }}
          accessibilityLabel="Nome do item"
          placeholder="arroz, leite, sabão…"
          placeholderTextColor={t.text.tertiary}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => precoRef.current?.focus()}
          style={{ ...campo, marginTop: spacing[2] }}
        />

        {sugestoes.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[2],
              marginTop: spacing[2],
            }}
          >
            {sugestoes.map((sugestao) => (
              <Pressable
                key={sugestao}
                onPress={() => {
                  setNome(sugestao);
                  Haptics.selectionAsync();
                  precoRef.current?.focus();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${sugestao}`}
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: t.border.subtle,
                  backgroundColor: t.background.elevated,
                }}
              >
                <Text style={{ color: t.text.secondary, fontSize: 12, fontWeight: "700" }}>
                  {sugestao}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {dica ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: t.text.tertiary, fontSize: 12, marginTop: spacing[2] }}
          >
            {dica}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[4] }}>
          <View style={{ flex: 1 }}>
            <Text style={rotuloCampo}>Quantidade</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: spacing[2],
                borderWidth: 1,
                borderColor: t.border.subtle,
                borderRadius: radius.lg,
                backgroundColor: t.background.elevated,
                minHeight: 48,
              }}
            >
              <Pressable
                onPress={() => ajustarQuantidade(-1)}
                accessibilityRole="button"
                accessibilityLabel="Uma unidade a menos"
                hitSlop={6}
                style={{ width: 44, height: 46, alignItems: "center", justifyContent: "center" }}
              >
                <Minus size={18} color={t.text.primary} />
              </Pressable>
              <TextInput
                value={quantidade}
                onChangeText={setQuantidade}
                accessibilityLabel="Quantidade"
                keyboardType="decimal-pad"
                selectTextOnFocus
                textAlign="center"
                style={{
                  flex: 1,
                  // Na web o `<input>` tem largura intrínseca e, sem isto,
                  // não encolhe dentro do flex: a 390 px empurrava o "+"
                  // para fora da caixa, por baixo do campo de preço
                  minWidth: 0,
                  color: t.text.primary,
                  fontSize: 16,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                  paddingVertical: spacing[2],
                }}
              />
              <Pressable
                onPress={() => ajustarQuantidade(1)}
                accessibilityRole="button"
                accessibilityLabel="Uma unidade a mais"
                hitSlop={6}
                style={{ width: 44, height: 46, alignItems: "center", justifyContent: "center" }}
              >
                <Plus size={18} color={t.text.primary} />
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={rotuloCampo}>Preço unitário</Text>
            <TextInput
              ref={precoRef}
              value={preco}
              onChangeText={(texto) => {
                setPreco(texto);
                if (erro) setErro(null);
              }}
              accessibilityLabel="Preço unitário"
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={t.text.tertiary}
              returnKeyType="done"
              onSubmitEditing={salvar}
              style={{
                ...campo,
                marginTop: spacing[2],
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            />
          </View>
        </View>

        <Text style={{ ...rotuloCampo, marginTop: spacing[4] }}>Promoção</Text>
        <TextInput
          value={promocao}
          onChangeText={setPromocao}
          maxLength={200}
          accessibilityLabel="Promoção"
          placeholder="leve 3 pague 2, 20% no app…"
          placeholderTextColor={t.text.tertiary}
          style={{ ...campo, fontSize: 14, marginTop: spacing[2] }}
        />

        {temCamera ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[3],
              marginTop: spacing[4],
            }}
          >
            {foto ? (
              <Image
                source={{ uri: foto }}
                accessibilityLabel="Foto do preço"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.lg,
                  backgroundColor: t.background.elevated,
                }}
              />
            ) : null}
            <Pressable
              onPress={tirarFoto}
              accessibilityRole="button"
              accessibilityLabel={foto ? "Tirar outra foto do preço" : "Foto do preço"}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: t.border.default,
                backgroundColor: t.background.elevated,
              }}
            >
              <Camera size={18} color={t.text.primary} />
              <Text
                style={{
                  color: t.text.primary,
                  fontSize: 14,
                  fontWeight: "700",
                  marginLeft: spacing[2],
                }}
              >
                {foto ? "Tirar outra" : "Foto do preço"}
              </Text>
            </Pressable>
            {foto ? (
              <Pressable
                onPress={() => setFoto(null)}
                accessibilityRole="button"
                accessibilityLabel="Remover a foto"
                hitSlop={8}
                style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} color={t.text.tertiary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {erro ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: t.semantic.danger, fontSize: 12, marginTop: spacing[3] }}
          >
            {erro}
          </Text>
        ) : null}

        <Pressable
          onPress={salvar}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Salvar item" : "Adicionar ao carrinho"}
          style={{
            height: 52,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
            marginTop: spacing[4],
          }}
        >
          <Text style={{ color: t.text.inverse, fontWeight: "700", fontSize: 16 }}>
            {editing ? "Salvar" : "Adicionar"}
          </Text>
        </Pressable>

        {editing && onDelete ? (
          <Pressable
            onPress={remover}
            accessibilityRole="button"
            accessibilityLabel="Remover item do carrinho"
            style={{
              height: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginTop: spacing[2],
            }}
          >
            <Trash size={16} color={t.semantic.danger} />
            <Text
              style={{
                color: t.semantic.danger,
                fontWeight: "700",
                fontSize: 13,
                marginLeft: spacing[2],
              }}
            >
              Remover
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </CustomModal>
  );
}
