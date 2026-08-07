/**
 * Commit serveur uniquement après Zod.parse + confirmation client.
 */
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { defaultThresholdForIngredient } from "@/lib/catalog/thresholds";
import { normalizeUnit, sanitizeAssistantText } from "@/lib/assistant";
import {
  createShiftForEmployee,
  defaultHourlyRate,
} from "@/lib/employee-engine";
import {
  parseImportInventory,
  parseSetWhatsapp,
  parseUpsertTeam,
  type AmbiguityFlag,
} from "@/lib/assistant/schemas";
import {
  hasBlockingFlags,
  markDraftCommitted,
  writeAssistantCommit,
} from "@/lib/assistant/drafts";
import { findShiftOverlaps } from "@/lib/assistant/extract";
import { getNotifier, getNotifierChannel } from "@/lib/notifications";

function nameKey(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function commitImportInventory(input: {
  restaurantId: string;
  userId?: string | null;
  draftId: string;
  payload: unknown;
  flags: AmbiguityFlag[];
}) {
  if (hasBlockingFlags(input.flags)) {
    return {
      ok: false as const,
      error: "Des ambiguïtés bloquantes restent — corrigez l’aperçu.",
    };
  }
  const parsed = parseImportInventory({
    ...(typeof input.payload === "object" && input.payload
      ? input.payload
      : {}),
    storeId: input.restaurantId,
  });
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error, issues: parsed.issues };
  }
  if (parsed.data.storeId !== input.restaurantId) {
    return { ok: false as const, error: "storeId ne correspond pas à la session." };
  }

  const existing = await prisma.ingredient.findMany({
    where: { restaurantId: input.restaurantId },
    select: { id: true, name: true },
  });
  const known = new Map(existing.map((e) => [nameKey(e.name), e.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of parsed.data.rows) {
    if (row.blocked) {
      skipped += 1;
      continue;
    }
    const name = sanitizeAssistantText(row.name, 120);
    if (!name) continue;
    const key = nameKey(name);
    const unit = normalizeUnit(row.unit);
    const thr = defaultThresholdForIngredient(name, unit);
    const data = {
      unit,
      stockTheoretical: Math.max(0, row.stock),
      criticalThreshold:
        row.threshold != null ? row.threshold : thr.criticalThreshold,
      reorderQty: thr.reorderQty,
      lastPurchasePrice: row.price ?? undefined,
    };

    const existingId = known.get(key);
    if (existingId) {
      await prisma.ingredient.update({
        where: { id: existingId },
        data,
      });
      updated += 1;
    } else {
      const createdRow = await prisma.ingredient.create({
        data: {
          restaurantId: input.restaurantId,
          name,
          ...data,
        },
      });
      known.set(key, createdRow.id);
      created += 1;
    }
  }

  const result = {
    created,
    updated,
    skipped,
    sourceFileId: parsed.data.sourceFileId,
  };
  const commit = await writeAssistantCommit({
    restaurantId: input.restaurantId,
    draftId: input.draftId,
    kind: "import_inventory",
    userId: input.userId,
    result,
  });
  await markDraftCommitted(input.restaurantId, input.draftId, commit.id);
  revalidatePath("/ingredients");
  revalidatePath("/");
  return { ok: true as const, result, commitId: commit.id };
}

export async function commitUpsertTeam(input: {
  restaurantId: string;
  userId?: string | null;
  draftId: string;
  payload: unknown;
  flags: AmbiguityFlag[];
}) {
  const overlapFlags = Array.isArray(
    (input.payload as { employees?: { shifts?: unknown }[] })?.employees
  )
    ? (
        input.payload as {
          employees: { name: string; shifts?: { date: string; startTime: string; endTime: string }[] }[];
        }
      ).employees.flatMap((e) =>
        findShiftOverlaps(e.shifts || []).map((f) => ({
          ...f,
          message: `${e.name} — ${f.message}`,
        }))
      )
    : [];
  const flags = [...input.flags, ...overlapFlags];
  if (hasBlockingFlags(flags)) {
    return {
      ok: false as const,
      error: "Chevauchements ou ambiguïtés bloquantes — corrigez l’aperçu.",
      flags,
    };
  }

  const parsed = parseUpsertTeam({
    ...(typeof input.payload === "object" && input.payload
      ? input.payload
      : {}),
    storeId: input.restaurantId,
  });
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error, issues: parsed.issues };
  }

  let employeesCreated = 0;
  let shiftsCreated = 0;

  for (const emp of parsed.data.employees) {
    const name = sanitizeAssistantText(emp.name, 80);
    if (!name) continue;
    const role = emp.role || "salle";
    let row = await prisma.employee.findFirst({
      where: {
        restaurantId: input.restaurantId,
        active: true,
        name,
      },
    });
    if (!row) {
      const all = await prisma.employee.findMany({
        where: { restaurantId: input.restaurantId, active: true },
      });
      row = all.find((e) => nameKey(e.name) === nameKey(name)) || null;
    }

    if (!row) {
      row = await prisma.employee.create({
        data: {
          restaurantId: input.restaurantId,
          name,
          role,
          hourlyRate: emp.hourlyRate ?? defaultHourlyRate(role),
          active: true,
        },
      });
      employeesCreated += 1;
    }

    for (const s of emp.shifts || []) {
      await createShiftForEmployee(input.restaurantId, {
        employeeId: row.id,
        date: startOfDay(new Date(`${s.date}T12:00:00`)),
        startTime: s.startTime,
        endTime: s.endTime,
        role: s.role || role,
      });
      shiftsCreated += 1;
    }
  }

  const result = { employeesCreated, shiftsCreated };
  const commit = await writeAssistantCommit({
    restaurantId: input.restaurantId,
    draftId: input.draftId,
    kind: "upsert_team",
    userId: input.userId,
    result,
  });
  await markDraftCommitted(input.restaurantId, input.draftId, commit.id);
  revalidatePath("/employees");
  revalidatePath("/employees/planning");
  return { ok: true as const, result, commitId: commit.id };
}

export async function commitSetWhatsapp(input: {
  restaurantId: string;
  userId?: string | null;
  draftId: string;
  payload: unknown;
  flags: AmbiguityFlag[];
}) {
  if (hasBlockingFlags(input.flags)) {
    return { ok: false as const, error: "Numéro invalide — corrigez." };
  }
  const parsed = parseSetWhatsapp({
    ...(typeof input.payload === "object" && input.payload
      ? input.payload
      : {}),
    storeId: input.restaurantId,
  });
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error, issues: parsed.issues };
  }

  await prisma.restaurant.update({
    where: { id: input.restaurantId },
    data: { whatsappTo: parsed.data.phone },
  });

  let testSent = false;
  let testSimulated = false;
  if (parsed.data.sendTest) {
    try {
      const notifier = getNotifier();
      await notifier.send({
        to: parsed.data.phone,
        body: "Margin — numéro enregistré. Vous recevrez ici alertes stock et listes de courses.",
        restaurantId: input.restaurantId,
        purpose: "other",
        allowSessionFreeform: true,
      });
      testSent = true;
      testSimulated = getNotifierChannel() === "console";
    } catch {
      testSent = false;
    }
  }

  const result = {
    phone: parsed.data.phone,
    testSent,
    testSimulated,
  };
  const commit = await writeAssistantCommit({
    restaurantId: input.restaurantId,
    draftId: input.draftId,
    kind: "set_whatsapp",
    userId: input.userId,
    result,
  });
  await markDraftCommitted(input.restaurantId, input.draftId, commit.id);
  revalidatePath("/settings");
  return { ok: true as const, result, commitId: commit.id };
}
