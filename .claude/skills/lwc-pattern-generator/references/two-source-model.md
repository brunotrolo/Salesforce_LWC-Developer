# As duas fontes: spec (o QUE) e padrao da jornada (o COMO)

Esta skill nao inventa requisito nem convencao. Ela **combina duas fontes**, cada uma com
uma autoridade propria e bem delimitada:

| | **Spec** (`.lwc-spec-writer/specs/<slug>-spec.md`) | **Padrao da jornada** (`.lwc-pattern-documenter/.../journeys/<slug>.json`) |
|---|---|---|
| Escrita por | `lwc-spec-writer` (Skill 2) | `lwc-pattern-documenter` (Skill 1) |
| Papel | **Spec-driven design** — o QUE construir | **Guia de system design** — COMO se constroi nesta org |
| Responde | requisito, escopo, nao-objetivos, contrato de dados, contrato publico congelado, criterio de aceite | estrutura/skeleton, naming, vocabulario SLDS, contrato `@api` idiomatico, eventos, forma de chamar Apex, loading/erro, i18n, a11y |
| Granularidade | **1 arquivo por componente** | **1 snapshot por jornada** (varios componentes) |
| Lido por | `spec-reader.mjs` | `pattern-reader.mjs` |
| Se faltar | cai na coleta inline (etapa 3) — ou sugere rodar a Skill 2 | **PARA** — nunca gera sem jornada confirmada |

Frase-resumo: **a spec diz o que este componente precisa fazer; o padrao diz como um
componente desta org se parece.** Uma nao substitui a outra — gerar so com o padrao
produz um componente bonito que nao atende o requisito; gerar so com a spec produz um
componente correto que destoa de todos os outros.

## Ordem de precedencia (quando as fontes se cruzam)

Da mais forte para a mais fraca. **Nada aqui autoriza decidir sozinho** — a regra 5 e o
caminho padrao quando ha duvida.

1. **Contrato publico congelado da spec** (secao 3, tipo "Melhoria pontual") — **trava
   dura**. Um `@api`/evento listado ali NAO pode mudar, nem para ficar mais aderente ao
   padrao da jornada. Quebrar isso quebra consumidores reais (outro LWC, um Flow, uma
   pagina do App Builder) que a deteccao de regressao desta skill **nao consegue
   enxergar** — ela so conhece o que esta documentado na jornada.
2. **Nao-objetivos da spec** (secao 2) — **fronteira dura de escopo**. Item listado ali
   nao entra na implementacao, mesmo que pareca uma melhoria obvia ou que o padrao da
   jornada sugira. Casa com a regra "nunca amplia o escopo" do `SKILL.md`.
3. **Requisito funcional da spec** (secoes 1, 4–10) — o QUE construir. O padrao nunca
   sobrepoe um requisito explicito: se a spec pede um campo, ele existe, mesmo que
   nenhum componente da jornada tenha algo parecido.
4. **Padrao da jornada** — a FORMA de tudo que a spec nao amarrou: estrutura, naming,
   classes SLDS, forma de chamada Apex, loading/erro, i18n. Este e o territorio natural
   do padrao, e a spec normalmente nao fala disso.
5. **Conflito real entre 3 e 4 → PERGUNTE.** Ex.: a spec pede `@api customerId` mas a
   jornada usa `recordId` para o mesmo conceito. Apresente as duas opcoes com a origem
   de cada uma e deixe o usuario decidir (ver `references/conflict-resolution.md`).
   **Nunca escolha silenciosamente**, nem "pela maioria".

## Pendencias da spec (`🚧 PENDENTE`) — trava, nao sugestao

A Skill 2 marca `🚧 PENDENTE` quando o usuario nao soube responder um campo. O
`spec-reader.mjs` devolve todas em `pendencias[]`.

