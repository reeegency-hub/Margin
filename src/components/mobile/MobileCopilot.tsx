"use client";

/**
 * Point d’entrée copilote mobile — aujourd’hui délègue à MarginAssistant
 * (plein focus via le shell). Isolé pour évoluer sans toucher le desktop.
 */
export {
  MarginAssistant as MobileCopilot,
} from "@/components/assistant/MarginAssistant";
