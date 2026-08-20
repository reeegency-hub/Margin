import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="marketing flex min-h-screen items-center justify-center">
          Connexion…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
