<p align="center">
  <img src="assets/banner.svg" width="880" alt="Salesforce LWC Developer">
</p>

<p align="center">
  <a href="./README.md">📄 README</a> &nbsp;·&nbsp; <b>📖 Informações</b> &nbsp;·&nbsp; <a href="./docs/ARCHITECTURE.md">🏛️ Arquitetura</a> &nbsp;·&nbsp; <a href="./docs/PLANEJAMENTO.md">🧭 Planejamento</a> &nbsp;·&nbsp; <a href="./LICENSE">⚖️ MIT License</a>
</p>

---

# 📖 Informações

Referência detalhada das três skills. Para o começo rápido (2 min) e o passo-a-passo de
uso, veja o **[README](./README.md)**.

---

## O que faz diferente

Arquitetura **híbrida**, mesmo princípio da `apex-test-loop`:

- **Craft (o "como" fazer LWC)** vem das **skills oficiais da Salesforce**
  (`forcedotcom/sf-skills`, Apache-2.0) importadas neste projeto —
  `experience-lwc-generate` (bundle, `@wire`, Apex/GraphQL, a11y, Jest) e
  `design-systems-slds-apply` (SLDS/tokens/styling hooks).
- **Orquestração, aprendizado de padrão e captura de requisito (o nosso valor)** são as
  **3 skills próprias**:

```
Skill 1 (lwc-pattern-documenter)     Skill 2 (lwc-spec-writer)        Skill 3 (lwc-pattern-generator)
aponta LWCs de uma jornada           entrevista o requisito           combina as DUAS fontes
        ↓ extrai + documenta                 ↓ grava 1 spec por LWC           ↓
design-patterns.md +                 .lwc-spec-writer/specs/          gera/edita delegando o craft
journeys-index.json +                <slug>-spec.md                           ↓
journeys/<slug>.json                                                  score de aderência + deploy (aprovação)
   "COMO se constrói nesta org"        "O QUE construir"
```

**A spec diz o que este componente precisa fazer; o padrão diz como um componente desta
org se parece.** Gerar só com o padrão produz um componente bonito que não atende o
requisito; gerar só com a spec produz um componente correto que destoa de todos os
outros. Por isso a Skill 3 lê as duas — e por isso as Skills 1 e 2 existem antes dela.

---

## 🧭 O que a Skill 1 registra, por jornada

Cada seção `## Padrão: <Jornada>` do `design-patterns.md` guarda:

- **Componentes-fonte** usados como referência (rastreabilidade — de onde veio o padrão).
- **Padrões compartilhados**: estrutura/skeleton, naming, CSS/tokens/SLDS, slots +
  wiring pai↔filho, eventos (`bubbles`/`composed`/`detail`), contrato `@api` + defaults,
  getters, `@wire`/forma da chamada Apex, loading/erro, i18n, acessibilidade.
- **Elementos específicos por componente**: um slot, evento, token ou import que aparece
  em só UM componente da jornada — registrado à parte, atrelado ao arquivo de origem, sem
  se misturar com o que é convenção compartilhada.
- **Convenções inconsistentes**: quando os componentes apontados divergem entre si (ex.:
  parte usa prefixo `c_`, parte usa `x_`), a skill **documenta as duas variantes e
  sinaliza a divergência** — nunca escolhe a "vencedora" por maioria. A decisão de
  qual convenção adotar continua sendo sua.

Isso é gravado de forma **determinística** pelo `pattern-writer.mjs` (nunca por reescrita
livre do modelo): jornada nova → acrescenta seção; jornada existente → substitui só a
seção dela; uma trava de integridade aborta a escrita se o merge fosse perder alguma
jornada já documentada.

---

## Ownership & Delegation

Nenhuma das três skills reinventa o que já existe de craft oficial — o valor próprio é
a orquestração e a injeção do padrão aprendido.

**`lwc-pattern-documenter` (Skill 1) tem autoridade exclusiva sobre:**
- Extração de padrões a partir de arquivos apontados pelo usuário (nunca um scan
  automático de toda a org).
- Escrita/atualização incremental do `design-patterns.md`, por jornada/produto.
- Nunca gera, edita ou faz deploy de componente — só lê e documenta.

