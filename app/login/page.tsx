import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { PrismaMark } from "@/components/Logo";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="min-h-dvh grid lg:grid-cols-2">
      <section className="brand-gradient hidden lg:flex flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white/10 p-2">
            <PrismaMark size={34} />
          </span>
          <span className="font-display text-2xl font-bold">Prisma</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Cada processo no lugar certo. Cada cliente sabendo onde está.
          </h1>
          <p className="mt-4 text-white/75">
            Etapas do financiamento organizadas, corretor por dentro e o cliente avisado no WhatsApp a cada
            avanço.
          </p>
        </div>
        <p className="text-sm text-white/50">Grupo NG</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="brand-gradient rounded-xl p-2">
              <PrismaMark size={28} />
            </span>
            <span className="font-display text-2xl font-bold">Prisma</span>
          </div>
          <h2 className="font-display text-2xl font-bold">Entrar no painel</h2>
          <p className="mt-1 text-sm text-ink-soft">Acesso da equipe do correspondente.</p>
          {erro === "sem-acesso" ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">
              Esse usuário não está ligado a nenhuma equipe.
            </p>
          ) : null}
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
