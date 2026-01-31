import { Suspense } from "react";
import PaymentReturnClient from "./PaymentReturnClient";

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={null}>
      <PaymentReturnClient />
    </Suspense>
  );
}
