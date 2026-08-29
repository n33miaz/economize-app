import React from "react";
import { View } from "react-native";
import ArrowLeftRight from "lucide-react-native/dist/esm/icons/arrow-left-right";
import Banknote from "lucide-react-native/dist/esm/icons/banknote";
import Briefcase from "lucide-react-native/dist/esm/icons/briefcase";
import Car from "lucide-react-native/dist/esm/icons/car";
import CircleEllipsis from "lucide-react-native/dist/esm/icons/circle-ellipsis";
import Coffee from "lucide-react-native/dist/esm/icons/coffee";
import Dumbbell from "lucide-react-native/dist/esm/icons/dumbbell";
import Fuel from "lucide-react-native/dist/esm/icons/fuel";
import Gamepad2 from "lucide-react-native/dist/esm/icons/gamepad-2";
import Gift from "lucide-react-native/dist/esm/icons/gift";
import GraduationCap from "lucide-react-native/dist/esm/icons/graduation-cap";
import HandCoins from "lucide-react-native/dist/esm/icons/hand-coins";
import HeartPulse from "lucide-react-native/dist/esm/icons/heart-pulse";
import House from "lucide-react-native/dist/esm/icons/house";
import Music from "lucide-react-native/dist/esm/icons/music";
import PawPrint from "lucide-react-native/dist/esm/icons/paw-print";
import PiggyBank from "lucide-react-native/dist/esm/icons/piggy-bank";
import Plane from "lucide-react-native/dist/esm/icons/plane";
import PlugZap from "lucide-react-native/dist/esm/icons/plug-zap";
import Shield from "lucide-react-native/dist/esm/icons/shield";
import Shirt from "lucide-react-native/dist/esm/icons/shirt";
import ShoppingBag from "lucide-react-native/dist/esm/icons/shopping-bag";
import Smartphone from "lucide-react-native/dist/esm/icons/smartphone";
import Tag from "lucide-react-native/dist/esm/icons/tag";
import Utensils from "lucide-react-native/dist/esm/icons/utensils";
import Wrench from "lucide-react-native/dist/esm/icons/wrench";
import type { LucideIcon } from "lucide-react-native";

import type { Category } from "../services/api";
import type { AppTheme } from "../theme/colors";
import { radius } from "../theme/ds";

// Registro único nome-do-banco -> componente lucide. O backend guarda só a
// string (ex.: "heart-pulse"); qualquer nome desconhecido cai no Tag genérico.
const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  "gamepad-2": Gamepad2,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  house: House,
  "shopping-bag": ShoppingBag,
  "plug-zap": PlugZap,
  banknote: Banknote,
  "arrow-left-right": ArrowLeftRight,
  "circle-ellipsis": CircleEllipsis,
  tag: Tag,
  plane: Plane,
  "paw-print": PawPrint,
  gift: Gift,
  dumbbell: Dumbbell,
  shirt: Shirt,
  briefcase: Briefcase,
  "piggy-bank": PiggyBank,
  wrench: Wrench,
  smartphone: Smartphone,
  coffee: Coffee,
  "hand-coins": HandCoins,
  fuel: Fuel,
  music: Music,
  shield: Shield,
};

// Opções curadas do seletor de ícone ao criar/editar categoria
export const PICKABLE_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "tag", Icon: Tag },
  { name: "utensils", Icon: Utensils },
  { name: "coffee", Icon: Coffee },
  { name: "car", Icon: Car },
  { name: "fuel", Icon: Fuel },
  { name: "plane", Icon: Plane },
  { name: "house", Icon: House },
  { name: "plug-zap", Icon: PlugZap },
  { name: "smartphone", Icon: Smartphone },
  { name: "shopping-bag", Icon: ShoppingBag },
  { name: "shirt", Icon: Shirt },
  { name: "gift", Icon: Gift },
  { name: "gamepad-2", Icon: Gamepad2 },
  { name: "music", Icon: Music },
  { name: "dumbbell", Icon: Dumbbell },
  { name: "heart-pulse", Icon: HeartPulse },
  { name: "paw-print", Icon: PawPrint },
  { name: "graduation-cap", Icon: GraduationCap },
  { name: "briefcase", Icon: Briefcase },
  { name: "wrench", Icon: Wrench },
  { name: "piggy-bank", Icon: PiggyBank },
  { name: "hand-coins", Icon: HandCoins },
  { name: "banknote", Icon: Banknote },
  { name: "arrow-left-right", Icon: ArrowLeftRight },
];

