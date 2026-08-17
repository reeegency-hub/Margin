import { ModuleGridItem } from "./ModuleGridItem";
import {
  IconBox,
  IconFinance,
  IconUtensils,
  IconTeam,
  IconBag,
  IconShield,
  IconBolt,
} from "./icons";

const modules = [
  { href: "/ingredients", label: "Stock", icon: <IconBox className="h-6 w-6" /> },
  { href: "/orders", label: "Courses", icon: <IconBag className="h-6 w-6" /> },
  { href: "/inventory", label: "Inventaire", icon: <IconShield className="h-6 w-6" /> },
  { href: "/kiosks", label: "Caisse", icon: <IconBolt className="h-6 w-6" /> },
  { href: "/sales", label: "Hors caisse", icon: <IconUtensils className="h-6 w-6" /> },
  { href: "/ingredients?tab=catalogue", label: "Produits", icon: <IconUtensils className="h-6 w-6" /> },
  { href: "/ingredients/menu", label: "Import", icon: <IconBolt className="h-6 w-6" /> },
  { href: "/settings", label: "Finance", icon: <IconFinance className="h-6 w-6" /> },
  { href: "/employees", label: "Équipe", icon: <IconTeam className="h-6 w-6" /> },
];

export function ModuleGrid() {
  return (
    <section className="mt-7">
      <p className="home-muted mb-3 text-[15px] font-medium">Modules</p>
      <div className="grid grid-cols-4 gap-y-4">
        {modules.map((m) => (
          <ModuleGridItem key={m.label} {...m} />
        ))}
      </div>
    </section>
  );
}
