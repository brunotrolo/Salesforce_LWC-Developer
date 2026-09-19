# Modo Clonar e Adaptar — guia detalhado

Diferenca central em relacao ao modo Criar: em vez de partir SO do `aggregate` da
jornada (o padrao geral), este modo parte de um **componente-fonte real** — e precisa
separar o que e **convencao da jornada** (reaproveitar tal qual) do que e **especifico
daquele componente-fonte** (adaptar para o cenario novo).

## Passo a passo

### 1. Selecionar o componente-fonte (selecao hibrida)

Mesma regra 1 da Skill 1: pergunte se o usuario ja sabe qual componente quer clonar, ou
se quer que voce liste os candidatos:
```bash
node .claude/skills/lwc-pattern-generator/scripts/pattern-reader.mjs --journey "Nome da Jornada"
# -> snapshot.components lista os componentes que fizeram parte da amostra documentada
```

### 2. Separar convencao vs especifico

**Se o componente-fonte fez parte da amostra documentada** (aparece em
`snapshot.components`): consulte `aggregate.componentSpecifics[nomeDoComponente]` — e
o que a Skill 1 ja calculou como **unico daquele componente** (slots, eventos, tokens,
imports, tags, classes, labels que SO ele tem, frequencia 1 entre os analisados). Tudo
que NAO estiver em `componentSpecifics` daquele componente e, por definicao, **padrao
compartilhado** da jornada — reaproveite.

**Se o componente-fonte NAO fez parte da amostra documentada** (usuario aponta um
componente qualquer da org que nao foi analisado pela Skill 1): fallback — rode o
`pattern-extractor.mjs` da Skill 1 nele sozinho e compare os sinais contra o `aggregate`
da jornada usando a mesma tecnica de diff do modo Editar (ver
`references/edit-mode-guide.md`, mas aqui comparando "sinais do componente-fonte" vs
"aggregate da jornada", nao "antes vs depois"):
```bash
node .claude/skills/lwc-pattern-documenter/scripts/pattern-extractor.mjs \
  --components <caminho-do-componente-fonte> --journey "_clone_check_"
```
Sinais que batem com o `aggregate` = convencao (reaproveitar). Sinais que **nao** batem
= especifico deste componente-fonte especifico (avaliar se e cenario-especifico do
componente-fonte, ou se e algo que o componente-fonte simplesmente diverge do padrao).

**Sempre avise o usuario quando o componente-fonte nao fez parte da amostra
documentada:** *"Este componente nao estava entre os analisados quando a jornada foi
documentada — a separacao entre 'convencao' e 'especifico' aqui e uma estimativa (menos
confianca do que clonar um dos representativos oficiais)."*

### 3. Mostrar o preview de reaproveitar vs adaptar

Antes de gerar, apresente duas listas claras:

```
Reaproveitando da jornada (convencao):
- Estrutura: <representativeSkeleton ou skeleton do componente-fonte, se bater>
- Naming: prefixo "consorcio", estilo camelCase
- SLDS: slds-grid, slds-col, slds-box
- Utilitario: c/consorcioUtil (fmt, getPagination)
- Forma de chamada Apex: async/await

Adaptando (especifico do componente-fonte "consorcioBlocoAssembleia"):
- @api contemplacao, lancesContemplados -> precisam virar <novos nomes> para o cenario X
- Import especifico de AssembleiaCtrl.getResultado -> precisa de um controller novo/adaptado
```

Peca confirmacao explicita antes de prosseguir.

### 4. Dependencia de Apex

Se o cenario novo precisar de um metodo/classe Apex diferente do original, **dispare
`platform-apex-generate` ANTES** de gerar o LWC — a geracao do componente depende do
controller existir com a assinatura certa.

### 5. Gerar

Nomeie o novo componente seguindo o `naming.dominantStyle`/`commonPrefix` da jornada
(nunca o nome do componente-fonte + sufixo generico tipo "Copy"). Adapte:
- Nomes de objeto/campo especificos do cenario.
- Contrato `@api` para o novo caso de uso.
- Referencias a controllers Apex, se mudaram.
- Textos/labels especificos do componente-fonte que nao se aplicam ao cenario novo.

Preserve (nao reinvente):
- Estrutura/skeleton.
- Vocabulario SLDS.
- Utilitarios compartilhados.
- Forma de chamada Apex, loading/erro, i18n — se forem convencao da jornada.

## Checagem de colisao de nome

Antes de escrever, confirme que o nome do novo componente nao colide com um existente
(etapa 4 do guia geral) — clonar nunca deve virar uma sobrescrita acidental.
