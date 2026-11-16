export function siteUrl() {
  const u =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return u.replace(/\/+$/, "");
}

export const linkCliente = (token: string) => `${siteUrl()}/p/${token}`;
export const linkCorretor = (token: string) => `${siteUrl()}/c/${token}`;
