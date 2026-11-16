import Link from "next/link";
import type { Metadata } from "next";
import { getSessao } from "@/lib/sessao";
import Icon from "@/components/Icon";
import { dataHora, telefoneBonito } from "@/lib/format";
import { linkWaMe } from "@/lib/whatsapp";
import type { Notificacao } from "@/lib/types";
import { marcarEnviadaManual, reenviarNotificacao } from "../processos/actions";

export const metadata: Metadata = { title: "Mensagens" };

const COR: Record<string, string> = {
  enviada: "bg-emerald-50 text-ok",
  pendente: "bg-sky text-brand",
  falhou: "bg-red-50 text-bad",
  manual: "bg-amber-50 text-warn",
};
const ROTULO: Record<string, string> = { enviada: "enviada", pendente: "na fila", falhou: "falhou", manual: "enviar à mão" };
const MOTIVO: Record<string, string> = {
  etapa: "Mudança de etapa",
  boas_vindas: "Boas-vindas",
  recado: "Recado",
  pendencia: "Pedido de documento",
  lembrete_pendencia: "Lembrete de documento",
  sem_novidade: "Sem novidade",
  acesso: "Acesso do corretor",
};

type Linha = Notificacao & { processos: { numero: number; clientes: { nome: string } | null } | null };

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const { supabase } = await getSessao();
  let q = supabase
    .from("notificacoes")
    .select("*, processos(numero, clientes(nome))")
    .order("criado_em", { ascending: false })
    .limit(100);
  if (ver !== "todas") q = q.in("status", ["manual", "falhou", "pendente"]);
  const { data: lista } = await q.returns<Linha[]>();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Mensagens</h1>
      <p className="text-sm text-ink-soft">
        Tudo que o Prisma mandou ou tentou mandar no WhatsApp. Enquanto o envio automático não estiver ligado, as
        mensagens ficam aqui prontas para você mandar com um clique.
      </p>

      <div className="mt-4 flex gap-2">
        <Link href="/app/whatsapp" className={`rounded-full border px-4 py-1.5 text-sm ${ver !== "todas" ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
          Precisam de ação
        </Link>
        <Link href="/app/whatsapp?ver=todas" className={`rounded-full border px-4 py-1.5 text-sm ${ver === "todas" ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
          Todas
        </Link>
      </div>

      <ul className="mt-5 space-y-3">
        {(lista ?? []).map((n) => (
          <li key={n.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`chip ${COR[n.status]}`}>{ROTULO[n.status]}</span>
              <span className="font-semibold">{MOTIVO[n.motivo ?? ""] ?? n.motivo}</span>
              <span className="text-ink-soft">
                para {n.destino === "cliente" ? "cliente" : "corretor"} {telefoneBonito(n.telefone)}
              </span>
              {n.processos ? (
                <Link href={`/app/processos/${n.processo_id}`} className="text-brand hover:underline">
                  #{n.processos.numero} {n.processos.clientes?.nome}
                </Link>
              ) : null}
              <span className="ml-auto text-xs text-ink-soft">{dataHora(n.criado_em)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{n.mensagem}</p>
            {n.status === "falhou" && n.erro ? <p className="mt-1 text-xs text-bad">{n.erro}</p> : null}
            {n.status !== "enviada" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={linkWaMe(n.telefone, n.mensagem)} target="_blank" rel="noreferrer" className="btn btn-wpp btn-sm">
                  <Icon name="chat" size={14} /> Abrir no WhatsApp
                </a>
                <form action={marcarEnviadaManual}>
                  <input type="hidden" name="notificacao_id" value={n.id} />
                  <button className="btn btn-ghost btn-sm">
                    <Icon name="check" size={14} /> Já enviei
                  </button>
                </form>
                <form action={reenviarNotificacao}>
                  <input type="hidden" name="notificacao_id" value={n.id} />
                  <button className="btn btn-ghost btn-sm">Tentar automático</button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
        {!lista?.length ? (
          <li className="card p-8 text-center text-sm text-ink-soft">
            {ver === "todas" ? "Nenhuma mensagem ainda." : "Nada pendente. Tudo enviado."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
