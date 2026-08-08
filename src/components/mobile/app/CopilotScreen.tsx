"use client";

import { useEffect, useState } from "react";
import {
  MarginAssistant,
  readExpandedDefault,
} from "@/components/assistant/MarginAssistant";
import "@/components/mobile/app/mobile-app.css";

/**
 * Onglet Copilote — plein écran via le même moteur que le dock desktop,
 * sans modifier le comportement dock pour le desktop.
 */
export function CopilotScreen() {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setExpanded(true);
    // Prefill depuis le dashboard « Ask Anything »
    try {
      const pending = sessionStorage.getItem("margin:mobile-ask");
      if (pending) {
        sessionStorage.removeItem("margin:mobile-ask");
        window.dispatchEvent(
          new CustomEvent("margin:assistant-prefill", { detail: { text: pending } })
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="mapp mapp-copilot">
      <MarginAssistant
        expanded={expanded || readExpandedDefault()}
        onExpandedChange={setExpanded}
        layout="page"
      />
    </div>
  );
}
