"use client";

import { signOut } from "next-auth/react";

export function FranchiseLogoutButton() {
  return (
    <button
      type="button"
      className="franchise-rail__logout-btn"
      onClick={() => void signOut({ callbackUrl: "/login" })}
    >
      Déconnexion
    </button>
  );
}
