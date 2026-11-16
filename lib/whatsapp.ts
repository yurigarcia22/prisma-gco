/** Deixa o número no formato 55DDDNUMERO. Retorna null se não parecer um celular BR. */
export function normalizarTelefone(t: string | null | undefined): string | null {
  if (!t) return null;
  let d = t.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.length < 12 || d.length > 13) return null;
  return d;
}

/** Link que abre o WhatsApp com a mensagem pronta (plano B sem Evolution). */
export function linkWaMe(telefone: string, mensagem: string) {
  const n = normalizarTelefone(telefone) ?? telefone.replace(/\D/g, "");
  return `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`;
}

export interface ConfigEvolution {
  evolution_url: string | null;
  evolution_key: string | null;
  instancia: string | null;
  ativo: boolean;
}

export function evolutionPronto(c: ConfigEvolution | null | undefined): c is ConfigEvolution {
  return !!(c && c.ativo && c.evolution_url && c.evolution_key && c.instancia);
}

/** Envia texto pela Evolution API (v2). */
export async function enviarEvolution(
  c: ConfigEvolution,
  telefone: string,
  mensagem: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const numero = normalizarTelefone(telefone);
  if (!numero) return { ok: false, erro: "Telefone inválido" };
  const base = c.evolution_url!.replace(/\/+$/, "");
  try {
    const r = await fetch(`${base}/message/sendText/${encodeURIComponent(c.instancia!)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.evolution_key! },
      body: JSON.stringify({ number: numero, text: mensagem }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      const corpo = (await r.text()).slice(0, 300);
      return { ok: false, erro: `Evolution ${r.status}: ${corpo}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
