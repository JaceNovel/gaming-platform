import { Suspense } from "react";
import ForgotPasswordClient from "./ForgotPasswordClient";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-gray-900" />}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
