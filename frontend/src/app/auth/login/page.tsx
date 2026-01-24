import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-gray-900" />}>
      <LoginClient />
    </Suspense>
  );
}
