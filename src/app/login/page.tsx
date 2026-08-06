import { Suspense } from "react";
import { isDemoAutoLoginEnabled } from "@/lib/demo-login";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  const allowDemo = isDemoAutoLoginEnabled();

  return (
    <Suspense
      fallback={
        <div className="marketing flex min-h-screen items-center justify-center">
          Connexion…
        </div>
      }
    >
      <LoginForm allowDemo={allowDemo} />
    </Suspense>
  );
}
