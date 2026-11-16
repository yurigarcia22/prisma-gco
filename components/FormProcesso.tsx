"use client";

import { useActionState } from "react";

type Acao = (prev: unknown, fd: FormData) => Promise<{ erro?: string } | undefined | void>;

import { MODALIDADES } from "@/lib/modalidades";

export default function FormProcesso({
  acao,
  fluxos,
  corretores,
  fluxoPadrao,
  textoBotao = "Criar processo",
  avisoBoasVindas = true,
}: {
  acao: Acao;
  fluxos: { id: string; nome: string }[];
  corretores?: { id: string; nome: string }[];
  fluxoPadrao?: string;
  textoBotao?: string;
  avisoBoasVindas?: boolean;
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  const erro = estado && typeof estado === "object" && "erro" in estado ? estado.erro : null;

  return (
    <form action={enviar} className="space-y-6">
      <fieldset className="card space-y-4 p-5">
        <legend className="font-display px-1 text-lg font-bold">Cliente</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome completo *</label>
            <input name="cliente_nome" required className="field" />
          </div>
          <div>
            <label className="label">WhatsApp *</label>
            <input name="cliente_telefone" required inputMode="tel" placeholder="(37) 99999-9999" className="field" />
          </div>
          <div>
            <label className="label">CPF</label>
            <input name="cliente_cpf" inputMode="numeric" placeholder="000.000.000-00" className="field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">E-mail</label>
            <input name="cliente_email" type="email" className="field" />
          </div>
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="font-display px-1 text-lg font-bold">Financiamento</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Fluxo *</label>
            <select name="fluxo_id" required defaultValue={fluxoPadrao ?? fluxos[0]?.id} className="field">
              {fluxos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Modalidade</label>
            <select name="modalidade" defaultValue="" className="field">
              <option value="">Escolher</option>
              {MODALIDADES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          {corretores ? (
            <div className="sm:col-span-2">
              <label className="label">Corretor</label>
              <select name="corretor_id" defaultValue="" className="field">
                <option value="">Sem corretor (cliente direto)</option>
                {corretores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="label">Imóvel</label>
            <input name="imovel" placeholder="Endereço ou empreendimento" className="field" />
          </div>
          <div>
            <label className="label">Valor do imóvel</label>
            <input name="valor_imovel" inputMode="decimal" placeholder="350.000,00" className="field" />
          </div>
          <div>
            <label className="label">Valor financiado</label>
            <input name="valor_financiado" inputMode="decimal" placeholder="280.000,00" className="field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observações</label>
            <textarea name="observacoes" className="field" />
          </div>
        </div>
      </fieldset>

      {avisoBoasVindas ? (
        <label className="card flex items-start gap-3 p-4 text-sm">
          <input type="checkbox" name="boas_vindas" defaultChecked className="mt-1" />
          <span>
            <strong>Mandar boas-vindas no WhatsApp do cliente</strong>
            <span className="block text-ink-soft">
              Ele recebe o link para acompanhar o processo a partir de agora.
            </span>
          </span>
        </label>
      ) : null}

      {erro ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{erro}</p> : null}
      <button className="btn btn-coral w-full sm:w-auto" disabled={pendente}>
        {pendente ? "Criando..." : textoBotao}
      </button>
    </form>
  );
}
