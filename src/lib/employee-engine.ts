import { addDays, startOfDay } from "date-fns";
import { prisma, type TenantDb } from "@/lib/db";
import { roleLabel } from "@/lib/employee-constants";

export {
  DEFAULT_HOURLY_RATES,
  ROLE_LABEL,
  defaultHourlyRate,
  roleLabel,
} from "@/lib/employee-constants";

/** Fallback if restaurant staff counts are unset. */
const RECOMMENDED_FALLBACK: Record<string, number> = {
  salle: 1,
  cuisine: 2,
  livreur: 1,
};

export type StaffingAlert = {
  date: Date;
  role: string;
  planned: number;
  recommended: number;
  impact: string;
  action: string;
};

export async function getTodayPresence(restaurantId: string) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const employees = await prisma.employee.findMany({
    where: { restaurantId, active: true },
    orderBy: { name: "asc" },
  });

  const shifts = await prisma.shift.findMany({
    where: {
      employee: { restaurantId },
      date: { gte: today, lt: tomorrow },
    },
    include: {
      employee: true,
      attendances: true,
    },
    orderBy: { startTime: "asc" },
  });

  return { employees, shifts, today };
}

export async function getWeekShifts(restaurantId: string) {
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);

  return prisma.shift.findMany({
    where: {
      employee: { restaurantId },
      date: { gte: today, lt: weekEnd },
    },
    include: { employee: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function listActiveEmployees(
  restaurantId: string,
  db: TenantDb = prisma
) {
  return db.employee.findMany({
    where: { restaurantId, active: true },
    orderBy: { name: "asc" },
  });
}

/** Default service window by role for onboarding / quick plan. */
export function defaultShiftTimes(role: string): {
  startTime: string;
  endTime: string;
} {
  if (role === "cuisine") return { startTime: "17:00", endTime: "23:30" };
  if (role === "livreur") return { startTime: "18:00", endTime: "22:30" };
  return { startTime: "18:00", endTime: "23:00" };
}

/** Create today's shifts for every active employee who has none yet. */
export async function ensureTodayShifts(
  restaurantId: string,
  db: TenantDb = prisma
) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const employees = await listActiveEmployees(restaurantId, db);
  const existing = await db.shift.findMany({
    where: {
      employee: { restaurantId },
      date: { gte: today, lt: tomorrow },
    },
    select: { employeeId: true },
  });
  const already = new Set(existing.map((s) => s.employeeId));
  const toCreate = employees.filter((e) => !already.has(e.id));
  if (!toCreate.length) return { created: 0 };

  await db.shift.createMany({
    data: toCreate.map((e) => {
      const times = defaultShiftTimes(e.role);
      return {
        employeeId: e.id,
        date: today,
        startTime: times.startTime,
        endTime: times.endTime,
        role: e.role,
        status: "PUBLISHED",
      };
    }),
  });
  return { created: toCreate.length };
}

export async function createShiftForEmployee(
  restaurantId: string,
  data: {
    employeeId: string;
    date: Date;
    startTime: string;
    endTime: string;
    role?: string;
  },
  db: TenantDb = prisma
) {
  const employee = await db.employee.findFirst({
    where: { id: data.employeeId, restaurantId, active: true },
  });
  if (!employee) throw new Error("Employé introuvable");

  return db.shift.create({
    data: {
      employeeId: employee.id,
      date: startOfDay(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      role: data.role || employee.role,
      status: "PUBLISHED",
    },
  });
}

export async function deleteShiftForRestaurant(
  restaurantId: string,
  shiftId: string,
  db: TenantDb = prisma
) {
  const shift = await db.shift.findFirst({
    where: { id: shiftId, employee: { restaurantId } },
  });
  if (!shift) throw new Error("Créneau introuvable");
  await db.attendance.deleteMany({
    where: { shiftId, employee: { restaurantId } },
  });
  await db.shift.deleteMany({
    where: { id: shiftId, employee: { restaurantId } },
  });
}

export async function renameEmployee(
  restaurantId: string,
  employeeId: string,
  name: string,
  db: TenantDb = prisma
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nom requis");
  const employee = await db.employee.findFirst({
    where: { id: employeeId, restaurantId },
  });
  if (!employee) throw new Error("Employé introuvable");
  await db.employee.updateMany({
    where: { id: employeeId, restaurantId },
    data: { name: trimmed },
  });
  return db.employee.findFirst({ where: { id: employeeId, restaurantId } });
}

export async function updateEmployeeHourlyRate(
  restaurantId: string,
  employeeId: string,
  hourlyRate: number,
  db: TenantDb = prisma
) {
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 200) {
    throw new Error("Salaire horaire invalide");
  }
  const employee = await db.employee.findFirst({
    where: { id: employeeId, restaurantId, active: true },
  });
  if (!employee) throw new Error("Employé introuvable");
  const rounded = Math.round(hourlyRate * 100) / 100;
  if (employee.hourlyRate === rounded) return employee;
  await db.employee.updateMany({
    where: { id: employeeId, restaurantId, active: true },
    data: { hourlyRate: rounded },
  });
  return db.employee.findFirst({
    where: { id: employeeId, restaurantId },
  });
}

export async function detectUnderstaffing(
  restaurantId: string
): Promise<StaffingAlert[]> {
  const today = startOfDay(new Date());
  const horizon = addDays(today, 7);
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { staffSalle: true, staffCuisine: true, staffLivreur: true },
  });
  const recommendedByRole: Record<string, number> = {
    salle: restaurant?.staffSalle || RECOMMENDED_FALLBACK.salle,
    cuisine: restaurant?.staffCuisine || RECOMMENDED_FALLBACK.cuisine,
    livreur: restaurant?.staffLivreur || RECOMMENDED_FALLBACK.livreur,
  };

  const shifts = await prisma.shift.findMany({
    where: {
      employee: { restaurantId, active: true },
      date: { gte: today, lt: horizon },
      status: "PUBLISHED",
    },
  });

  const byDayRole = new Map<string, number>();
  for (const s of shifts) {
    const key = `${startOfDay(s.date).toISOString()}|${s.role}`;
    byDayRole.set(key, (byDayRole.get(key) ?? 0) + 1);
  }

  const alerts: StaffingAlert[] = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(today, d);
    for (const [role, recommended] of Object.entries(recommendedByRole)) {
      if (recommended < 1) continue;
      const key = `${startOfDay(date).toISOString()}|${role}`;
      const planned = byDayRole.get(key) ?? 0;
      if (planned >= recommended) continue;

      const isFriday = date.getDay() === 5;
      const boost = isFriday ? " (vendredi soir — affluence forte)" : "";
      alerts.push({
        date,
        role,
        planned,
        recommended,
        impact: `Sous-effectif${boost} : ${planned}/${recommended} en ${roleLabel(role)}. Risque de rayon mal tenu ou de file d’attente en caisse.`,
        action: `Proposer une heure sup à un employé ${roleLabel(role)} disponible — ou ajuster le planning.`,
      });
    }
  }

  // Persist RH alert for nearest understaffing if none active
  if (alerts.length > 0) {
    const first = alerts[0];
    const existing = await prisma.alert.findFirst({
      where: {
        restaurantId,
        type: "ACTION_URGENT",
        status: "ACTIVE",
        title: { contains: "Sous-effectif" },
      },
    });
    if (!existing) {
      await prisma.alert.create({
        data: {
          restaurantId,
          type: "ACTION_URGENT",
          severity: 2,
          status: "ACTIVE",
          title: `Sous-effectif — ${roleLabel(first.role)}`,
          constat: `Effectif planifié ${roleLabel(first.role)} : ${first.planned} (recommandé : ${first.recommended}).`,
          cause: first.date.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          impact: first.impact,
          action: first.action,
        },
      });
    }
  }

  return alerts;
}

