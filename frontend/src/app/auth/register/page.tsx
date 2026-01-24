import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-gray-900" />}>
      <RegisterClient />
    </Suspense>
  );
}
