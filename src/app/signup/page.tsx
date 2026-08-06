import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";
import { isSignupOtpSmsConfigured } from "@/lib/signup-otp";

export default function SignupPage() {
  const smsAvailable = isSignupOtpSmsConfigured();

  return (
    <Suspense
      fallback={
        <div className="marketing flex min-h-screen items-center justify-center">
          Chargement…
        </div>
      }
    >
      <SignupForm smsAvailable={smsAvailable} />
    </Suspense>
  );
}
