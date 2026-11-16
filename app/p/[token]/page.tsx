import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import { PrismaMark } from "@/components/Logo";
import Timeline from "@/components/Timeline";
import Upload from "@/components/Upload";
import { data, diasDesde, primeiroNome } from "@/lib/format";
import { linkWaMe } from "@/lib/whatsapp";
import { etapasDoCliente, processoPorToken } from "@/lib/portal";
import { prepararUploadCliente, registrarDocumentoCliente } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const d = await processoPorToken(token);
  return {
    title: d ? `Seu financiamento · ${d.p.organizacoes.nome}` : "Link inválido",
    robots: { index: false, follow: false },
  };
}

export default async function Acompanhamento({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const dados = await processoPorToken(token);
  if (!dados) notFound();
  const { p, etapas, eventos, pendencias } = dados;

  const { visiveis, idx } = etapasDoCliente(etapas, p.etapa_id);
  const atual = visiveis[idx];
  const concluido = p.status === "concluido";
  const cancelado = p.status === "cancelado";
  const nomeCli = new Map(etapas.map((e) => [e.id, e.nome_cliente || e.nome]));
  const progresso = visiveis.length > 1 ? Math.round((concluido ? 1 : idx / (visiveis.length - 1)) * 100) : 0;
  const dias = diasDesde(p.etapa_desde);
  const equipe = p.organizacoes.whatsapp_contato;
  const msgEquipe = `Oi! Sou ${p.clientes.nome}, do processo #${p.numero}. Tenho uma dúvida sobre o meu financiamento.`;

  return (
    <main className="min-h-dvh pb-16">
      <header className="brand-gradient px-4 pb-24 pt-6 text-white">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white/85">{p.organizacoes.nome}</div>
            <span className="chip bg-white/15 text-white">Processo #{p.numero}</span>
          </div>
          <h1 className="font-display mt-6 text-2xl font-bold">Olá, {primeiroNome(p.clientes.nome)}!</h1>
          <p className="mt-1 text-white/80">Aqui você acompanha cada passo do seu financiamento.</p>
        </div>
      </header>

      <div className="mx-auto -mt-16 max-w-xl space-y-4 px-4">
        {/* Etapa atual */}
        <section className="card p-5">
          {cancelado ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Situação</div>
              <div className="font-display mt-1 text-xl font-bold">Processo encerrado</div>
              <p className="mt-2 text-sm text-ink-soft">Este processo foi encerrado. Qualquer dúvida, fale com a equipe.</p>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-coral">
                {concluido ? "Concluído" : "Você está aqui"}
              </div>
              <div className="font-display mt-1 text-2xl font-bold leading-tight">
                {atual ? atual.nome_cliente || atual.nome : "Em andamento"}
              </div>
              {atual?.descricao_cliente ? <p className="mt-2 text-[15px] text-ink">{atual.descricao_cliente}</p> : null}
              {!concluido ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="chip bg-sky text-brand">
                    <Icon name="clock" size={12} /> Nesta etapa desde {data(p.etapa_desde)}
                  </span>
                  {atual?.prazo_dias ? (
                    <span className="chip bg-[#eef1f3] text-ink-soft">Costuma levar uns {atual.prazo_dias} dias</span>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-5">
                <div className="flex justify-between text-xs text-ink-soft">
                  <span>Progresso</span>
                  <span className="tnum">{progresso}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-coral" style={{ width: `${Math.max(progresso, 4)}%` }} />
                </div>
              </div>
              {!concluido && atual?.prazo_dias && dias > atual.prazo_dias ? (
                <p className="mt-4 rounded-lg bg-sky px-3 py-2 text-xs text-brand">
                  Esta etapa está levando um pouco mais que o normal. Isso acontece e a equipe já está acompanhando.
                </p>
              ) : null}
            </>
          )}
        </section>

        {/* Pendências */}
        {pendencias.length && !cancelado ? (
          <section className="card border-amber-300 p-5">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold">
              <Icon name="alert" size={18} className="text-warn" /> Precisamos de você
            </h2>
            <p className="text-sm text-ink-soft">Envie os documentos abaixo para o processo seguir. Pode ser foto ou PDF.</p>
            <ul className="mt-4 space-y-3">
              {pendencias.map((x) => (
                <li key={x.id} className="rounded-xl border border-line p-3">
                  <div className="font-semibold">{x.descricao}</div>
                  {x.status === "enviada" ? (
                    <p className="mt-1 flex items-center gap-1 text-sm text-ok">
                      <Icon name="check" size={14} /> Recebemos, a equipe vai conferir.
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <Upload
                      preparar={prepararUploadCliente.bind(null, token)}
                      registrar={registrarDocumentoCliente.bind(null, token, x.id)}
                      rotulo={x.status === "enviada" ? "Enviar outro arquivo" : "Enviar documento"}
                      className="btn btn-coral btn-sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Caminho */}
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">O caminho até o seu imóvel</h2>
          <ol className="mt-4">
            {visiveis.map((e, i) => {
              const feito = concluido || i < idx;
              const agora = !concluido && i === idx;
              return (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < visiveis.length - 1 ? (
                    <span className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${feito ? "bg-brand" : "bg-line"}`} />
                  ) : null}
                  <span
                    className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                      feito
                        ? "border-brand bg-brand text-white"
                        : agora
                          ? "border-coral bg-white text-coral ring-4 ring-coral/15"
                          : "border-line bg-white text-ink-soft"
                    }`}
                  >
                    {feito ? <Icon name="check" size={14} /> : i + 1}
                  </span>
                  <div className="pt-0.5">
                    <div className={`text-sm ${agora ? "font-bold text-ink" : feito ? "font-semibold text-ink" : "text-ink-soft"}`}>
                      {e.nome_cliente || e.nome}
                    </div>
                    {agora || (!feito && e.descricao_cliente) ? (
                      <p className={`mt-0.5 text-xs ${agora ? "text-ink-soft" : "text-ink-soft/80"}`}>{e.descricao_cliente}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Novidades */}
        <section className="card p-5">
          <h2 className="font-display mb-4 text-lg font-bold">Novidades</h2>
          <Timeline eventos={eventos} nomesEtapa={nomeCli} visaoCliente />
        </section>

        {/* Contato */}
        <section className="card space-y-3 p-5">
          <h2 className="font-display text-lg font-bold">Ficou com dúvida?</h2>
          <p className="text-sm text-ink-soft">
            Toda novidade aparece aqui e chega no seu WhatsApp. Se precisar, fale com a gente.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {equipe ? (
              <a href={linkWaMe(equipe, msgEquipe)} target="_blank" rel="noreferrer" className="btn btn-wpp flex-1">
                <Icon name="chat" size={16} /> Falar com a equipe
              </a>
            ) : null}
            {p.corretores?.telefone ? (
              <a
                href={linkWaMe(p.corretores.telefone, `Oi, ${primeiroNome(p.corretores.nome)}! Sou ${p.clientes.nome}.`)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost flex-1"
              >
                <Icon name="user" size={16} /> Falar com {primeiroNome(p.corretores.nome)}
              </a>
            ) : null}
          </div>
        </section>

        <footer className="flex items-center justify-center gap-2 pt-4 text-xs text-ink-soft">
          <span className="brand-gradient rounded-md p-0.5">
            <PrismaMark size={16} />
          </span>
          Acompanhamento por Prisma
        </footer>
      </div>
    </main>
  );
}