function normalizePersonQuery(q: string) {
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findEmployeeMatch<T extends { name: string }>(
  employees: T[],
  query: string
): T | null {
  const q = normalizePersonQuery(query);
  if (!q) return null;
  const exact = employees.find(
    (e) => normalizePersonQuery(e.name) === q
  );
  if (exact) return exact;
  const first = employees.find((e) =>
    normalizePersonQuery(e.name).startsWith(q)
  );
  if (first) return first;
  return (
    employees.find((e) => normalizePersonQuery(e.name).includes(q)) ?? null
  );
}

function timeOnDate(date: Date, hours: number, minutes: number) {
  const d = startOfDay(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function parseHhMm(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h, minutes: m || 0 };
}

export async function clockInEmployee(
  restaurantId: string,
  employeeId: string,
  shiftId: string,
  clockInAt?: Date,
  db: TenantDb = prisma
) {
  const shift = await db.shift.findFirst({
    where: {
      id: shiftId,
      employeeId,
      employee: { restaurantId },
    },
  });
  if (!shift) throw new Error("Shift introuvable");

  const [h, m] = shift.startTime.split(":").map(Number);
  const planned = new Date(shift.date);
  planned.setHours(h, m, 0, 0);
  const at = clockInAt ?? new Date();
  const lateMinutes = Math.max(
    0,
    Math.round((at.getTime() - planned.getTime()) / 60000)
  );

  const existing = await db.attendance.findFirst({
    where: { shiftId, employeeId },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await db.attendance.updateMany({
      where: {
        id: existing.id,
        employeeId,
        employee: { restaurantId },
      },
      data: {
        clockIn: at,
        lateMinutes,
        status: lateMinutes > 5 ? "LATE" : "PRESENT",
      },
    });
    return db.attendance.findFirst({
      where: { id: existing.id, employee: { restaurantId } },
    });
  }

  return db.attendance.create({
    data: {
      employeeId,
      shiftId,
      clockIn: at,
      lateMinutes,
      status: lateMinutes > 5 ? "LATE" : "PRESENT",
    },
  });
}

/** Pointage WhatsApp : « Julie 18:05 » */
export async function clockInByName(
  restaurantId: string,
  nameQuery: string,
  arrival: { hours: number; minutes: number }
) {
  const employees = await listActiveEmployees(restaurantId);
  const employee = findEmployeeMatch(employees, nameQuery);
  if (!employee) {
    return {
      ok: false as const,
      error: `Personne introuvable pour « ${nameQuery} ». Vérifiez le prénom dans Équipe.`,
    };
  }

  await ensureTodayShifts(restaurantId);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const shift = await prisma.shift.findFirst({
    where: {
      employeeId: employee.id,
      employee: { restaurantId },
      date: { gte: today, lt: tomorrow },
    },
    orderBy: { startTime: "asc" },
  });
  if (!shift) {
    return {
      ok: false as const,
      error: `Pas de créneau aujourd’hui pour ${employee.name}.`,
    };
  }

  const clockIn = timeOnDate(today, arrival.hours, arrival.minutes);
  const attendance = await clockInEmployee(
    restaurantId,
    employee.id,
    shift.id,
    clockIn
  );
  if (!attendance) {
    return {
      ok: false as const,
      error: `Pointage impossible pour ${employee.name}.`,
    };
  }

  return {
    ok: true as const,
    employee: employee.name,
    role: employee.role,
    clockIn,
    lateMinutes: attendance.lateMinutes,
    status: attendance.status,
  };
}

/** Sortie WhatsApp : « Julie départ 23:00 » */
export async function clockOutByName(
  restaurantId: string,
  nameQuery: string,
  departure: { hours: number; minutes: number }
) {
  const employees = await listActiveEmployees(restaurantId);
  const employee = findEmployeeMatch(employees, nameQuery);
  if (!employee) {
    return {
      ok: false as const,
      error: `Personne introuvable pour « ${nameQuery} ».`,
    };
  }

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      employee: { restaurantId },
      status: { in: ["PRESENT", "LATE"] },
      OR: [
        { clockIn: { gte: today, lt: tomorrow } },
        {
          shift: {
            date: { gte: today, lt: tomorrow },
          },
        },
      ],
    },
    include: { shift: true },
    orderBy: { createdAt: "desc" },
  });

  if (!attendance) {
    return {
      ok: false as const,
      error: `${employee.name} n’a pas encore pointé aujourd’hui. Envoyez d’abord « ${employee.name.split(" ")[0]} HH:MM ».`,
    };
  }

  const clockOut = timeOnDate(today, departure.hours, departure.minutes);
  if (attendance.clockIn && clockOut < attendance.clockIn) {
    return {
      ok: false as const,
      error: `L’heure de départ est avant l’arrivée pour ${employee.name}.`,
    };
  }

  await prisma.attendance.updateMany({
    where: {
      id: attendance.id,
      employeeId: employee.id,
      employee: { restaurantId },
    },
    data: { clockOut },
  });

  const hours =
    attendance.clockIn
      ? Math.max(
          0,
          (clockOut.getTime() - attendance.clockIn.getTime()) / 3_600_000
        )
      : 0;

  return {
    ok: true as const,
    employee: employee.name,
    clockOut,
    hours,
  };
}

