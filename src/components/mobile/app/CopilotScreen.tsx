"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ancien onglet Copilote → accueil (LLM). */
export function CopilotScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