**`lwc-pattern-generator` (Skill 3) tem autoridade exclusiva sobre:**
- Injeção do padrão específico da org (aprendido pela Skill 1) na geração/edição — este
  é o próprio motivo da skill existir, não é delegável.
- Escolha de modo, coleta de requisito, resolução de conflito (padrão vs. pedido do
  usuário → sempre pergunta, nunca decide sozinha).

**Skill 3 delega o craft para:**

| Tarefa | Delega para |
|---|---|
| Autoria/edição de LWC (bundle, `@wire`, Apex/GraphQL, a11y, Jest) | `experience-lwc-generate` |
| Styling/tokens SLDS (Lightning Base Components > Blueprints > Styling Hooks > CSS) | `design-systems-slds-apply` |
| Apex `@AuraEnabled` novo (inclusive **antes** do LWC, no modo Clonar, se precisar) | `platform-apex-generate` |
| Deploy de metadata | `platform-metadata-deploy` |
| Campo/objeto custom faltante | `platform-custom-field-generate` / `platform-custom-object-generate` |

**Hard boundaries (nenhuma das duas faz):** não mexe em Flow/Process/Automation, não
cria managed packages, não deleta/move/renomeia diretórios LWC, não edita Apex fora da
delegação acima.

Arquitetura completa, decisões e porquês: **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)**.

---

## Segurança em 3 camadas (Skill 3)

Herdado da lição mais cara da `apex-test-loop` (sobrescrever produção sem querer). As
3 camadas são redundantes de propósito:

1. **`permissions.deny`** — bloqueio duro de `sf project/org/data delete` (Bash e
   PowerShell), independente de qualquer outra checagem.
2. **Hook `guard.mjs` (`PreToolUse`)** — duas respostas:
   - `deny` para comandos destrutivos sobre `lwc/` (`rm`, `mv`, `find -delete`,
     deploy com `--destructive-changes`).
   - `ask` para `Write`/`Edit` que **sobrescreveria** um bundle LWC já existente.
3. **"NUNCA FAÇA" no `SKILL.md`** — proibições explícitas em linguagem humana: nunca
   gera sem jornada de referência confirmada, nunca escreve bundle pela metade, nunca
   reescreve `design-patterns.md`/`journeys-index.json` (território da Skill 1).

**Regra central que não pode ser violada:** o `guard.mjs` **nunca confia em qual "modo"
o agente alega estar executando** — `classifyWrite()` decide `ask` vs. `allow` olhando
só a **existência real do arquivo no disco**, nunca uma flag autodeclarada. Isso fecha a
brecha de um agente confuso (ou um prompt malicioso) dizer "modo criar" para contornar a
aprovação numa sobrescrita real. Consequência prática: se **qualquer um** dos arquivos
do bundle-alvo (`.js`/`.html`/`.css`/`.js-meta.xml`/`.test.js`) já existir, o guard trata
o **bundle inteiro** como `ask` — nunca escreve 3 arquivos sem prompt e trava só no 4º.

Detalhes e a matriz completa de testes: `.claude/skills/lwc-pattern-generator/references/security-gates.md`.

---

## Rubrica de aderência ao padrão (100 pontos)

Implementada em `pattern-scorer.mjs`. **Não duplica** qualidade genérica de LWC — isso
já é coberto pelas skills delegadas (`experience-lwc-generate` tem sua própria rubrica
PICKLES de 165 pontos; `design-systems-slds-apply` exige o SLDS linter oficial). Esta
rubrica cobre só o que é **específico da ORG**, extraído do snapshot da jornada:

| Dimensão | Pontos |
|---|---|
| Estrutura (tag raiz) | 10 |
| Naming | 10 |
| Vocabulário SLDS | 15 |
| Contrato `@api` (nomes + defaults) | 20 |
| Getters/computed | 5 |
| Utilitários compartilhados | 10 |
| Contrato de eventos | 10 |
| Forma da chamada Apex | 5 |
| Loading & erro | 5 |
| i18n (Custom Labels) | 5 |
| Acessibilidade (baseline) | 5 |

