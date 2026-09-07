import React from "react";
import Svg, { Path, Rect } from "react-native-svg";

/**
 * Glifos próprios do trio primário — Finanças (carteira), Início (casa) e
 * Mercado (velas). Barra inferior e trilho lateral usam os mesmos três.
 *
 * Existem porque o `fill` do lucide não foi desenhado para ser preenchido: na
 * carteira e no candlestick a silhueta cheia fecha as áreas internas e vira
 * mancha — o bolso, a aba e os pavios somem. Aqui cada glifo tem DUAS
 * variantes projetadas como par: o contorno (traço 1.75, cantos redondos,
 * mesma caixa óptica do lucide 24×24, ~2 a ~22 de extensão) e a silhueta
 * cheia, que preserva os detalhes como RECORTES no próprio contorno — o bolso
 * da carteira entra pela borda direita, a porta da casa sobe da base. O
 * recorte fica vazado: mostra o que houver atrás (a barra, a pílula do
 * trilho), sem depender de uma "cor de fundo" que teria que acertar em cada
 * superfície.
 *
 * As duas variantes casam geometricamente ponto a ponto: a cheia é o mesmo
 * caminho com `fill` E `stroke`, então a silhueta cresce meio traço para fora
 * — exatamente até a borda externa do contorno — e cada recorte é desenhado
 * meio traço MAIOR do que o detalhe que substitui, para o traço que entra nele
 * devolver o tamanho visual do detalhe. É isso que deixa o preenchimento
 * "subir" por cima do contorno sem que nada mude de lugar ou de tamanho.
 */
export interface TabGlyphProps {
  size: number;
  color: string;
  /** Silhueta cheia com os recortes internos vazados; padrão é o contorno. */
  filled?: boolean;
  /**
   * Pinta os recortes da variante cheia com uma cor, em vez de deixá-los
   * vazados. Só faz sentido quando o glifo está sobre um fundo que não deve
   * aparecer no recorte (uma imagem, um gradiente); na barra e no trilho os
   * recortes ficam vazados de propósito.
   */
  accent?: string;
}

export type TabGlyph = React.ComponentType<TabGlyphProps>;

const STROKE = 1.75;

// Traço partilhado pelas duas variantes; a cheia acrescenta `fill` por cima
const strokeProps = (color: string) =>
  ({
    stroke: color,
    strokeWidth: STROKE,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  }) as const;

/**
 * Geometria em unidades da caixa 24×24. Cada recorte da silhueta é 0.875
 * (meio traço) maior do que o detalhe do contorno correspondente — ver o
 * comentário do arquivo.
 */