export type PointageParse =
  | { kind: "in" | "out"; name: string; hours: number; minutes: number }
  | null;

/** Parse « Julie 18:05 », « pointage Julie 18h05 », « Julie départ 23:00 ». */
export function parsePointageMessage(text: string): PointageParse {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return null;

  const timeRe = "(\\d{1,2})\\s*[:hH]\\s*(\\d{2})?";
  const pack = (
    kind: "in" | "out",
    name: string,
    h: string,
    m?: string
  ): PointageParse => {
    const hours = Number(h);
    const minutes = Number(m ?? "0");
    if (
      !name ||
      name.length < 2 ||
      hours > 23 ||
      minutes > 59 ||
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return null;
    }
    return { kind, name: name.trim(), hours, minutes };
  };

  const outA = new RegExp(
    `^(?:départ|depart|parti|sortie|fin)\\s+(.+?)\\s+${timeRe}\\s*$`,
    "i"
  ).exec(t);
  if (outA) return pack("out", outA[1], outA[2], outA[3]);

  const outB = new RegExp(
    `^(.+?)\\s+(?:départ|depart|parti|sortie|fin)\\s+${timeRe}\\s*$`,
    "i"
  ).exec(t);
  if (outB) return pack("out", outB[1], outB[2], outB[3]);

  const inA = new RegExp(
    `^(?:pointage|présent|present|arriv[ée]e?|arrive)\\s+(.+?)\\s+${timeRe}\\s*$`,
    "i"
  ).exec(t);
  if (inA) return pack("in", inA[1], inA[2], inA[3]);

  const inB = new RegExp(`^(.+?)\\s+${timeRe}\\s*$`, "i").exec(t);
  if (inB) {
    const name = inB[1].trim();
    if (/^(inventaire|menu|aide|help|commander|valider|annuler)$/i.test(name)) {
      return null;
    }
    return pack("in", name, inB[2], inB[3]);
  }
  return null;
}