// Cores que o usuário pode escolher para categorias próprias — recorte da
// paleta categórica validada + semânticas médias, iguais nos dois temas
export const PICKABLE_COLORS = [
  "#BC8508",
  "#8F7BE8",
  "#17A2AA",
  "#E05470",
  "#1F94D6",
  "#10A56D",
  "#D97706",
  "#DB2777",
];

// Índice estável da série categórica por seed do sistema: a mesma categoria
// veste a mesma cor em qualquer tela/tema (regra: cor segue a entidade)
const SYSTEM_KEY_CHART_INDEX: Record<string, number> = {
  FOOD: 3, // rosa
  TRANSPORT: 4, // azul
  LEISURE: 1, // violeta
  HEALTH: 2, // teal
  EDUCATION: 5, // verde
  HOUSING: 0, // dourado
  SHOPPING: 1,
  UTILITIES: 4,
  INVESTMENT: 0, // dourado — dinheiro guardado veste a cor da marca
  PERSONAL_CARE: 2,
  FEES_TAXES: 3,
  INSURANCE: 5,
};

export function resolveCategoryIcon(icon: string | null | undefined): LucideIcon {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  return Tag;
}

/**
 * A cor segue a entidade: uma subcategoria veste a cor do pai, então
 * "Alimentação › Delivery" continua rosa em qualquer tela.
 */
export function resolveCategoryColor(
  category:
    | Pick<Category, "color" | "systemKey" | "parentSystemKey">
    | null
    | undefined,
  theme: AppTheme,
): string {
  if (!category) return theme.chart.neutral;
  if (category.color) return category.color;
  return (
    colorForKey(category.systemKey, theme) ??
    colorForKey(category.parentSystemKey, theme) ??
    theme.chart.neutral
  );
}

function colorForKey(
  key: string | null | undefined,
  theme: AppTheme,
): string | null {
  if (!key) return null;
  if (key === "INCOME") return theme.chart.up;
  if (key === "TRANSFER" || key === "OTHER") return theme.chart.neutral;
  const index = SYSTEM_KEY_CHART_INDEX[key];
  return index !== undefined ? theme.chart.categorical[index] : null;
}

/**
 * Fundo do disco a ~15% da cor (0x26). A cor da categoria pode chegar com alfa
 * (#RRGGBBAA é aceito no cadastro): concatenar direto daria uma string de 11
 * caracteres e o Android estoura com "Unable to parse color", então o alfa que
 * vier é descartado antes.
 */
function discBackground(color: string): string {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(hex)) return `${hex.slice(0, 7)}26`;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}26`;
  // fora do hex de 6/8 dígitos não dá para montar o alfa: fica a cor como veio
  return hex;
}

/**
 * Ícone da categoria dentro do disco suave na cor dela — a unidade visual
 * usada em chips, linhas de transação e na tela de análise.
 */
export default function CategoryIcon({
  category,
  theme,
  size = 36,
}: {
  category:
    | Pick<Category, "color" | "systemKey" | "parentSystemKey" | "icon">
    | null
    | undefined;
  theme: AppTheme;
  size?: number;
}) {
  const Icon = resolveCategoryIcon(category?.icon);
  const color = resolveCategoryColor(category, theme);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: discBackground(color),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={size * 0.5} color={color} />
    </View>
  );
}
