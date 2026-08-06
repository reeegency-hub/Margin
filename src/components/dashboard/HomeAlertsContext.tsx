"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "margin-home-alert-hidden";

type HomeAlertsContextValue = {
  /** Masquer la carte « À faire » inline (popup déjà vu cette connexion). */
  hideInlineAlert: boolean;
  /** Après affichage / fermeture du popup cette session. */
  markInlineAlertHandled: (fingerprint: string) => void;
  /** Aligne l’état inline sur la session (une fois vu → masqué). */
  syncFingerprint: (fingerprint: string) => void;
};

const HomeAlertsContext = createContext<HomeAlertsContextValue | null>(null);

function readSessionHandled(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSessionHandled() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function HomeAlertsProvider({ children }: { children: ReactNode }) {
  const [hideInlineAlert, setHideInlineAlert] = useState(false);

  const syncFingerprint = useCallback((_fingerprint: string) => {
    setHideInlineAlert(readSessionHandled());
  }, []);

  const markInlineAlertHandled = useCallback((_fingerprint: string) => {
    writeSessionHandled();
    setHideInlineAlert(true);
  }, []);

  const value = useMemo(
    () => ({ hideInlineAlert, markInlineAlertHandled, syncFingerprint }),
    [hideInlineAlert, markInlineAlertHandled, syncFingerprint]
  );

  return (
    <HomeAlertsContext.Provider value={value}>
      {children}
    </HomeAlertsContext.Provider>
  );
}

export function useHomeAlerts() {
  return useContext(HomeAlertsContext);
}
