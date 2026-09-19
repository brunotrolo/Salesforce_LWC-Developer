---
name: lwc-spec-writer
description: >-
  Conduz uma ENTREVISTA estruturada e adaptativa sobre um requisito de LWC e gera um
  arquivo `spec.md` — um por componente — em `.lwc-spec-writer/specs/<slug>-spec.md`.
  Cobre os 3 tipos de trabalho: componente NOVO do zero, CLONAR/adaptar um existente, e
  MELHORIA PONTUAL num componente ja em producao (com contrato publico congelado e
  fronteira de regressao). Captura objetivo, escopo e NAO-objetivos, jornada de
  referencia (Skill 1), contrato de dados (Apex/LDS/GraphQL, volume, cache, CRUD/FLS),
  exposicao no `.js-meta.xml` (targets/App Builder/Flow) e contrato `@api`, prototipo
  visual (imagem ou descricao) e estados, Console/Workspace API/LMS quando aplicavel,
  eventos, mensagens e i18n, dependencias que precisam existir antes, testes e criterio
  de aceite, e as questoes em aberto. NUNCA gera ou edita codigo LWC/Apex — so escreve a
  spec, que a `lwc-pattern-generator` (Skill 3) consome depois. TRIGGER quando o usuario
  disser que quer "fazer a spec primeiro", "documentar o requisito antes de criar",
  "especificar uma melhoria num LWC existente", ou pedir para criar/planejar um LWC sem
  ainda ter os detalhes definidos. DO NOT TRIGGER quando o usuario ja tem a spec pronta e
  so quer o codigo gerado (isso e a `lwc-pattern-generator`), ou quando quer documentar
  padroes de componentes JA EXISTENTES na org (isso e a `lwc-pattern-documenter`).
---

# LWC Spec Writer — entrevista o requisito e grava a especificacao, um arquivo por componente

Objetivo: dado um requisito de negocio para um LWC — **novo, clonado, ou uma melhoria
pontual num que ja existe** — conduzir uma entrevista estruturada e gravar tudo num
unico arquivo `.lwc-spec-writer/specs/<slug>-spec.md`, completo o bastante para que a
`lwc-pattern-generator` (Skill 3) **não precise perguntar de novo** o que já foi
respondido aqui.

Esta skill é o **segundo elo** do pipeline (ver `docs/ARCHITECTURE.md`):

```
Skill 1 (lwc-pattern-documenter)      Skill 2 (lwc-spec-writer, ESTA)      Skill 3 (lwc-pattern-generator)
"como os componentes desta org        "o que ESTE componente/mudanca       "gera/edita alinhado aos DOIS:
 costumam ser" (padrao, agregado)      precisa fazer" (requisito, 1 a 1)     padrao da org + spec do requisito"
        ↓                                      ↓                                    ↓
design-patterns.md +                  .lwc-spec-writer/specs/              usa as DUAS fontes
journeys-index.json                   <slug>-spec.md                       (spec-reader.mjs + pattern-reader.mjs)
```

> **Divisão de papéis:** esta skill só **referencia** a jornada de padrão (pergunta qual
> é, se existir) — não interpreta o conteúdo de `design-patterns.md`, isso é trabalho da
> Skill 3. A Skill 3 lê a spec gerada aqui via `spec-reader.mjs`: dela ela deriva o modo
> de operação (`Tipo`), a jornada, o componente-alvo, o contrato público congelado, os
> não-objetivos e as pendências. **Por isso o cabeçalho em tabela e as seções 2 e 3 do
> template importam tanto** — são o que a Skill 3 lê de forma estruturada.

## Os 3 tipos de spec (espelham os 3 modos da Skill 3)

A **primeira pergunta da entrevista** define todo o resto:

| Tipo | Quando | O que a spec descreve |
|---|---|---|
| **(a) Componente novo** | do zero, numa jornada existente | o componente inteiro |
| **(b) Clonar e adaptar** | parte de um componente-fonte real | o componente novo + o que muda em relação à fonte |
| **(c) Melhoria pontual** | ajuste num componente em produção | **a mudança**, não o componente inteiro |

