# Rubrica de Aderencia ao Design Pattern (100 pontos)

Implementada em `scripts/pattern-scorer.mjs`. **Nao duplica** qualidade generica de LWC
— isso ja e coberto pelas skills delegadas:
- `experience-lwc-generate`: rubrica PICKLES de **165 pontos** (arquitetura, a11y,
  performance, Jest, etc.).
- `design-systems-slds-apply`: **SLDS linter obrigatorio**
  (`npx @salesforce-ux/slds-linter@latest lint`) + checklist.

Esta rubrica cobre **so** o que e especifico da ORG — extraido 1:1 do snapshot da
jornada (`journeys/<slug>.json`, gravado pela Skill 1 via `pattern-writer.mjs --data`).
**Sempre mostre os dois scores lado a lado no preview** (etapa 7 do guia): aderencia
(gate formal desta skill) + craft/SLDS (informativo — garante que ninguem "esqueca" de
checar se o craft delegado realmente rodou).

## As 11 dimensoes (100 pontos)

| # | Dimensao | Pontos | Le do snapshot (`aggregate.*`) |
|---|---|---|---|
| 1 | Estrutura (tag raiz) | 10 | `html.rootTags` |
| 2 | Naming | 10 | `naming.dominantStyle`, `naming.commonPrefix` |
| 3 | Vocabulario SLDS | 15 | `html.commonSldsClasses` |
| 4 | Contrato `@api` (nomes + defaults) | 20 | `js.allApiMembers`, `js.apiDefaults` |
| 5 | Getters/computed | 5 | `js.allGetters` |
| 6 | Utilitarios compartilhados | 10 | `js.sharedUtils` |
| 7 | Contrato de eventos | 10 | `js.eventContracts` |
| 8 | Forma da chamada Apex | 5 | `js.apexCallStyle` |
| 9 | Loading & Erro | 5 | `html.spinnerUsers`, `js.toast.users` |
| 10 | i18n (Custom Labels) | 5 | `js.labelUsers` |
| 11 | Acessibilidade (baseline) | 5 | `html.a11yAvg` |

**Principio central de todas as dimensoes:** se a jornada **nao tem** convencao
registrada para aquele sinal (campo vazio/ausente no `aggregate`), a dimensao concede
**credito integral** — a skill nunca inventa uma regra que a org nao tem, nem penaliza
por falta de dado.

### Detalhe por dimensao

1. **Estrutura** — compara `html.rootTag` do componente com a tag raiz mais frequente
   em `aggregate.html.rootTags`. Tudo ou nada (10 ou 0) — a tag de wrapper e o alicerce
   da composicao.
2. **Naming** — 5 pts se o estilo (`camelCase` etc.) bate com `dominantStyle`; 5 pts se
   o nome comeca com `commonPrefix` (quando a jornada tiver um).
3. **SLDS** — proporcao das classes `slds-*` do componente que aparecem em
   `commonSldsClasses`. Componente sem NENHUMA classe SLDS numa jornada com vocabulario
   estabelecido tira 0 — sinal forte de que nao esta seguindo o padrao de layout/spacing.
4. **Contrato `@api`** — 12 pts pela proporcao de nomes de `@api` que batem com
   `allApiMembers`; 8 pts pelos valores de default (`apiDefaults`) baterem, quando o
   componente reusa um nome que tem default documentado.
5. **Getters** — proporcao de getters que batem com `allGetters` (os idiomaticos da
   jornada, ex.: `get isLoading()`).
6. **Utilitarios compartilhados** — credito integral se importa algum dos modulos de
   `sharedUtils`; credito parcial (3/10, nao 0) se a jornada tem utilitario forte mas o
   componente nao importa nenhum — **e um alerta pra revisar, nao um bloqueio** (pode
   ser legitimo o componente nao precisar do util).
7. **Contrato de eventos** — para cada evento do componente que bate em NOME com
   `eventContracts`, compara `bubbles`/`composed`/`detailKeys`. Evento cujo nome nao
   aparece em nenhum contrato conhecido = "nada para comparar" (credito integral —
   pode ser um evento legitimamente novo; a flag de **novidade**, nao esta dimensao, e
   quem sinaliza isso).
8. **Forma da chamada Apex** — so avalia se o componente usa Apex imperativo E a
   jornada tem alguma chamada Apex registrada (senao "sem convencao" = credito
   integral). Compara com a forma dominante (`usesAwait` vs `usesThen`).
9. **Loading & Erro** — 2.5 pts por ter estado de loading (se `spinnerUsers > 0` na
   jornada) + 2.5 pts por usar `ShowToastEvent` (se `toast.users > 0`).
10. **i18n** — usa Custom Labels se `labelUsers > 0` for convencao da jornada.
11. **Acessibilidade (baseline)** — `a11yScore` do componente >= `a11yAvg` da jornada.
    Nunca hard-zero (minimo 2/5) — a11y fina e territorio da `experience-lwc-generate`,
    aqui e so "nao regredir abaixo da media observada".

## Modo Editar — diff estrutural (nao pontua o arquivo inteiro)

Ver `references/edit-mode-guide.md` para o detalhamento completo. Resumo: o scorer roda
`pattern-extractor.mjs` (Skill 1) duas vezes — baseline (antes) e proposto (depois) — e
compara **por chave**, nao por linha:

- **Dimensao SEM alteracao real** entre baseline/depois → **excluida** do total/max
  (nem soma nem penaliza — aparece em `skippedUnchanged`). Isso implementa "sinal
  legado intocado nao penaliza": um componente que ja divergia do padrao antes da
  edicao, e que a edicao nao tocou, nao vira penalidade nova.
- **Dimensao COM alteracao** → pontuada usando so os itens NOVOS (o "delta"), reusando
  as mesmas 11 funcoes de dimensao acima.
- **Regressao** (campo `regressions`, separado do score) — item REMOVIDO que era
  convencao documentada da jornada (ex.: removeu um `@api` do contrato comum, removeu o
  toast de erro). Sempre um aviso explicito para o usuario confirmar a intencao —
  **nunca** silenciosamente aceito nem bloqueado.

## Flag de novidade (`novelty`)

Presente em todo resultado do `pattern-scorer.mjs` (ambos os modos). `novel: true`
quando o componente usa um `@api`/evento/classe SLDS que **nao** aparece nem nos
padroes compartilhados (`allApiMembers`/`allEvents`/`commonSldsClasses`) nem em
`componentSpecifics` de nenhum componente ja documentado da jornada. E o gatilho
**objetivo** (nao um "parece que sim") para a etapa 9 do guia sugerir re-rodar a Skill 1.

## Formato do preview (etapa 7 do guia)

```
Aderencia ao design pattern (Skill 3): 87/100
  ✓ Estrutura (tag raiz): 10/10 — usa "lightning-card" (dominante da jornada)
  ✓ Naming: 10/10 — estilo "camelCase" bate; prefixo "consorcio" bate
  ~ Vocabulario SLDS: 12/15 — reaproveita 4/5 classes do vocabulario comum
  ...

Craft (delegado):
  experience-lwc-generate (PICKLES): 148/165
  design-systems-slds-apply (lint): 0 violacoes

⚠️ Novidade detectada: "somethingBrandNewNotInJourney" nao esta documentado nesta
   jornada — considere rodar a Skill 1 de novo apos aprovar este componente.
```
