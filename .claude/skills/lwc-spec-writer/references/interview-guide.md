# Roteiro da entrevista — blocos adaptativos

Dois princípios que governam este roteiro:

1. **Cobertura completa, aplicação seletiva.** Os blocos abaixo cobrem tudo que uma spec
   de LWC pode precisar. Numa entrevista real, **muitos não se aplicam** — pule sem
   cerimônia. Uma spec de ajuste de CSS não precisa de contrato Apex; um componente de
   Record Page não precisa de Workspace API. Perguntar tudo sempre transforma a
   entrevista num formulário burocrático e faz o usuário desistir.
2. **Nunca invente para preencher.** Se o usuário não sabe ou não decidiu, registre como
   `🚧 PENDENTE` na spec (ver "Gate de completude" no fim) — nunca preencha com uma
   suposição plausível. Um campo marcado como pendente é informação útil; um campo
   inventado é uma armadilha para a Skill 3.

---

## Bloco 0 — Tipo de spec (SEMPRE primeiro — define todo o resto)

*"Isso é para: (a) um componente novo do zero, (b) clonar/adaptar um componente que já
existe para um cenário novo, ou (c) uma melhoria/ajuste pontual num componente
existente?"*

Isso espelha os 3 modos da `lwc-pattern-generator` (Skill 3) — a spec precisa dizer
**qual modo** a Skill 3 vai usar, senão ela pergunta de novo.

| Tipo | Blocos que se aplicam |
|---|---|
| **(a) Novo** | A, B, D, E, F, G*, H, I, J, K |
| **(b) Clonar/adaptar** | A, B, D, E, F, G*, H, I, J, K + **componente-fonte** (no Bloco A) |
| **(c) Melhoria pontual** | A, B, **C (obrigatório)**, + só os blocos que a mudança realmente toca |

<sub>* Bloco G só se o componente roda no Service Console.</sub>

> **Regra de ouro do tipo (c):** numa melhoria pontual, **a spec descreve a MUDANÇA, não
> o componente inteiro**. Não reescreva a especificação de tudo que o componente já faz —
> isso vira ruído e faz a Skill 3 achar que precisa mexer em mais coisa do que foi
> pedido. Se um bloco não é tocado pela mudança, omita-o.

---

## Bloco A — Identificação e rastreabilidade

1. **Nome do componente** (existente, ou proposto/provisório se for novo).
2. **Objetivo em uma frase** — o que resolve, para quem. Se for tipo (c): o que a
   mudança resolve.
3. **Rastreabilidade** (pergunte junto, resposta curta): *"Tem um ticket/user story/issue
   associado? Quem pediu?"* — vira o cabeçalho da spec e conecta o artefato ao backlog.
   Se não houver, siga sem — não bloqueie por isso.
4. **Jornada de referência.** Leia
   `.lwc-pattern-documenter/lwc-design-system/journeys-index.json` (se existir) e liste
   as jornadas documentadas:
   - Usuário aponta uma → confirme e registre.
   - Nenhuma documentada → *"Não há jornada documentada ainda. Quer rodar a
     `lwc-pattern-documenter` primeiro, ou seguimos sem referência de padrão?"* Registre
     literalmente a escolha (nunca invente uma jornada).
   - **Tipo (c):** a jornada geralmente é descoberta a partir do componente — se o
     usuário não souber, registre o componente e deixe a Skill 3 fazer o *lookup reverso*
     (`pattern-reader.mjs --find-journey`).
5. **[Só tipo (b)] Componente-fonte** — qual componente será clonado, e por quê ele
   (o que ele já resolve que se parece com o cenário novo).
6. **Onde o componente vive** — decide o Bloco G e alimenta o Bloco E:
   *"Record Page, App Page, Utility Bar, aba do Console, Experience Cloud, Flow Screen,
   ou é um componente filho consumido por outro LWC?"*

---

## Bloco B — Escopo e não-objetivos

7. **O que está no escopo** — a lista concreta do que o componente (ou a mudança) deve
   fazer.
