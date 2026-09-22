import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
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
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useDebounce } from "../hooks/useDebounce";
import { detectCamera, shrinkImageForWeb } from "../utils/camera";
import * as Haptics from "../utils/haptics";
import { formatBRL, parseAmount } from "../utils/money";
import {
  ITEM_NAME_MAX,
  type ItemInput,
  type ShoppingItem,
  describePriceHint,
  formatQuantity,
  parseQuantity,
} from "../utils/shopping";
import AmountKeypad from "./AmountKeypad";
import CustomModal from "./CustomModal";

/**
 * Quanto tempo o nome precisa ficar parado antes de a folha pensar nele.
 *
 * <p><b>Isto é o conserto de um defeito, não um afinamento.</b> A compra de
 * 21/09 voltou do mercado com "aabsorvente", "llinguiça", "pimenpimenta
 * calabresa", "mussarmussarela". Todos têm a mesma forma: o começo do que
 * foi digitado, e em seguida a palavra inteira.
 *
 * <p>A causa: cada tecla disparava duas varreduras de TODAS as compras e de
 * TODOS os itens — uma para as sugestões de nome, outra para o histórico de
 * preço. Com 45 itens no carrinho, o render de uma tecla chegava depois da
 * tecla seguinte, e o Android reaplicava o texto antigo por cima do que já
 * estava no campo. O resultado é a palavra escrita duas vezes pela metade.
 *
 * <p>Com o nome atrasado, a tecla só escreve; as contas caras acontecem
 * quando o dedo para. E o campo do nome é memoizado logo abaixo, para que
 * nem elas nem o teclado de números o façam renderizar de novo.
 */
const NAME_SETTLE_MS = 250;

/** Espera depois disso antes de perguntar o preço ao servidor. */
const PRICE_LOOKUP_DEBOUNCE_MS = 200;

/**
 * O campo do nome, isolado do resto da folha.
 *
 * <p>`memo` aqui não é micro-otimização: é o que impede que a linha de
 * preço, as sugestões, o erro ou o teclado de números toquem no campo
 * enquanto ele está sendo digitado. Cada um desses toques é uma chance de o
 * Android reescrever o texto — que é de onde vinham os nomes duplicados.
 */
