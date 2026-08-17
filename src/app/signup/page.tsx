import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";
import {
  isSignupOtpEmailConfigured,
  isSignupOtpSmsConfigured,
} from "@/lib/signup-otp";

export default function SignupPage() {
  const smsAvailable = isSignupOtpSmsConfigured();
  const otpRequired =
    isSignupOtpEmailConfigured() || isSignupOtpSmsConfigured();

  return (
    <Suspense
      fallback={
        <div className="marketing flex min-h-screen items-center justify-center">
          Chargement…
        </div>
      }
    >
      <SignupForm smsAvailable={smsAvailable} otpRequired={otpRequired} />
    </Suspense>
  );
}
