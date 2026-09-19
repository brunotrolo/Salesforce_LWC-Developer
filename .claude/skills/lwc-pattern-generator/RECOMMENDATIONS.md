# Recomendacoes de melhoria — skill lwc-pattern-generator

Registro **vivo** de melhorias para a propria skill. A etapa 9 do guia (aprendizado)
anexa propostas aqui com base no que aconteceu num run real (friccao com o guard,
divergencia mal resolvida, score que nao capturou algo relevante, etc.); um humano
revisa e decide. Mesmo formato de ledger do `apex-test-loop`.

## Como funciona (o ciclo)

1. **Skill propoe** — ao terminar um run **com friccao real** (o guard bloqueou algo
   inesperado, um conflito de padrao foi dificil de resolver, o score de aderencia
   nao capturou um sinal relevante, faltou orientacao numa referencia...), a skill
   ANEXA aqui uma proposta com status `Proposta`. Em runs limpos, nao anexa nada.
2. **Voce pede** — "leia as recomendacoes e ajuste a skill se concordar".
3. **Revisao** — cada item recebe um status final; as aprovadas sao aplicadas.

## Status

🟡 **Proposta** · 🟢 **Aprovada** (vamos aplicar) · ✅ **Aplicada** (feita) ·
⚪ **Reprovada** (com motivo)

## Regras para a skill (ao anexar)

- **Nao duplicar**: se ja existe item (aberto ou aplicado) sobre o mesmo ponto, nao
  crie outro — no maximo, adicione uma nota.
- **Ser concreto**: descreva o gatilho real, o problema e a mudanca proposta em termos
  acionaveis (qual arquivo/dimensao/etapa). Nada de generico.
- **ID sequencial**: use o proximo `R-XXXX` livre.
- **Poucos e bons**: no maximo ~3 por run; so o que teve friccao de verdade.
- **Gatilho objetivo de "rode a Skill 1 de novo" e SEPARADO deste arquivo** — isso e a
  flag `novelty` do `pattern-scorer.mjs` (ver `references/quality-rubric.md`), sugerida
  ao usuario na hora, nao registrada aqui.
- **Nunca mexe em `design-patterns.md`/`journeys-index.json`/`journeys/*.json`** —
  mesmo ao anexar uma recomendacao sobre a interacao com a Skill 1, este arquivo e o
  unico que a `lwc-pattern-generator` escreve para autoaprendizado.

---

## Ledger

_(vazio — nenhuma recomendacao registrada ainda)_