**Regra:** se uma pendencia afeta o que voce esta prestes a gerar, **PARE e pergunte**.
Nunca preencha uma pendencia com uma suposicao plausivel nem com "o que o padrao da
jornada faria" — o campo esta pendente justamente porque ninguem decidiu ainda, e tratar
suposicao como requisito confirmado e a falha mais cara possivel aqui.

Pendencia que **nao** afeta o trecho atual (ex.: um detalhe da secao de testes enquanto
voce so esta montando o markup) nao precisa bloquear — mencione no preview final.

## Como ler as duas fontes

```bash
# 1) A spec deste componente (o QUE):
node .claude/skills/lwc-pattern-generator/scripts/spec-reader.mjs \
  --component consorcioListaCotas

# Sem saber o nome ainda? liste o que existe:
node .claude/skills/lwc-pattern-generator/scripts/spec-reader.mjs --list

# Nome canonico do arquivo de spec (usado pela Skill 2 ANTES de gravar):
node .claude/skills/lwc-pattern-generator/scripts/spec-reader.mjs --slug-for <componente>

# 2) O padrao da jornada (o COMO):
node .claude/skills/lwc-pattern-generator/scripts/pattern-reader.mjs \
  --journey "Consorcio"
```

O `spec-reader.mjs` devolve:

| Campo | Para que serve |
|---|---|
| `header.tipo` / `mode` | **Deriva o modo de operacao** (`criar`/`clonar`/`editar`) — etapa 1 do guia |
| `header.jornada` | A jornada de referencia — etapa 2 (nao precisa perguntar de novo) |
| `header.componente` | O alvo (path ou "a criar") — etapa 4 |
| `header.componenteFonte` | So no tipo Clonar — o componente-fonte |
| `header.status` | `Rascunho` → confirme se ja pode guiar a implementacao |
| `frozenContract[]` | **Precedencia 1** — o que nao pode mudar |
| `nonObjectives[]` | **Precedencia 2** — o que nao entra no escopo |
| `pendencias[]` | Trava — pergunte antes de gerar o que depende delas |
| `warnings[]` | Avisos ja formulados (rascunho, sem jornada, sem contrato congelado...) |
| `sections[]` | Que secoes a spec tem — o resto voce le direto do arquivo |

O script devolve o **cabecalho estruturado e as listas criticas**; o corpo das secoes
(contrato de dados, prototipo, estados, eventos) voce le direto do Markdown — e prosa
para o agente interpretar, nao dado para maquina.

## Divergencia entre a spec e a realidade

- **Spec diz tipo "Melhoria pontual" mas o componente nao existe no disco** (ou
  vice-versa) → **pare e pergunte**. Nunca troque de modo por conta propria: o modo
  decide o comportamento do guard (`allow` vs `ask`).
- **Spec aponta uma jornada que nao esta em `journeys-index.json`** → avise e ofereca
  rodar a Skill 1, ou escolher outra jornada. Nao substitua por uma parecida sozinho.
- **Usuario pede algo que contraria a spec** (ex.: pede um campo listado nos
  nao-objetivos) → aponte a contradicao explicitamente, cite a linha da spec, e pergunte
  se a spec deve ser atualizada (via Skill 2) antes de prosseguir. O usuario pode
  legitimamente mudar de ideia — mas isso deve virar uma nova versao da spec, nao uma
  divergencia silenciosa entre o que esta escrito e o que foi feito.

## Quando nao ha spec

Nao e erro — e o fluxo original desta skill. O `spec-reader.mjs` retorna
`found: false` com as duas saidas ja formuladas:

1. **Rodar a `lwc-spec-writer` (Skill 2) primeiro** — recomendado para componente novo,
   qualquer coisa com regra de negocio, ou edicao em componente com consumidores.
2. **Seguir com a coleta de requisito inline** (etapa 3 do guia) — adequado para mudanca
   pequena e obvia (ajuste de CSS, texto, um estado visual).

Sugira (1) e aceite (2) — a decisao e do usuario. **Nunca invente o requisito.**