O tipo (c) tem um bloco exclusivo e obrigatório — **estado atual (as-is) vs. desejado
(to-be) + o contrato público congelado** (quais `@api`/eventos/propriedades outros
consumidores dependem e que **não podem mudar**). Sem isso a Skill 3 não tem como saber
que um `@api` específico é consumido por um Flow externo — a detecção de regressão dela
só enxerga o que está documentado na jornada.

## 🚫 NUNCA FAÇA (proibições absolutas)

1. **Nunca escreve, edita ou gera código LWC/Apex** — o único artefato desta skill é o
   `spec.md`. Gerar/editar componente é trabalho exclusivo da `lwc-pattern-generator`.
2. **Nunca inventa para preencher um campo.** Se o usuário não sabe ou não decidiu,
   grave `🚧 PENDENTE: <o que falta / quem decide>` e liste na seção de questões em
   aberto. Um campo pendente é informação útil; um campo inventado é uma armadilha para
   a Skill 3 (que vai tratar suposição como requisito confirmado).
3. **Nunca decide sozinha um contrato de dados ambíguo** (nomes de campo, formato,
   obrigatoriedade) — pergunta, não completa.
4. **Nunca sobrescreve uma spec existente sem mostrar o diff.** Se
   `.lwc-spec-writer/specs/<slug>-spec.md` já existir, avise, mostre o diff, e confirme
   se é atualização (incrementa versão + histórico) ou se é outro componente que precisa
   de outro nome/slug.
5. **Nunca inventa a jornada de referência.** Liste as jornadas de `journeys-index.json`;
   se não houver nenhuma, ofereça rodar a Skill 1 primeiro OU seguir sem referência —
   registrando literalmente "nenhuma documentada ainda" na spec.
6. **Nunca grava a spec sem preview + aprovação explícita** — mostre o Markdown completo
   antes de salvar, igual às outras duas skills deste repositório.
7. **Nunca transforma a entrevista num formulário burocrático.** Os blocos do roteiro
   cobrem tudo que uma spec *pode* precisar; numa entrevista real, **pule sem cerimônia
   o que não se aplica**. Perguntar contrato Apex num ajuste de CSS, ou Workspace API num
   componente de Record Page, faz o usuário desistir no meio.
8. **Nunca mexe em Flow/Process/Automation, campos/objetos, ou deploy** — fora do escopo
   total desta skill (é só entrevista + Markdown).

## Ownership

Esta skill **não delega nada e não é delegada por ninguém** — ela só entrevista e
escreve. A produção de código (delegação de craft) acontece inteiramente na Skill 3.

## A entrevista — blocos adaptativos

Roteiro completo (perguntas exatas, condicionais, como tratar protótipo de imagem) em
`references/interview-guide.md`. Os blocos:

| Bloco | Conteúdo | Quando |
|---|---|---|
| **0** | **Tipo de spec** (novo / clonar / melhoria) | sempre — define o resto |
| **A** | Identificação, rastreabilidade (ticket/solicitante), jornada, onde vive | sempre |
| **B** | Escopo e **não-objetivos** | sempre |
| **C** | **Estado atual + contrato público congelado + consumidores** | só tipo (c) |
| **D** | Dados: Apex/LDS/GraphQL, contrato in/out, volume, cache, CRUD/FLS | se mexe em dados |
| **E** | `.js-meta.xml` (targets, App Builder/Flow) + contrato `@api` | se muda exposição |
| **F** | Protótipo visual (imagem ou texto), estados, form factor | se tem UI própria |
| **G** | Workspace API + Lightning Message Service | **só** se roda no Console |
| **H** | Eventos, mensagens de erro, i18n, a11y específica | quase sempre |
| **I** | Dependências que precisam existir antes (campo/objeto/label/Apex...) | se houver |
| **J** | Cenários de teste + critério de aceite | quase sempre |
| **K** | Questões em aberto e riscos | sempre (mesmo que vazio) |

