import { MarginLogo } from "@/components/brand/MarginLogo";
import { prisma } from "@/lib/db";
import { listNetworkStores } from "@/lib/franchise-network";
import { requireFranchiseSession } from "../actions";
import { FranchiseNav } from "../FranchiseNav";
import { FranchiseLogoutButton } from "../FranchiseLogoutButton";

export default async function FranchiseAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireFranchiseSession();
  const networkId = session.user.networkId!;
  const stores = await listNetworkStores(networkId);
  const network = await prisma.franchiseNetwork.findUnique({
    where: { id: networkId },
    select: { name: true },
  });

  return (
    <div className="franchise-shell">
      <aside className="franchise-rail">
        <div className="franchise-rail__brand">
          <MarginLogo tone="light" href="/franchise" className="franchise__logo" />
          <p className="franchise-rail__eyebrow">Franchise</p>
        </div>
        <p className="franchise-rail__name">
          {network?.name || session.user.restaurantName}
        </p>
        <FranchiseNav
          activeStoreId={session.user.restaurantId}
          stores={stores.map((s) => ({ id: s.id, name: s.name }))}
        />
        <div className="franchise-rail__logout">
          <FranchiseLogoutButton />
        </div>
      </aside>
      <div className="franchise-workspace">{children}</div>
    </div>
  );
}
