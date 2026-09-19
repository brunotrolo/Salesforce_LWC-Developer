# Memória local por skill — `agent-memory-local/`

Pasta **isolada por projeto e nunca versionada** (o `.gitignore` desta pasta ignora todo
`MEMORY.md`) onde cada skill deste repositório pode anotar **conhecimento operacional**
específico DESTE projeto/org — coisas que não são convenção de design de componente
(isso é o `design-patterns.md`, território exclusivo da `lwc-pattern-documenter`) nem
melhoria da própria skill (isso é o `RECOMMENDATIONS.md` de cada skill, que exige
revisão humana antes de virar mudança real).

Exemplos do que entra aqui:
- Alias/nome da org usado neste projeto, particularidades do Dev Hub/scratch org.
- Um falso-positivo do `guard.mjs` já visto e resolvido (ex.: um nome de pasta que
  parece bater com a regra destrutiva mas não é).
- Se o Local Dev Server (`sf lightning dev app`/`component`) funciona nesta org, ou uma
  limitação específica encontrada (ver `../../INFORMACOES.md`, seção "Como
  pré-visualizar o componente").
- Erros de deploy recorrentes nesta org e como foram contornados.
- Qualquer fato sobre COMO trabalhar neste projeto que não seja "como o componente deve
  ficar" (design) nem "como melhorar a skill" (autoaprendizado).

## Estrutura

```
agent-memory-local/
├── .gitignore                          # ignora **/MEMORY.md (nunca versionado)
├── README.md                           # este arquivo (versionado)
├── lwc-pattern-documenter/
│   └── MEMORY.md                       # memória da Skill 1 (criado sob demanda)
└── lwc-pattern-generator/
    └── MEMORY.md                       # memória da Skill 3 (criado sob demanda)
```

Os arquivos `MEMORY.md` **não existem neste repositório-fonte** — cada skill cria o seu
sob demanda, no projeto onde foi instalada, na primeira vez que tiver algo relevante
para anotar.

## Governança — mais leve que o `RECOMMENDATIONS.md`, de propósito

Diferente do `RECOMMENDATIONS.md` (propostas de melhoria da própria skill, que exigem
revisão humana explícita antes de qualquer coisa mudar), o `MEMORY.md` é **local, pessoal
deste projeto, e nunca sai do disco** (nunca é commitado, nunca é lido por outro
projeto). Por isso a skill pode anexar uma nota diretamente, sem pedir aprovação formal
— mas **sempre avisando o usuário em uma linha** que anotou algo (ex.: "Anotei na
memória local: ..."), nunca em silêncio.

Regras para a skill, ao anexar:
- **🚫 Nunca grave segredo, credencial, token, session ID, senha ou URL com
  parâmetro sensível** — mesmo sendo local e nunca versionado, o `MEMORY.md` fica em
  texto puro no disco do usuário. Anote o FATO operacional ("a org usa o alias X"),
  nunca o dado sensível em si ("o token de acesso é..."). Se a única forma de registrar
  o aprendizado envolver algo sensível, **não grave** — só avise o usuário em texto.
- **Só conhecimento operacional deste projeto/org.** Convenção de design → sempre
  `design-patterns.md` (Skill 1). Melhoria da skill em si → sempre `RECOMMENDATIONS.md`.
- **Não duplicar.** Se uma nota parecida já existe, não repita — no máximo atualize.
- **Ser concreto e curto.** Um fato por linha, com data, é o suficiente.
- **Ler no início de cada execução**, se o arquivo existir, antes de começar o guia.

## Formato

```markdown
# Memória local — <nome-da-skill>

- 2026-07-22: a org de dev deste projeto usa o alias `meuprojeto-dev`; scratch org não
  está habilitada (Dev Hub não conectado ainda).
- 2026-07-22: `sf lightning dev component` não renderiza o `@wire` do componente
  `consorcioLances` (depende de Apex) — usar `sf lightning dev app` para esse.
```

## Instalação

Como o resto de `.claude/`, esta pasta é copiada junto no comando de instalação do
[`README.md`](../../README.md) da raiz. O `.gitignore` local garante que, mesmo que o
projeto-destino não tenha um `.gitignore` próprio, nenhum `MEMORY.md` acaba versionado
por acidente.
