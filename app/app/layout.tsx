import { getSessao } from "@/lib/sessao";
import Nav from "./Nav";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const { membro, org } = await getSessao();
  return (
    <div className="min-h-dvh lg:flex">
      <Nav empresa={org.nome} nome={membro.nome} admin={membro.papel === "admin"} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