export const GEOMETRY = {
  wallet: {
    // Aba: continua a lateral esquerda (x=3) e fecha em x=17.5, um degrau
    // antes da borda direita do corpo — é o degrau que diz "carteira"
    flap: "M3 7V5.75A2.25 2.25 0 0 1 5.25 3.5h10.5A1.75 1.75 0 0 1 17.5 5.25V7",
    // Corpo: 3→21 × 7→20.5, cantos 2.5; o canto superior esquerdo é reto
    // porque a aba nasce dele
    body: "M3 7h15.5A2.5 2.5 0 0 1 21 9.5V18a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18Z",
    // Bolso: meia-cápsula aberta para a borda direita, centro (17, 13.75)
    pocket: "M21 11.25h-4a2.5 2.5 0 0 0 0 5h4",
    // Botão do bolso: traço mínimo com pontas redondas vira um ponto de ~1.9
    button: "M16.9 13.75h.2",
    // Silhueta: aba + corpo num só contorno, com o bolso recortado pela
    // direita (raio 3.375 = 2.5 do contorno + meio traço)
    silhouette:
      "M3 18V5.75A2.25 2.25 0 0 1 5.25 3.5h10.5A1.75 1.75 0 0 1 17.5 5.25V7h1A2.5 2.5 0 0 1 21 9.5v.875H17a3.375 3.375 0 0 0 0 6.75h4V18a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18Z",
    // Interior visual do bolso — só para o `accent`
    cutout: "M22 11.25h-5a2.5 2.5 0 0 0 0 5h5Z",
  },
  home: {
    // Paredes 3→21, beiral em y≈9.4, cumeeira em y≈2.3; beirais e cumeeira
    // arredondados com raio 1.9 e tangentes contínuas (a inclinação do
    // telhado é 6.1/7.1, ~49° da vertical)
    house:
      "M3 10.3a1.9 1.9 0 0 1 .67-1.45l7.1-6.1a1.9 1.9 0 0 1 2.46 0l7.1 6.1A1.9 1.9 0 0 1 21 10.3v8.45A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75Z",
    // Porta centrada: 9.75→14.25 (4.5 de largura), topo em 13.25, raio 1.25
    door: "M9.75 21v-6.5a1.25 1.25 0 0 1 1.25-1.25h2a1.25 1.25 0 0 1 1.25 1.25V21",
    // Silhueta com a porta recortada da base (8.875→15.125, topo 12.375,
    // raio 2.125 — tudo meio traço além da porta do contorno)
    silhouette:
      "M3 10.3a1.9 1.9 0 0 1 .67-1.45l7.1-6.1a1.9 1.9 0 0 1 2.46 0l7.1 6.1A1.9 1.9 0 0 1 21 10.3v8.45A2.25 2.25 0 0 1 18.75 21h-3.625v-6.5A2.125 2.125 0 0 0 13 12.375h-2A2.125 2.125 0 0 0 8.875 14.5V21H5.25A2.25 2.25 0 0 1 3 18.75Z",
    cutout: "M9.75 22v-7.5a1.25 1.25 0 0 1 1.25-1.25h2a1.25 1.25 0 0 1 1.25 1.25V22Z",
  },
  market: {
    // Eixo em L: desce por x=3 e corre pela base até x=21, canto 2.25
    axis: "M3 3.5v15.25A2.25 2.25 0 0 0 5.25 21H21",
    // Vela da esquerda, mais baixa; a da direita, mais alta — mercado subindo
    lowCandle: { x: 7, y: 11, width: 4, height: 5 },
    lowWicks: "M9 8v3M9 16v2.5",
    highCandle: { x: 15, y: 5.5, width: 4, height: 7 },
    highWicks: "M17 3v2.5M17 12.5v3",
    candleRadius: 1,
  },
} as const;

/** Carteira — Finanças. */
export const WalletGlyph = React.memo(function WalletGlyph({
  size,
  color,
  filled = false,
  accent,
}: TabGlyphProps) {
  const g = GEOMETRY.wallet;
  const stroke = strokeProps(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {filled ? (
        <>
          <Path d={g.silhouette} fill={color} {...stroke} />
          {accent ? <Path d={g.cutout} fill={accent} /> : null}
        </>
      ) : (
        <>
          <Path d={g.flap} fill="none" {...stroke} />
          <Path d={g.body} fill="none" {...stroke} />
          <Path d={g.pocket} fill="none" {...stroke} />
        </>
      )}
      {/* O botão fica nos dois estados: no cheio ele é o que resta do
          detalhe dentro do recorte */}
      <Path d={g.button} fill="none" {...stroke} />
    </Svg>
  );
});

/** Casa — Início. */
export const HomeGlyph = React.memo(function HomeGlyph({
  size,
  color,
  filled = false,
  accent,
}: TabGlyphProps) {
  const g = GEOMETRY.home;
  const stroke = strokeProps(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {filled ? (
        <>
          <Path d={g.silhouette} fill={color} {...stroke} />
          {accent ? <Path d={g.cutout} fill={accent} /> : null}
        </>
      ) : (
        <>
          <Path d={g.house} fill="none" {...stroke} />
          <Path d={g.door} fill="none" {...stroke} />
        </>
      )}
    </Svg>
  );
});

/**
 * Velas — Mercado. Não tem recorte: os corpos enchem e os pavios e o eixo
 * continuam sendo traço, então nada se perde no cheio. O `accent` é aceito
 * pela uniformidade da API e não pinta nada aqui.
 */
export const MarketGlyph = React.memo(function MarketGlyph({
  size,
  color,
  filled = false,
}: TabGlyphProps) {
  const g = GEOMETRY.market;
  const stroke = strokeProps(color);
  const bodyFill = filled ? color : "none";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={g.axis} fill="none" {...stroke} />
      <Path d={g.lowWicks} fill="none" {...stroke} />
      <Rect {...g.lowCandle} rx={g.candleRadius} fill={bodyFill} {...stroke} />
      <Path d={g.highWicks} fill="none" {...stroke} />
      <Rect {...g.highCandle} rx={g.candleRadius} fill={bodyFill} {...stroke} />
    </Svg>
  );
});