export type MonthlyPayrollRow = {
  employeeId: string;
  name: string;
  role: string;
  hourlyRate: number;
  hours: number;
  estimatedPay: number;
  daysPresent: number;
};

function workedHoursForAttendance(a: {
  clockIn: Date | null;
  clockOut: Date | null;
  status: string;
  shift: { date: Date; startTime: string; endTime: string } | null;
}): number {
  if (a.status === "ABSENT") return 0;
  if (a.clockIn && a.clockOut) {
    return Math.max(
      0,
      (a.clockOut.getTime() - a.clockIn.getTime()) / 3_600_000
    );
  }
  if (a.clockIn && a.shift) {
    const end = parseHhMm(a.shift.endTime);
    const endAt = timeOnDate(a.shift.date, end.hours, end.minutes);
    return Math.max(0, (endAt.getTime() - a.clockIn.getTime()) / 3_600_000);
  }
  if (a.shift) {
    const start = parseHhMm(a.shift.startTime);
    const end = parseHhMm(a.shift.endTime);
    return Math.max(
      0,
      end.hours +
        end.minutes / 60 -
        (start.hours + start.minutes / 60)
    );
  }
  return 0;
}

/** Heures + salaire estimé du mois en cours (PC). */
export async function getMonthlyPayroll(restaurantId: string, ref = new Date()) {
  const periodStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const periodEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);

  const employees = await listActiveEmployees(restaurantId);
  const attendances = await prisma.attendance.findMany({
    where: {
      employee: { restaurantId },
      OR: [
        { clockIn: { gte: periodStart, lt: periodEnd } },
        {
          shift: {
            date: { gte: periodStart, lt: periodEnd },
          },
        },
      ],
    },
    include: { shift: true },
  });

  const byEmp = new Map<string, typeof attendances>();
  for (const a of attendances) {
    const list = byEmp.get(a.employeeId) ?? [];
    list.push(a);
    byEmp.set(a.employeeId, list);
  }

  const rows: MonthlyPayrollRow[] = employees.map((e) => {
    const list = byEmp.get(e.id) ?? [];
    let hours = 0;
    let daysPresent = 0;
    for (const a of list) {
      const h = workedHoursForAttendance(a);
      hours += h;
      if (a.status !== "ABSENT" && h > 0) daysPresent += 1;
    }
    hours = Math.round(hours * 100) / 100;
    return {
      employeeId: e.id,
      name: e.name,
      role: e.role,
      hourlyRate: e.hourlyRate,
      hours,
      estimatedPay: Math.round(hours * e.hourlyRate * 100) / 100,
      daysPresent,
    };
  });

  const totalHours = Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100;
  const totalPay =
    Math.round(rows.reduce((s, r) => s + r.estimatedPay, 0) * 100) / 100;

  const periodLabel = periodStart.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return { periodLabel, rows, totalHours, totalPay };
}

export async function markAbsent(
  restaurantId: string,
  employeeId: string,
  shiftId: string,
  db: TenantDb = prisma
) {
  const shift = await db.shift.findFirst({
    where: {
      id: shiftId,
      employeeId,
      employee: { restaurantId },
    },
  });
  if (!shift) throw new Error("Shift introuvable");

  await db.attendance.create({
    data: {
      employeeId,
      shiftId,
      status: "ABSENT",
      clockIn: null,
      lateMinutes: 0,
    },
  });
}

export function estimatePayrollToday(
  shifts: {
    startTime: string;
    endTime: string;
    employee: { hourlyRate: number };
  }[]
): number {
  let total = 0;
  for (const s of shifts) {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    const hours = eh + em / 60 - (sh + sm / 60);
    total += hours * s.employee.hourlyRate;
  }
  return total;
}