**Princípio central:** se a jornada não tem convenção registrada para um sinal, a
dimensão concede crédito integral — nunca inventa regra, nunca penaliza por falta de
dado. O preview sempre mostra **os dois scores lado a lado**: aderência (desta skill) +
o resultado do craft delegado (PICKLES + SLDS lint).

**Modo Editar — pontua só o diff estrutural, nunca o arquivo inteiro:** o scorer roda o
extrator da Skill 1 duas vezes (baseline vs. proposto) e compara por chave. Dimensão sem
alteração real → excluída do total/máximo (nem soma, nem penaliza — "legado intocado não
penaliza"). Item **removido** que era convenção documentada → vira um aviso explícito de
**regressão**, nunca aceito nem bloqueado silenciosamente. Uma **flag de novidade**
dispara quando o componente usa algo (`@api`/evento/classe SLDS) que não existe em
nenhum lugar documentado da jornada — gatilho objetivo para sugerir rodar a Skill 1 de
novo.

Detalhamento completo: `.claude/skills/lwc-pattern-generator/references/quality-rubric.md`.

---

## A Skill 2 (`lwc-spec-writer`) e o modelo de duas fontes

A Skill 2 conduz uma **entrevista adaptativa** e grava uma spec **por componente** em
`.lwc-spec-writer/specs/<slug>-spec.md`. Ela cobre os 3 tipos de trabalho — componente
novo, clonar e adaptar, e **melhoria pontual** num componente em produção — e o `Tipo`
declarado no cabeçalho **mapeia 1:1 para o modo de operação da Skill 3**.

O que a entrevista captura (pulando o que não se aplica): objetivo e rastreabilidade,
escopo e **não-objetivos**, contrato de dados (Apex/LDS, volume, cache, CRUD/FLS),
exposição no `.js-meta.xml` e contrato `@api`, protótipo visual (imagem lida e confirmada,
ou texto) e estados, Console/Workspace API/LMS quando aplicável, eventos/mensagens/i18n,
dependências que precisam existir antes, testes e critério de aceite, e as questões em
aberto.

**Dois campos que valem mais do que parecem:**
- **Não-objetivos** — a Skill 3 tem "nunca amplia o escopo" como regra absoluta; sem eles
  escritos, ela (e o revisor humano) não distingue "isso faltou" de "isso foi
  deliberadamente deixado de fora".
- **Contrato público congelado** (só no tipo "melhoria pontual") — os `@api`/eventos que
  outros consumidores dependem e **não podem mudar**. É o único mecanismo que protege
  consumidores que a Skill 3 não enxerga (outro LWC, um Flow, uma página do App Builder):
  a detecção de regressão dela só conhece o que está documentado na jornada.

**Ordem de precedência** quando as fontes se cruzam: (1) contrato congelado, (2)
não-objetivos, (3) requisito da spec, (4) padrão da jornada, (5) conflito real entre 3 e
4 → **pergunta**, nunca decide sozinha. Pendências marcadas `🚧 PENDENTE` são trava, não
sugestão: a Skill 3 para e pergunta em vez de preencher com suposição.

**Se não houver spec, não é erro** — a Skill 3 cai na coleta de requisito inline e sugere
rodar a Skill 2 antes, o que vale a pena para componente novo, qualquer coisa com regra
de negócio, ou edição em componente com consumidores.

---

## Os 3 modos da Skill 3, em mais detalhe

| | **Criar** | **Clonar e Adaptar** | **Editar** |
|---|---|---|---|
| Risco | Baixo | Médio | Alto |
| Arquivo-alvo | Novo | Novo | Existente (produção) |
| Referência | Padrão agregado da jornada | Jornada + 1 componente-fonte real | Jornada descoberta a partir do componente |
| Guard | `allow` | `allow` (checa colisão de nome antes) | `ask` obrigatório |

- **Criar** consulta só o padrão **agregado** da jornada (skeleton representativo,
  naming, vocabulário SLDS, contrato `@api` comum, utilitários compartilhados, contrato
  de eventos, forma de chamada Apex, loading/toast, i18n, a11y) e gera do zero.
- **Clonar e Adaptar** parte de um componente-fonte **real**, não só do agregado —
  separa o que é convenção da jornada (reaproveitar) do que é específico daquele
  componente-fonte (adaptar: nomes de objeto/campo, contrato `@api` daquele caso,
  controller Apex). Se o componente-fonte não fez parte da amostra documentada pela
  Skill 1, a skill roda o extrator nele sozinho e compara contra o agregado da jornada
  (mesma técnica de diff do modo Editar), avisando que a confiança é menor. Se o cenário
  clonado precisar de Apex novo, isso dispara `platform-apex-generate` **antes** de
  gerar o LWC.
- **Editar** descobre a jornada de referência por **lookup reverso**
  (componente → jornada), nunca deixa o usuário escolher livremente. É o modo de maior
  risco: exige diff/preview obrigatório e working tree limpa antes de aplicar a edição,
  e nunca "corrige" uma convenção antiga fora do que foi pedido.

Guias completos: `.claude/skills/lwc-pattern-generator/references/guided-mode.md`,
`clone-adapt-guide.md` e `edit-mode-guide.md`.

---

## Como pré-visualizar o componente antes de aprovar (Local Dev Server)

A skill (e o agente que a executa) **não renderiza um preview visual na conversa** — o
que ela mostra é texto: o preview do que vai reaproveitar/adaptar (Criar/Clonar) ou o
**diff proposto** (Editar), sempre com aprovação obrigatória antes de escrever, e de
novo antes do deploy. Para **ver o componente renderizado de verdade** antes de
finalizar — importante sobretudo quando o resultado depende de **regra de negócio**
(dado de `@wire`/Apex, condição que só aparece com um registro real) e não dá para
conferir só lendo o código — use o **Local Dev Server** oficial do Salesforce CLI em
paralelo, numa aba própria, enquanto a edição acontece:

**1. Instale/atualize o plugin** (uma vez só):
```bash
sf plugins install @salesforce/plugin-lightning-dev
```

**2. Habilite o Local Dev na org** (uma vez por org): Setup → busque "Local Dev" →
"Enable Local Dev". Em scratch org, em vez disso adicione no
`config/project-scratch-def.json`:
```json
"settings": { "enableLightningPreviewPref": true }
```

**3. Escolha o modo de preview conforme a dependência do componente:**

| | `sf lightning dev app -o <org>` | `sf lightning dev component --name <nome> -o <org>` |
|---|---|---|
| O que abre | Uma página/app **real da org**, via proxy local | Um harness **isolado**, sem página nenhuma |
| Precisa estar numa página da org? | Sim (real, ou uma App Page descartável numa scratch/dev org) | Não |
| `@wire` / Apex / dados reais | ✅ Funciona | ❌ Hoje não é bem suportado |
| Melhor para | Edição que depende de **regra de negócio** — o caso mais comum no modo Editar | Iteração rápida em UI/markup/CSS puro, ou validar visual no modo Criar antes de plugar dados |

**4. Deixe a aba aberta enquanto o agente edita.** O Local Dev Server observa os
arquivos em disco e **recarrega sozinho** a cada salvamento (via WebSocket/Hot Module
Replacement, preservando o estado da página) — não precisa reimplantar nem atualizar a
mão a cada mudança. Na prática, você acompanha a edição quase em tempo real, sem esperar
o deploy final (última etapa do guia de cada modo).

Detalhamento e o passo a passo completo no contexto do modo Editar:
`.claude/skills/lwc-pattern-generator/references/edit-mode-guide.md`.

---

## Memória local por skill (`agent-memory-local/`)

Além do `design-patterns.md` (convenção de design, curada) e do `RECOMMENDATIONS.md`
(melhoria da própria skill, revisada por você), existe um terceiro tipo de conhecimento
que nenhum dos dois cobre: **fatos operacionais deste projeto/org específico** — alias de
org, particularidades de deploy, um falso-positivo do `guard.mjs` já visto, se o Local
Dev funciona nesta org. Sem registrar isso em algum lugar, o agente redescobre do zero
toda sessão.

Cada skill mantém o seu próprio arquivo em
`.claude/agent-memory-local/<skill>/MEMORY.md` — **local ao projeto, nunca versionado**
(a pasta tem seu próprio `.gitignore`, então nada aqui é commitado nem cruza para outro
projeto). Diferente do `RECOMMENDATIONS.md`, que exige revisão humana antes de qualquer
mudança, a skill pode anexar uma nota diretamente aqui — sempre avisando você numa linha
("Anotei na memória local: ..."), nunca em silêncio, e nunca duplicando o que já pertence
ao `design-patterns.md` ou ao `RECOMMENDATIONS.md`.

Detalhes completos (formato, regras, exemplos): `.claude/agent-memory-local/README.md`.

---

## Coexistência com a `apex-test-loop`

As três skills deste repo foram desenhadas para conviver, no **mesmo projeto
Salesforce**, com a [`apex-test-loop`](https://github.com/brunotrolo/Salesforce_Apex-Cover-Loop)
(a skill de cobertura de testes Apex), sem que uma sobrescreva a outra:

- **`lwc-pattern-documenter` (Skill 1) não traz `.claude/settings.json`** — instalação
  puramente aditiva, só lê arquivos e escreve Markdown/JSON, não precisa de
  guard/hook/permissões próprias.
- **`lwc-pattern-generator` (Skill 3) TRAZ um `.claude/settings.json`** (as camadas 1+2
  de segurança descritas acima — é a única das três skills deste projeto que precisa de
  guard). **Se o projeto-destino já tiver um `settings.json` da `apex-test-loop`, o
  comando de instalação NÃO deve sobrescrevê-lo** — mescle os dois arquivos: uma única
  lista `deny` com as regras das duas skills, e um array `hooks.PreToolUse` com os dois
  hooks (cada um com seu próprio `matcher`/`command`, apontando para o `guard.mjs` da
  respectiva skill).
- **Caminhos de saída isolados, sem interseção:** Skill 1 escreve só em
  `.lwc-pattern-documenter/lwc-design-system/`; Skill 3 só gera/edita em
  `force-app/**/lwc/**`; a `apex-test-loop` usa `.apex-test-loop/state/` e
  `force-app/**/classes/**`.
- **Os guards não competem, são aditivos:** o `guard.mjs` da `apex-test-loop` mira
  `.cls`/`.trigger`; o da Skill 3 mira bundles LWC (`force-app/**/lwc/**`). Cada um
  libera o domínio do outro.
- **Sem colisão de gatilhos:** os blocos TRIGGER/DO NOT TRIGGER de cada skill escopam
  o domínio (documentar LWC × gerar/editar LWC × cobrir teste Apex).

---

## 📖 Documentação completa

- **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — arquitetura completa das duas
  skills: decisão de escopo (como o projeto chegou às 3 skills), ownership & delegation,
  segurança em 3 camadas, sistema de aprendizado de padrões, rubrica de aderência, os
  3 modos da Skill 3, estrutura de repositório, tiers de implementação e decisões de
  design (com os porquês).
- **[`docs/PLANEJAMENTO.md`](./docs/PLANEJAMENTO.md)** — histórico do planejamento e
  refinamentos decididos junto com o usuário ao longo do processo.
- **[`.claude/skills/README.md`](./.claude/skills/README.md)** — índice de todas as
  skills deste repositório (próprias + oficiais importadas).

---

<p align="center">
  ⭐ <b><a href="https://github.com/brunotrolo/Salesforce_LWC-Developer/stargazers">Dê uma star no repo</a></b> para acompanhar novas melhorias.
</p>

<p align="center">
  <sub>
    Craft de LWC vindo das <b><a href="https://github.com/forcedotcom/sf-skills">skills oficiais da Salesforce</a></b> (<code>forcedotcom/sf-skills</code>, Apache-2.0) &nbsp;·&nbsp;
    <a href="https://docs.claude.com/en/docs/claude-code">Claude Code</a>
  </sub>
</p>

<p align="center">
  <sub>Orquestração e aprendizado de padrões © <a href="https://github.com/brunotrolo">brunotrolo</a> · <a href="./LICENSE">MIT</a>. Skills <code>experience-lwc-generate</code> e <code>design-systems-slds-apply</code> redistribuídas sob Apache-2.0 (ver <code>.claude/skills/VENDOR-ATTRIBUTION.md</code>).</sub>
</p>
