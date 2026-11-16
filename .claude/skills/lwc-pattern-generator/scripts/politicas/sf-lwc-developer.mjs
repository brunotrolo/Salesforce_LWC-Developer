// Política do odin-guard para esta skill (ADR 0027 do Odin): as mesmas regras do guard.mjs, aplicadas depois do `odin ensure sf-lwc-developer`.
// Comando destrutivo e escrita em lugar proibido: negado ou confirmação, conforme o veredito do guard.
import { classify, classifyWrite } from '../guard.mjs';

export default function politica(evento) {
  const ti = evento?.tool_input ?? {};
  const v = ti.command !== undefined ? classify(ti.command) : ti.file_path !== undefined ? classifyWrite(ti.file_path) : classify(JSON.stringify(ti));
  return v.blocked ? { decisao: v.decision === 'ask' ? 'perguntar' : 'negar', motivo: v.why } : null;
}
