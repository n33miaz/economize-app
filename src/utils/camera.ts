import { Platform } from "react-native";

/**
 * A câmera do aparelho, vista pelo carrinho de compras.
 *
 * <p>No celular nativo a câmera existe, ponto. No navegador não dá para
 * saber sem perguntar: no iPhone Safari (o alvo declarado do dono) há uma, e
 * o `<input capture>` do picker a abre direto; num desktop sem webcam o
 * mesmo botão abriria um seletor de arquivo — e um botão "Foto do preço" que
 * abre "Escolher arquivo" é promessa quebrada. Por isso na web o botão só
 * aparece depois de a resposta chegar.
 */
export async function detectCamera(): Promise<boolean> {
  if (Platform.OS !== "web") return true;
  const navegador = (globalThis as { navigator?: Navigator }).navigator;
  const dispositivos = navegador?.mediaDevices;
  if (!dispositivos || typeof dispositivos.enumerateDevices !== "function") {
    return false;
  }
  try {
    const lista = await dispositivos.enumerateDevices();
    // Sem permissão o navegador esconde os rótulos, mas o `kind` continua lá
    return lista.some((d) => d.kind === "videoinput");
  } catch {
    return false;
  }
}

/** Lado maior da foto guardada no navegador; a etiqueta continua legível. */
export const WEB_PHOTO_MAX_SIDE = 640;

/** Compressão JPEG da foto guardada no navegador. */
export const WEB_PHOTO_QUALITY = 0.6;

/**
 * Encolhe a foto ANTES de guardá-la — só na web.
 *
 * <p>No navegador o picker devolve a foto inteira como data-URI: uma foto de
 * 12 MP são vários megabytes em base64, e o carrinho vive no `localStorage`,
 * que cabe uns 5 MB inteiros. Quarenta itens com foto estourariam a cota na
 * metade do mercado, e o app perderia o carrinho — o oposto do que ele
 * existe para fazer. A 640 px e JPEG 0,6 uma etiqueta de preço fica em
 * ~40 KB, e continua legível.
 *
 * <p>No nativo o `photoRef` é um caminho de arquivo, não a foto, e nada
 * precisa encolher. Qualquer tropeço devolve a URI original: foto grande é
 * melhor que foto nenhuma.
 */
export async function shrinkImageForWeb(uri: string): Promise<string> {
  if (Platform.OS !== "web") return uri;
  if (!uri.startsWith("data:") && !uri.startsWith("blob:")) return uri;
  const documento = (globalThis as { document?: Document }).document;
  const ImagemDom = (globalThis as { Image?: typeof Image }).Image;
  if (!documento || !ImagemDom) return uri;
  try {
    const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new ImagemDom();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("imagem ilegível"));
      el.src = uri;
    });
    const maior = Math.max(imagem.naturalWidth, imagem.naturalHeight);
    const escala = maior > WEB_PHOTO_MAX_SIDE ? WEB_PHOTO_MAX_SIDE / maior : 1;
    const canvas = documento.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const contexto = canvas.getContext("2d");
    if (!contexto) return uri;
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", WEB_PHOTO_QUALITY);
  } catch {
    return uri;
  }
}
