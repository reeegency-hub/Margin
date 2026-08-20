import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  requireFranchiseSession,
  switchFranchiseStoreAction,
} from "../../../actions";
import { userCanAccessRestaurant } from "@/lib/franchise-network";

/**
 * Ops boutique : vérifie membership + aligne la boutique active sur [id].
 */
export default async function FranchiseStoreOpsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await requireFranchiseSession();
  const { id } = await params;

  const allowed = await userCanAccessRestaurant(session.user.id, id);
  if (!allowed) notFound();

  const store = await prisma.restaurant.findFirst({
    where: { id, networkId: session.user.networkId! },
    select: { id: true },
  });
  if (!store) notFound();

  if (session.user.restaurantId !== id) {
    const switched = await switchFranchiseStoreAction(id);
    if (!switched.ok) {
      redirect(
        `/franchise/stores/${id}?error=${encodeURIComponent(switched.error)}`
      );
    }
  }

  return <>{children}</>;
}