8. **O que está FORA do escopo** — *"Tem algo que alguém poderia esperar deste componente
   mas que deliberadamente NÃO faz parte desta entrega?"*

> **Por que isso não é opcional:** a Skill 3 tem como regra absoluta "nunca amplia o
> escopo do que foi pedido". Sem os não-objetivos escritos, ela não tem como distinguir
> "isso faltou" de "isso foi deliberadamente deixado de fora" — e o revisor humano
> também não. É o campo que mais economiza discussão em code review.

---

## Bloco C — [SÓ tipo (c)] Estado atual e limites da mudança

O bloco mais importante de uma spec de melhoria pontual — e o que a spec de componente
novo não tem equivalente.

9. **Qual componente** — nome e caminho (`force-app/.../lwc/<nome>`).
10. **Comportamento atual (as-is)** — o que ele faz hoje, **só na parte que a mudança
    toca**. Não descreva o componente inteiro.
11. **Comportamento desejado (to-be)** — o que muda, concretamente.
12. **O que NÃO pode mudar** — a fronteira de regressão. Pergunte explicitamente:
    *"Esse componente é consumido por outro componente, por um Flow, ou está numa página
    montada no App Builder? Tem algum `@api`, evento ou nome de propriedade que outros
    dependem e que precisa continuar exatamente igual?"*

    Registre como **contrato público congelado**. A Skill 3 usa isso junto com sua
    própria detecção de regressão (ela avisa se a edição remove uma convenção
    documentada) — mas ela não tem como saber sozinha que um `@api` específico é
    consumido por um Flow externo. Só a spec pode dizer isso.
13. **Quem consome hoje** (se souber) — outros LWCs, Flows, páginas do App Builder,
    Experience Cloud. Dimensiona o risco da mudança.
14. **Testes existentes** — *"Já existe `.test.js` para esse componente? Algum cenário
    que precisa continuar passando exatamente como está?"*

---

## Bloco D — Dados e integração

Pule inteiro se a mudança/componente não mexe em dados (ex.: ajuste puramente visual).

15. **Fonte de dados** — *"Vem de Apex, Lightning Data Service (`@wire` de
    `getRecord`/`getRelatedListRecords`), GraphQL, ou é um componente sem backend
    (recebe tudo via `@api` do pai)?"*
16. **Contrato Apex** (se aplicável) — *"Já existe a classe/método `@AuraEnabled`? Qual?"*
    - **Existe** → registre nome da classe + método. A Skill 3 usa como está.
    - **Não existe** → registre "Apex novo (a gerar)". A Skill 3 aciona
      `platform-apex-generate` **antes** de gerar o LWC.
17. **Entrada** — parâmetros que o LWC manda (`recordId`, filtros, paginação...).
18. **Saída esperada** — formato do retorno. Peça um exemplo de JSON se houver; senão,
    lista de campos + tipo + obrigatoriedade. **Nunca complete com campos que ninguém
    mencionou.**
19. **Volume e performance** — *"Quantos registros esperamos, na média e no pior caso?
    Precisa de paginação, scroll infinito, ou carrega tudo de uma vez?"* Muda a
    arquitetura do componente (e é onde governor limits aparecem). Se for claramente
    pequeno e fixo (ex.: um card de 1 registro), pule.
20. **Cache e atualização** — *"Os dados podem ser cacheados (`cacheable=true`), ou
    precisam estar sempre frescos? Precisa atualizar quando o registro muda (refresh
    após salvar, `refreshApex`, notificação de mudança)?"*
21. **Segurança de dados** — *"Tem alguma restrição de quem pode ver/editar esses dados
    — por perfil, permission set, CRUD/FLS, ou sharing? O componente deve esconder algo
    de quem não tem permissão?"* Em Salesforce isso quase nunca é "não se aplica" — vale
    sempre perguntar quando há Apex ou dados sensíveis.

---

## Bloco E — Exposição e configuração (`.js-meta.xml` + contrato `@api`)

Pule se for tipo (c) e a mudança não altera exposição nem contrato público.

