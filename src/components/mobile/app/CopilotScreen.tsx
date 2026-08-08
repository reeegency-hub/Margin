"use client";

import { MarginAssistant } from "@/components/assistant/MarginAssistant";
import "@/components/mobile/app/mobile-app.css";

/** Accueil mobile = copilote uniquement. */
export function CopilotScreen() {
  return (
    <div className="mapp mapp-copilot">
      <MarginAssistant expanded onExpandedChange={() => {}} layout="page" />
    </div>
  );
}
