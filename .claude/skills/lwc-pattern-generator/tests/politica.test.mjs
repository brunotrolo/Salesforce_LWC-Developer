import { test } from 'node:test';
import assert from 'node:assert/strict';
import politica from '../scripts/politicas/sf-lwc-developer.mjs';

test('política do Odin: comando destrutivo é negado e leitura passa', () => {
  assert.equal(politica({ tool_name: 'Bash', tool_input: { command: 'sf org delete scratch -o x' } })?.decisao, 'negar');
  assert.equal(politica({ tool_name: 'PowerShell', tool_input: { command: 'Remove-Item -Recurse force-app/main/default/lwc' } })?.decisao, 'negar');
  assert.equal(politica({ tool_name: 'Bash', tool_input: { command: 'git status' } }), null);
});
test('política do Odin: escrita fora do componente LWC é avaliada (também com caminho do Windows)', () => {
  const a = politica({ tool_name: 'Write', tool_input: { file_path: 'force-app/main/default/lwc/meuCard/meuCard.js' } });
  const b = politica({ tool_name: 'Write', tool_input: { file_path: 'C:\\proj\\force-app\\main\\default\\lwc\\meuCard\\meuCard.js' } });
  assert.equal(a?.decisao ?? null, b?.decisao ?? null, 'mesmo veredito em POSIX e Windows');
});
test('política do Odin: entrada sem comando nem arquivo é varrida; entrada vazia não quebra', () => {
  assert.equal(politica({ tool_name: 'Grep', tool_input: { pattern: 'foo' } }), null); assert.equal(politica(undefined), null);
});