22. **Targets do `.js-meta.xml`** — derive do Bloco A (pergunta 6) e **confirme**:
    `lightning__RecordPage`, `lightning__AppPage`, `lightning__HomePage`,
    `lightning__Tab`, `lightning__UtilityBar`, `lightningCommunity__Default`,
    `lightning__FlowScreen`, ou nenhum (componente filho, consumido só por outro LWC).
    - **Se `lightning__RecordPage`:** *"Em quais objetos ele deve poder ser colocado?"*
      (vira `objects` no targetConfig).
23. **Propriedades expostas ao App Builder / Flow** — *"O admin (ou o Flow) deve poder
    configurar alguma coisa sem mexer no código — título, limite de registros, modo
    compacto?"* Cada uma vira um `@api` + entrada no `targetConfig` do meta.xml.
    - **Se Flow Screen:** distinga entrada/saída (`role="inputOnly"`/`outputOnly`) —
      o Flow precisa saber o que recebe e o que devolve.
24. **Contrato `@api` público** — a lista final de propriedades que o componente expõe
    (das perguntas 22–23 + as que o componente-pai passa).

> **Por que este bloco importa mais do que parece:** o contrato `@api` é a **maior
> dimensão da rubrica de aderência da Skill 3 (20 dos 100 pontos)** — ela compara os
> nomes e os valores default contra o padrão da jornada. Uma spec que não define o
> contrato `@api` faz a Skill 3 inventá-lo e provavelmente pontuar mal.

---

## Bloco F — Visual e estados

25. **Protótipo de tela** — *"Você tem um protótipo (print, export do Figma, wireframe)
    ou prefere descrever a tela em texto?"*
    - **Imagem:** peça o caminho, **leia o arquivo** e **descreva de volta** o que
      identificou (seções, campos, botões, hierarquia, ações) — **confirme antes de
      incluir na spec**. Nunca assuma que a leitura automática pegou tudo. Referencie o
      caminho da imagem na spec (não embuta base64).
    - **Texto:** registre como o usuário descreveu, sem reinterpretar nem "melhorar".
26. **Estados visuais** — no mínimo: **loading, sucesso, erro, vazio**. Depois pergunte
    por estados específicos do cenário (ex.: "sem permissão", "parcialmente carregado",
    "bloqueado por regra de negócio", "somente leitura").
27. **Responsividade / form factor** — *"Precisa funcionar no Salesforce mobile app ou em
    tela pequena, ou é desktop-only?"* Se a jornada já tem convenção clara disso, uma
    confirmação rápida basta.

---

## Bloco G — Console e navegação (CONDICIONAL)

**Só entra se o Bloco A (pergunta 6) indicou Console / Utility Bar / aba.** Não force em
componente de Record Page comum.

28. **Workspace API** — *"Precisa abrir/fechar sub-abas, dar refresh na aba, alertar
    sobre dados não salvos ao fechar, ou focar em um registro específico?"* Registre as
    ações concretas, não uma lista genérica.
29. **Lightning Message Service** — *"Precisa se comunicar com outros componentes na
    mesma aba?"* Se sim: qual canal e a direção (publica / assina / os dois).

---

## Bloco H — Comportamento, mensagens e acessibilidade

30. **Eventos disparados** — para cada ação que notifica outra parte do sistema: nome do
    evento, o que vai no `detail`, se sobe para o pai (`bubbles`/`composed`).
31. **Mensagens ao usuário** — *"Quais mensagens de erro/sucesso o usuário vê, e qual o
    texto?"* Distinga erro **técnico** (falha de Apex/rede) de erro **de negócio**
    (regra violada, sem permissão) — o tratamento costuma ser diferente.
32. **i18n** — *"Esses textos precisam ir em Custom Label (multi-idioma) ou podem ficar
    hardcoded?"* A jornada geralmente já tem uma convenção — se tiver, confirme em vez de
    perguntar do zero. (É uma das dimensões pontuadas pela Skill 3.)
33. **Acessibilidade específica** — *"Além do padrão da jornada, tem algum requisito
    específico?"* (navegação por teclado obrigatória num fluxo crítico, leitor de tela
    precisa anunciar mudança de estado, contraste especial). Se não houver, registre
    "segue o baseline da jornada" e siga — não force resposta.