const CampoDoNome = React.memo(
  React.forwardRef<
    TextInput,
    {
      value: string;
      onChangeText: (texto: string) => void;
      onFocus: () => void;
      onSubmitEditing: () => void;
      style: TextInputProps["style"];
      placeholderTextColor: string;
    }
  >(function CampoDoNome(
    { value, onChangeText, onFocus, onSubmitEditing, style, placeholderTextColor },
    ref,
  ) {
  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel="Nome do item"
      placeholder="arroz, leite, sabão…"
      placeholderTextColor={placeholderTextColor}
      maxLength={ITEM_NAME_MAX}
      autoCapitalize="sentences"
      // Os três juntos desligam a correção do teclado do Android. Enquanto
      // ela existe, o teclado guarda uma palavra "em composição" que ele
      // reescreve sozinho — e era sobre ela que o texto duplicava
      autoCorrect={false}
      autoComplete="off"
      spellCheck={false}
      returnKeyType="next"
      blurOnSubmit={false}
      onFocus={onFocus}
      onSubmitEditing={onSubmitEditing}
      style={style}
    />
  );
  }),
);

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
  /**
   * O carrinho como está agora. Aparece no alto da folha porque, com a folha
   * aberta, a tela de trás some — e a pergunta "quanto já deu?" é a razão de
   * o dono estar com o celular na mão no corredor.
   */
  resumo?: { total: number; itens: number } | null;
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
  resumo,
}: AddItemSheetProps) {
  const t = useTheme();
  const { isWide } = useBreakpoint();
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
  // O teclado de números do app está na tela? Ele substitui o do sistema no
  // campo do preço; no desktop e no tablet largo não aparece, porque lá o
  // teclado é físico e a folha é um diálogo estreito
  const [keypad, setKeypad] = useState(false);
  const tecladoDoApp = Platform.OS !== "web" && !isWide;
  const nomeRef = useRef<TextInput>(null);
  const precoRef = useRef<TextInput>(null);
  const rolagemRef = useRef<ScrollView>(null);
  // Descarta a resposta de uma consulta velha: quem digitou "arroz" e depois
  // "arroz integral" não pode ver o preço do arroz chegar por último
  const consultaRef = useRef(0);
  // O nome como as contas caras o enxergam: sempre um passo atrás do dedo
  const nomeParado = useDebounce(nome.trim(), NAME_SETTLE_MS);

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
    setKeypad(false);
    // Depois da animação da folha: focar antes de ela existir na tela não
    // abre o teclado
    const foco = setTimeout(() => nomeRef.current?.focus(), 350);
    return () => clearTimeout(foco);
  }, [visible, editing]);

  // A linha de preço: o aparelho responde quando o dedo para, o servidor
  // logo depois. Nenhum dos dois acontece durante a digitação
  useEffect(() => {
    if (!visible) return;
    if (!nomeParado) {
      setDica(null);
      return;
    }
    setDica(describePriceHint(priceSummaryFor(nomeParado), storeName));
    const id = ++consultaRef.current;
    const espera = setTimeout(() => {
      lookupPrice(nomeParado).then((resumo) => {
        if (consultaRef.current !== id) return;
        setDica(describePriceHint(resumo, storeName));
      });
    }, PRICE_LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(espera);
  }, [nomeParado, visible, storeName, priceSummaryFor, lookupPrice]);

  const sugestoes = useMemo(
    () => (visible && !editing ? suggestionsFor(nomeParado) : []),
    [visible, editing, suggestionsFor, nomeParado],
  );

  // Sem `erro` na lista de dependências: o updater funcional já sabe o que
  // havia, e uma dependência a mais aqui recriaria o callback e derrubaria a
  // memoização do campo a cada erro mostrado
  const digitarNome = useCallback((texto: string) => {
    setNome(texto);
    setErro((atual) => (atual ? null : atual));
  }, []);

  const limpar = useCallback(() => {
    setNome("");
    setQuantidade("1");
    setPreco("");
    setPromocao("");
    setFoto(null);
    setErro(null);
    setDica(null);
  }, []);

  /**
   * Ir do nome para o preço.
   *
   * <p>Com o teclado do app, o dedo NÃO vai para o campo: vai para as
   * teclas. Dar foco ao campo aqui seria pedir ao Android que decidisse de
   * novo se abre o teclado do sistema — e era essa decisão, quarenta vezes
   * por compra, que fazia a folha piscar.
   */
  const irParaOPreco = useCallback(() => {
    if (!tecladoDoApp) {
      precoRef.current?.focus();
      return;
    }
    setKeypad(true);
    Keyboard.dismiss();
  }, [tecladoDoApp]);

  /** Qualquer campo de LETRAS recolhe o teclado de números. */
  const voltarAoTecladoDoSistema = useCallback(() => setKeypad(false), []);

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
    // próximo produto já pode ser digitado. A rolagem volta ao topo sem
    // animação: depois de quarenta itens, a folha rolada no meio fazia o
    // campo do nome "sumir" mesmo com o foco nele
    limpar();
    setKeypad(false);
    rolagemRef.current?.scrollTo({ y: 0, animated: false });
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

  const campo = useMemo(
    () => ({
      color: t.text.primary,
      fontSize: 16,
      borderWidth: 1,
      borderColor: t.border.subtle,
      borderRadius: radius.lg,
      backgroundColor: t.background.elevated,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      minHeight: 48,
    }),
    [t],
  );

  // O estilo do campo do nome não pode ser um objeto novo a cada render: ele
  // é uma prop, e uma prop nova por tecla desfaz a memoização que existe
  // justamente para o campo não ser tocado enquanto se digita
  const estiloDoNome = useMemo(
    () => ({ ...campo, marginTop: spacing[2] }),
    [campo],
  );

  const acaoLabel = editing ? "Salvar item" : "Adicionar ao carrinho";

  // A folha é rolagem EM CIMA e rodapé fixo EMBAIXO. Antes o botão de
  // adicionar era o último filho da rolagem e, com o teclado aberto, ficava
  // abaixo da dobra: o dono digitava o item e não tinha onde tocar. Agora
  // ele nunca sai da tela.
  return (
    <CustomModal visible={visible} onClose={onClose}>
      <View style={{ flexShrink: 1 }}>
      <ScrollView
        ref={rolagemRef}
        style={{ flexShrink: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ ...SHEET_PADDING, paddingBottom: spacing[4] }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing[3],
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text.primary, ...SHEET_TITLE }}>
              {editing ? "Editar item" : "Novo item"}
            </Text>
            {resumo && resumo.itens > 0 ? (
              <Text
                style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}
              >
                No carrinho: {formatBRL(resumo.total)} · {resumo.itens}{" "}
                {resumo.itens === 1 ? "item" : "itens"}
              </Text>
            ) : null}
          </View>
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
        <CampoDoNome
          ref={nomeRef}
          value={nome}
          onChangeText={digitarNome}
          onFocus={voltarAoTecladoDoSistema}
          onSubmitEditing={irParaOPreco}
          placeholderTextColor={t.text.tertiary}
          style={estiloDoNome}
        />

        {/* Altura fixa de propósito. As sugestões aparecem na segunda letra
          e a linha de preço na terceira; cada uma delas empurrava o campo do
          preço uns 40 px para baixo NO MEIO da digitação, e o dedo caía na
          quantidade. O espaço fica reservado, esteja vazio ou não. */}
        <View style={{ minHeight: 40, justifyContent: "center" }}>
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
                  // Fechar o teclado ANTES de trocar o texto. Sem isto o
                  // Android grudava a sugestão no que já estava escrito —
                  // foi assim que nasceu "Zona Rural AtacdAtacadista"
                  Keyboard.dismiss();
                  setNome(sugestao);
                  Haptics.selectionAsync();
                  irParaOPreco();
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
        </View>

        <View style={{ minHeight: 18, justifyContent: "center" }}>
          {dica ? (
            <Text
              accessibilityLiveRegion="polite"
              numberOfLines={1}
              style={{ color: t.text.tertiary, fontSize: 12 }}
            >
              {dica}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[3] }}>
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
                onFocus={voltarAoTecladoDoSistema}
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
              // Com o teclado do app, o do sistema não abre: era ele que
              // remontava a folha a cada troca de campo
              showSoftInputOnFocus={!tecladoDoApp}
              onFocus={() => {
                if (!tecladoDoApp) return;
                setKeypad(true);
                Keyboard.dismiss();
              }}
              placeholder="0,00"
              placeholderTextColor={t.text.tertiary}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={salvar}
              style={{
                ...campo,
                marginTop: spacing[2],
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                // O campo que o teclado de números está escrevendo fica
                // marcado: sem isso não dá para saber onde o "7" vai cair
                borderColor: keypad ? t.accent.neon : t.border.subtle,
                borderWidth: keypad ? 1.5 : 1,
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
          onFocus={voltarAoTecladoDoSistema}
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

      </ScrollView>

      {/* O rodapé. Fora da rolagem de propósito: o que encerra o item nunca
        pode depender de rolar a folha. */}
      {erro ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: t.semantic.danger,
            fontSize: 12,
            paddingHorizontal: spacing[5],
            paddingTop: spacing[2],
          }}
        >
          {erro}
        </Text>
      ) : null}

      {keypad ? (
        <AmountKeypad
          value={preco}
          onChange={(proximo) => {
            setPreco(proximo);
            if (erro) setErro(null);
          }}
          actionLabel={acaoLabel}
          onAction={salvar}
          onDismiss={() => setKeypad(false)}
          hint={dica}
        />
      ) : (
        <View
          style={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[3],
            paddingBottom: spacing[2],
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
          }}
        >
          <Pressable
            onPress={salvar}
            accessibilityRole="button"
            accessibilityLabel={acaoLabel}
            style={{
              height: 52,
              borderRadius: radius.xl,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neon,
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
                marginTop: spacing[1],
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
        </View>
      )}
      </View>
    </CustomModal>
  );
}
