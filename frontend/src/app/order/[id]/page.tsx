import { redirect } from "next/navigation";

export default async function LegacyOrderRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/orders/${encodeURIComponent(String(id ?? "").trim())}`);
}