---

## Bloco I — Dependências e pré-requisitos

34. **O que precisa existir antes** — pergunte de uma vez: *"Esse componente depende de
    algo que talvez ainda não exista: campo ou objeto custom, permission set, Custom
    Label, Static Resource, um componente filho, ou uma classe Apex?"*

Registre cada item com o status (existe / precisa criar). Isso permite que a Skill 3
acione as skills certas **antes** de gerar o LWC (`platform-custom-field-generate`,
`platform-custom-object-generate`, `platform-apex-generate`) — em vez de gerar um
componente que não compila porque o campo não existe.

---

## Bloco J — Testes e critério de aceite

35. **Cenários de teste** — quais casos os mocks de Jest devem cobrir. Não precisa
    repetir o JSON do Bloco D; só a lista de cenários (ex.: "sucesso com 3 registros",
    "lista vazia", "erro de permissão", "timeout").
36. **Critério de aceite** — *"Como saberemos que está pronto?"* Prefira critérios
    **testáveis** ("ao clicar em Salvar com o campo vazio, mostra erro X e não chama o
    Apex") a critérios vagos ("funciona bem"). Para casos simples, pode ser curto — mas
    não pule em componente com regra de negócio.

---

## Bloco K — Riscos e questões em aberto

37. **Questões em aberto** — *"Ficou alguma decisão pendente que trava a implementação?"*
    Liste cada uma com quem precisa decidir. Uma spec honesta sobre o que ainda não sabe
    é muito mais útil do que uma spec que parece completa e não é.
38. **Riscos conhecidos** (se houver) — dependência externa, prazo, área sensível do
    sistema, dado de produção envolvido.

---

## Gate de completude — antes de gerar o preview

Antes de montar o Markdown, verifique os **campos críticos** (sem eles a Skill 3 vai
inventar ou parar):

| Campo crítico | Vale para | Se estiver faltando |
|---|---|---|
| Tipo de spec (Bloco 0) | todos | **Pergunte** — não prossiga sem isso |
| Objetivo em uma frase | todos | **Pergunte** |
| Jornada de referência (ou "nenhuma") | todos | **Pergunte** — registre a escolha, mesmo que seja "nenhuma" |
| Escopo + não-objetivos | todos | **Pergunte** os não-objetivos ao menos uma vez |
| O que NÃO pode mudar | tipo (c) | **Pergunte** — é a fronteira de regressão |
| Contrato de dados (in/out) | se usa Apex/LDS | Marque `🚧 PENDENTE` se o usuário não souber |
| Contrato `@api` | se exposto no App Builder/Flow/pai | Marque `🚧 PENDENTE` |
| Estados visuais | se tem UI própria | Marque `🚧 PENDENTE` |

**Regra:** campo crítico desconhecido → grave como `🚧 PENDENTE: <o que falta e quem
decide>`, e **liste todos os pendentes no Bloco K da spec**. Nunca preencha com
suposição. Ao apresentar o preview, diga em uma linha quantos pendentes existem — o
usuário decide se grava assim (spec em rascunho) ou se resolve antes.

## Preview e gravação

**Antes de gravar, obtenha o nome canônico do arquivo** — nunca derive o kebab-case por
conta própria (nomes com dígito/sigla quebram a intuição):
```bash
node .claude/skills/lwc-pattern-generator/scripts/spec-reader.mjs --slug-for <componente>
```

Monte o Markdown completo (template em `references/spec-template.md`) e **mostre o
preview inteiro antes de gravar**. Só grave após o "ok" explícito. Se o usuário pedir
ajuste, edite e mostre de novo — nunca grave uma versão diferente da que foi aprovada.

**Se a spec já existir** para aquele componente: mostre o **diff** entre a versão atual e
a proposta, e confirme que é uma atualização (não um componente diferente que precisa de
outro nome). Ao atualizar, incremente a versão e acrescente uma linha no histórico (ver
template).