**Dois campos que economizam mais discussão do que parecem:**
- **Não-objetivos (Bloco B)** — a Skill 3 tem "nunca amplia o escopo" como regra
  absoluta; sem os não-objetivos escritos, ela (e o revisor humano) não distingue "isso
  faltou" de "isso foi deliberadamente deixado de fora".
- **Contrato `@api` (Bloco E)** — é a **maior dimensão da rubrica da Skill 3 (20 dos 100
  pontos)**. Spec sem contrato `@api` definido faz a Skill 3 inventá-lo e pontuar mal.

## Gate de completude

Antes de montar o preview, cheque os campos **críticos** (tabela completa em
`references/interview-guide.md`): tipo de spec, objetivo, jornada (ou "nenhuma"), escopo
+ não-objetivos, e — no tipo (c) — o que não pode mudar. Faltou um crítico → **pergunte**.
Faltou um não-crítico → **marque `🚧 PENDENTE`** e liste no Bloco K.

Ao apresentar o preview, diga em uma linha quantas pendências existem — o usuário decide
se grava assim (spec em rascunho) ou se resolve antes.

## Formato e local da spec

- **Uma spec por componente:** `.lwc-spec-writer/specs/<slug>-spec.md`.

  ⚠️ **Nunca derive o nome do arquivo "no olho".** Pergunte ao script que a Skill 3 usa
  para procurar a spec depois — assim os dois lados usam exatamente a mesma regra:
  ```bash
  node .claude/skills/lwc-pattern-generator/scripts/spec-reader.mjs \
    --slug-for consorcioListaCotas
  # -> { "fileName": "consorcio-lista-cotas-spec.md", "specPath": "..." }
  ```
  Motivo concreto: nomes com dígito ou sigla quebram a intuição de kebab-case —
  `consorcioLances2024` vira `consorcio-lances2024-spec.md`, não
  `consorcio-lances-2024-spec.md`. Errar o nome fazia a Skill 3 não achar a spec e cair
  na entrevista inline **em silêncio**, ignorando este documento. (Hoje ela tem um
  fallback que ainda encontra a spec e avisa — mas nascer com o nome certo é melhor.)
- **Pasta oculta, própria da ferramenta, na raiz do projeto** — mesmo padrão de
  `.lwc-pattern-documenter/` (Skill 1): fora de `docs/`, fora de `.claude/`, criada em
  tempo de execução no projeto do usuário. **Diferente da memória local
  (`agent-memory-local/`): a spec É PARA SER versionada em git** — é documentação viva do
  requisito, não estado descartável.
- **Cabeçalho em tabela** (tipo, status, versão, jornada, componente, ticket, data) — é o
  que a Skill 3 vai ler primeiro para saber o modo e o alvo.
- Template completo em `references/spec-template.md`.

**Se a pasta `.lwc-spec-writer/specs/` não existir, crie-a.** Esta skill é dona exclusiva
desse diretório.

## Confirmação final

Depois de gravar a spec, pergunte:

*"A spec foi gerada em `.lwc-spec-writer/specs/<slug>-spec.md` (<N> pendências em
aberto). Quer revisar mais alguma coisa, ou posso te apontar para a
`lwc-pattern-generator` prosseguir com a implementação?"*

A Skill 3 encontra a spec sozinha pelo nome do componente (`spec-reader.mjs --component
<nome>`) — não é preciso colar o conteúdo. Se houver pendências, ela **pergunta** em vez
de assumir, quando chegar na parte afetada.

## Referências

- `references/interview-guide.md` — o roteiro completo, bloco por bloco, com as perguntas
  exatas, os condicionais, o tratamento de protótipo em imagem e o gate de completude.
- `references/spec-template.md` — o template exato do `spec.md`, com as regras de omitir
  seção que não se aplica e de marcar pendência.
- `docs/ARCHITECTURE.md` (raiz do repo) — onde esta skill se encaixa nas outras duas.
