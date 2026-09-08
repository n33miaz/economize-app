# Política de segurança

## Como reportar

Use o **relatório privado de vulnerabilidade** do GitHub (aba *Security* →
*Report a vulnerability*). Ele abre um canal privado com quem mantém o
repositório — nada fica público enquanto a correção não sai.

Não abra issue pública para falha de segurança: a issue é indexada no instante
em que você clica em enviar.

## O que este repositório já verifica sozinho

| Verificação | Quando roda | O que ela responde |
| --- | --- | --- |
| `gitleaks` | todo push e PR, e semanalmente | entrou segredo no histórico? |
| `dependency-review` | todo PR | a dependência que está ENTRANDO tem CVE? |
| `npm audit --omit=dev` | todo push e PR, e semanalmente | o que vai para o aparelho tem CVE? |
| CodeQL (`security-extended`) | todo push e PR, e semanalmente | o código tem padrão inseguro? |

O `npm audit` roda com `--omit=dev` de propósito: CVE em ferramenta de build
não chega ao aparelho de ninguém, e barrar a esteira por causa dela treina o
time a ignorar o alerta. O relatório completo sai no passo seguinte, sem
barrar.

## O que é público por construção neste app

Tudo que começa com `EXPO_PUBLIC_` é **embutido no bundle** — no site e no APK.
Qualquer pessoa consegue ler. Hoje é só a URL da API, que é pública mesmo.

Nunca coloque chave de terceiro, token ou segredo atrás desse prefixo: o
mecanismo não protege nada, ele só decide o que entra no arquivo que todo mundo
baixa. Segredo mora no servidor.

## Sessão no aparelho

O token fica no armazenamento seguro do sistema e é apagado no logout, junto
com todo cache que carregue dado pessoal — posições de investimento, plano,
notícias buscadas com aquele token. "Apagar dados locais" passa pelo mesmo
ponto.
