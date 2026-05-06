import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in · WalletLens" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md flex-col justify-center px-4 py-10">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
