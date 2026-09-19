# Karpathy Guidelines — aplicadas ao desenvolvimento de LWC guiado por padrão

Diretrizes comportamentais para reduzir erros comuns de LLM em código, derivadas das
[observações de Andrej Karpathy](https://x.com/karpathy/status/2015883857489522876) sobre
armadilhas de LLM em programação.

Origem: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
(MIT). As quatro seções abaixo estão **na íntegra**, em tradução fiel; cada uma traz depois
um bloco `Neste projeto` que contextualiza a diretriz para as três skills daqui —
documentar padrões, capturar requisito e gerar/editar componentes numa org que já tem
LWCs em produção. A contextualização acrescenta, nunca substitui nem relaxa a orientação
original.

Estas diretrizes são comportamentais e transversais: valem para como cada skill decide.
Cada `SKILL.md` continua sendo a autoridade sobre o seu próprio fluxo, e as duas skills
oficiais importadas continuam sendo a autoridade sobre o *craft* de LWC e de SLDS.

**Tradeoff:** estas diretrizes privilegiam cautela sobre velocidade. Para tarefas triviais, use bom senso.

---

## 1. Pense Antes de Codar

**Não presuma. Não esconda confusão. Exponha tradeoffs.**

Antes de implementar:
- Declare suas premissas explicitamente. Se estiver incerto, pergunte.
- Se existem múltiplas interpretações, apresente-as — não escolha silenciosamente.
- Se existe uma abordagem mais simples, diga. Discorde quando for o caso.
- Se algo está obscuro, pare. Nomeie o que está confuso. Pergunte.

> **Neste projeto.** É o **GUIA INICIAL obrigatório** que as Skills 1 e 3 já impõem:
> *nunca "recebe input e sai processando"*. Confirmar a jornada, escolher explicitamente
> um dos 3 modos (criar / clonar / editar), exigir o mínimo de componentes — nada disso é
> cerimônia; é a recusa de adivinhar de que org e de que jornada aquele componente é.
>
> A aplicação mais literal está na Skill 1: quando os componentes apontados **divergem
> entre si** (parte com um prefixo, parte com outro), ela **documenta as duas variantes e
> sinaliza a divergência** — nunca elege a "vencedora" por maioria. Escolher em silêncio
> transformaria um padrão observado numa decisão de arquitetura que ninguém tomou, e
> ela ficaria congelada no `design-patterns.md` como se fosse fato.
>
> E é a Skill 2 inteira: a entrevista existe porque contrato `@api`, alvos do
> `.js-meta.xml`, volume de dados e critério de aceite **não se deduzem do requisito**.
> Questão em aberto vira item de "questões em aberto" na spec, não premissa silenciosa.

---

## 2. Simplicidade Primeiro

**O mínimo de código que resolve o problema. Nada especulativo.**

- Nenhuma funcionalidade além do que foi pedido.
- Nenhuma abstração para código de uso único.
- Nenhuma "flexibilidade" ou "configurabilidade" que não foi solicitada.
- Nenhum tratamento de erro para cenários impossíveis.
- Se você escreveu 200 linhas e dava para fazer em 50, reescreva.

Pergunte a si mesmo: "Um engenheiro sênior diria que isto está complicado demais?" Se sim, simplifique.

> **Neste projeto.** A arquitetura híbrida já é a resposta: o *craft* de LWC vem das
> skills oficiais da Salesforce (`experience-lwc-generate`, `design-systems-slds-apply`).
> Reescrever aqui regra de `@wire`, de token SLDS ou de Jest é duplicar o que já está
> importado — e a cópia diverge no primeiro release do upstream.
>
> No componente gerado, vale ao pé da letra: um `@api` que a spec não pediu, um slot
> "para o caso de", um wrapper de erro para um cenário que o Apex não produz — tudo isso
> passa no deploy e vira dívida que a Skill 1 vai documentar depois como se fosse padrão
> da org. O que a spec pediu, e só.

---

## 3. Mudanças Cirúrgicas

**Toque apenas no que precisa. Limpe apenas a sua própria bagunça.**

Ao editar código existente:
- Não "melhore" código adjacente, comentários ou formatação.
- Não refatore coisas que não estão quebradas.
- Siga o estilo existente, mesmo que você fizesse diferente.
- Se notar código morto não relacionado, mencione — não apague.

Quando suas mudanças criam órfãos:
- Remova imports/variáveis/funções que **as suas** mudanças tornaram inúteis.
- Não remova código morto pré-existente a menos que peçam.

O teste: toda linha alterada deve ser rastreável diretamente ao pedido do usuário.

> **Neste projeto.** Esta é a diretriz de maior consequência aqui, e o repositório já a
> codificou em três mecanismos — vale entender o **porquê** de cada um, não só obedecê-los:
> **(a) O modo EDITAR mexe em componente que já está em produção.** A regra
> *"nunca 'corrige' convenção antiga sem pedido"* é exatamente esta diretriz: um LWC com
> prefixo antigo, CSS fora do token ou getter que você faria diferente **não está
> quebrado** — está em produção, e outra tela pode depender daquele nome de classe.
> Reporte; não corrija.
> **(b) O `guard.mjs` trava sobrescrita de bundle LWC existente.** Ele existe porque
> "editar" e "regerar por cima" parecem a mesma coisa para um agente e não são: o segundo
> apaga tudo que não estava na spec. Mostrar diff/preview antes de escrever é o que torna
> a mudança rastreável ao pedido.
> **(c) As 2 skills importadas não se editam.** `experience-lwc-generate/` e
> `design-systems-slds-apply/` são cópia fiel de um snapshot pinado do upstream. Correção
> que pertence a elas vai para o upstream — editá-las aqui quebra a promessa do pin e o
> commit registrado deixa de descrever o que está no disco.
>
> Vale também para o `design-patterns.md`: a Skill 1 faz **merge** por jornada (jornada
> nova anexa; existente substitui só a própria seção). Reescrever o arquivo inteiro apaga
> o conhecimento das outras jornadas, e ninguém percebe até precisar dele.

---

## 4. Execução Orientada a Objetivo

**Defina critérios de sucesso. Itere até verificar.**

Transforme tarefas em objetivos verificáveis:
- "Adicione validação" → "Escreva testes para entradas inválidas, depois faça-os passar"
- "Corrija o bug" → "Escreva um teste que o reproduz, depois faça-o passar"
- "Refatore X" → "Garanta que os testes passam antes e depois"

Para tarefas multi-etapa, declare um plano breve:
```
1. [Passo] → verificar: [checagem]
2. [Passo] → verificar: [checagem]
3. [Passo] → verificar: [checagem]
```

Critérios de sucesso fortes permitem iterar de forma independente. Critérios fracos
("faça funcionar") exigem esclarecimento constante.

> **Neste projeto.** O encadeamento Skill 1 → Skill 2 → Skill 3 é esse plano, e os
> critérios já existem explícitos: o **score de aderência** ao padrão da org, o
> **critério de aceite** que a spec obriga a escrever, e o **deploy só mediante
> aprovação**.
>
> O ponto que merece nome próprio: **"o componente renderiza" não é o critério.** Um LWC
> que sobe e desenha a tela ainda pode estar fora do padrão da jornada, ignorar um estado
> de erro que a spec previu, ou quebrar acessibilidade — nada disso falha no deploy. Por
> isso o score e o critério de aceite da spec são verificados separadamente: um mede
> *parece com esta org*, o outro mede *faz o que foi pedido*. Passar só num dos dois é
> critério fraco vestido de forte.

---

*Diretrizes derivadas de observações de Andrej Karpathy, via
[multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills),
licença MIT. Os blocos `Neste projeto` são contextualização própria deste repositório.*
