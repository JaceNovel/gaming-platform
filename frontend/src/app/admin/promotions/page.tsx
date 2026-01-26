import { redirect } from "next/navigation";

export default function AdminPromotionsIndexPage() {
  redirect("/admin/promotions/list");
}
