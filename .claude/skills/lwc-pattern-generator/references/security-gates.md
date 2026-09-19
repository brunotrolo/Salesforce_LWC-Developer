# Seguranca em 3 Camadas — modelo completo

Herdado da licao mais cara do `apex-test-loop` (o incidente de sobrescrever uma classe
de producao), adaptado para bundles LWC. As 3 camadas sao **redundantes de proposito**
— cada uma cobre o que a outra pode deixar passar.

## Camada 1 — `permissions.deny` (`.claude/settings.json`)

Bloqueia no nivel do shell, antes mesmo do hook rodar:
```json
"deny": [
  "Bash(sf project delete *)", "Bash(sf org delete *)", "Bash(sf data delete *)",
  "PowerShell(sf project delete *)", "PowerShell(sf org delete *)", "PowerShell(sf data delete *)"
]
```

## Camada 2 — hook `guard.mjs` (`scripts/guard.mjs`)

### `classify(cmd)` — comandos destrutivos (deny)

Bloqueia comandos que apagam/movem codigo dentro de uma pasta `lwc/`, apagam a org, ou
apagam registros — mesmo com flags no meio do comando que `permissions.deny` (regras de
prefixo) nao alcancaria. Ver `DESTRUCTIVE_RULES` no codigo para a lista completa (rm/
rmdir/find-delete/mv sobre `lwc/`, mais `sf project|org|data delete` e deploy
destrutivo). **`deny` e bloqueio duro — sem aprovacao possivel.**

### `classifyWrite(filePath, opts)` — sobrescrita de bundle (ask)

> **A REGRA QUE NAO PODE SER VIOLADA:** este guard **nunca confia em qual "modo"**
> (Criar/Clonar/Editar) **o agente alega estar executando**. A decisao `ask`/`allow`
> olha **so a existencia factual** de arquivo(s) do bundle-alvo no disco. Um agente
> confuso — ou um prompt malicioso — que se autodeclara "modo criar" **nao pode**
> contornar o prompt de aprovacao numa sobrescrita real. Confiar na auto-declaracao do
> agente seria uma via de bypass da propria trava de seguranca.

Comportamento:
- Arquivo fora de uma pasta `lwc/`, ou extensao que nao e do bundle
  (`.js`/`.html`/`.css`/`.js-meta.xml`) → fora do escopo deste guard, `allow`.
- **Bundle NOVO** (nenhum arquivo do bundle-alvo existe no disco ainda) → `allow`.
  Cobre os modos Criar e Clonar-e-Adaptar (ambos criam arquivo novo).
- **Bundle que JA TEM algum arquivo no disco** (mesmo que so 1 dos 4-5) → `ask` para o
  **BUNDLE INTEIRO**, nao so o arquivo especifico sendo escrito. Cobre o modo Editar —
  e evita o cenario de "colisao parcial" abaixo.

### Colisao parcial de bundle

Um componente LWC e escrito em **chamadas separadas** (uma por arquivo: `.js`, `.html`,
`.css`, `.js-meta.xml`, `.test.js`). Se so UM desses arquivos ja existir no disco (ex.:
alguem criou o `.js-meta.xml` manualmente antes), o guard trata o **bundle inteiro**
como `ask` — nunca escreve os outros 3-4 arquivos sem prompt e trava so no ultimo,
deixando o componente pela metade. Testado em `tests/guard.test.mjs`
("COLISAO PARCIAL").

## Camada 3 — "NUNCA FACA" (`SKILL.md`)

Proibicoes explicitas em linguagem humana — a rede de seguranca que cobre o que
matching por texto/caminho (Camadas 1-2) nao alcanca:
1. Nunca gera sem jornada de referencia confirmada.
2. Nunca confia em "modo" autodeclarado para decidir seguranca.
3. Nunca escreve um bundle pela metade.
4. Nunca "corrige" convencao divergente silenciosamente.
5. Nunca mistura jornadas sem checkpoint.
6. Nunca reescreve os arquivos de saida da Skill 1.
7. Nunca mexe em Flow/Apex/managed packages diretamente.
8. Nunca aplica edicao sem mostrar o diff e obter aprovacao.

## Checagens complementares (produto, nao seguranca dura)

Estas nao sao do `guard.mjs` — sao passos do guia (`references/guided-mode.md`) que
previnem o problema **antes** da camada de seguranca precisar agir:
- **Checagem proativa de nome/path** na coleta de requisito (etapa 4): pergunta ao
  usuario ANTES de tentar escrever, se o nome ja existe.
- **Working tree limpa** antes de aplicar uma edicao (`git status --short <path>`):
  garante que `git checkout -- <arquivo>` seja um rollback seguro se a edicao for
  rejeitada ou sair errada.

## Limitacao honesta

Matching por texto/caminho nao e uma fronteira criptografica — wrappers exoticos,
variaveis de ambiente ou substituicao de comando podem, em tese, escapar da Camada 2.
Por isso a Camada 3 (instrucoes explicitas em `SKILL.md`) continua essencial mesmo com
o guard ativo.
