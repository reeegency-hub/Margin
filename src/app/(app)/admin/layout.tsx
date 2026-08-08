import { redirect } from "next/navigation";
import {
  ForbiddenError,
  UnauthorizedError,
  requireRole,
} from "@/lib/auth/require-role";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("FOUNDER");
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login?error=session");
    }
    if (err instanceof ForbiddenError) {
      redirect("/");
    }
    throw err;
  }

  return <>{children}</>;
}
