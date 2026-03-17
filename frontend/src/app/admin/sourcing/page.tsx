import { redirect } from "next/navigation";

export default async function AdminSourcingIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const platform = resolvedSearchParams?.platform === "aliexpress" ? "aliexpress" : "alibaba";
  redirect(`/admin/sourcing/dashboard?platform=${platform}`);
}