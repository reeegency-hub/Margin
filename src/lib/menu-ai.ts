export type ProposedIngredient = {
  name: string;
  quantity: number;
  unit: "g" | "ml" | "pcs";
  confidence: number;
};

export type ProposedDish = {
  name: string;
  salePrice: number;
  ingredients: ProposedIngredient[];
  confidence: number;
  source: "knowledge" | "llm" | "heuristic";
  note?: string;
};

export type MenuAnalysisResult = {
  dishes: ProposedDish[];
  engine: "openai" | "local";
  rawLines: string[];
};

type RecipeTemplate = {
  keys: string[];
  ingredients: Omit<ProposedIngredient, "confidence">[];
  defaultPrice: number;
};

const KNOWLEDGE: RecipeTemplate[] = [
  {
    keys: ["burger", "cheeseburger", "hamburger"],
    defaultPrice: 14.5,
    ingredients: [
      { name: "Pain burger", quantity: 1, unit: "pcs" },
      { name: "Bœuf haché", quantity: 150, unit: "g" },
      { name: "Fromage", quantity: 30, unit: "g" },
      { name: "Salade", quantity: 20, unit: "g" },
      { name: "Tomate", quantity: 40, unit: "g" },
    ],
  },
  {
    keys: ["steak frites", "entrecôte", "pavé de bœuf", "steak"],
    defaultPrice: 18,
    ingredients: [
      { name: "Bœuf", quantity: 220, unit: "g" },
      { name: "Pommes de terre", quantity: 250, unit: "g" },
      { name: "Beurre", quantity: 20, unit: "g" },
    ],
  },
  {
    keys: ["salade césar", "cesar", "césar"],
    defaultPrice: 12,
    ingredients: [
      { name: "Salade", quantity: 120, unit: "g" },
      { name: "Poulet", quantity: 80, unit: "g" },
      { name: "Fromage", quantity: 25, unit: "g" },
      { name: "Pain", quantity: 30, unit: "g" },
    ],
  },
  {
    keys: ["salade", "verde", "composée"],
    defaultPrice: 11,
    ingredients: [
      { name: "Salade", quantity: 100, unit: "g" },
      { name: "Tomate", quantity: 60, unit: "g" },
      { name: "Concombre", quantity: 40, unit: "g" },
      { name: "Huile d'olive", quantity: 15, unit: "ml" },
    ],
  },
  {
    keys: ["pizza margherita", "margarita", "margherita"],
    defaultPrice: 12,
    ingredients: [
      { name: "Pâte à pizza", quantity: 220, unit: "g" },
      { name: "Sauce tomate", quantity: 80, unit: "g" },
      { name: "Mozzarella", quantity: 100, unit: "g" },
      { name: "Basilic", quantity: 5, unit: "g" },
    ],
  },
  {
    keys: ["pizza"],
    defaultPrice: 13.5,
    ingredients: [
      { name: "Pâte à pizza", quantity: 220, unit: "g" },
      { name: "Sauce tomate", quantity: 80, unit: "g" },
      { name: "Mozzarella", quantity: 90, unit: "g" },
      { name: "Jambon", quantity: 50, unit: "g" },
    ],
  },
  {
    keys: ["pâte bolo", "bolognaise", "spaghetti bolo", "tagliatelles bolo"],
    defaultPrice: 13,
    ingredients: [
      { name: "Pâtes", quantity: 120, unit: "g" },
      { name: "Bœuf haché", quantity: 100, unit: "g" },
      { name: "Sauce tomate", quantity: 120, unit: "g" },
      { name: "Oignon", quantity: 40, unit: "g" },
    ],
  },
  {
    keys: ["pâtes", "pasta", "spaghetti", "tagliatelle", "penne", "carbonara"],
    defaultPrice: 13,
    ingredients: [
      { name: "Pâtes", quantity: 120, unit: "g" },
      { name: "Crème", quantity: 60, unit: "ml" },
      { name: "Lardons", quantity: 50, unit: "g" },
      { name: "Fromage", quantity: 30, unit: "g" },
    ],
  },
  {
    keys: ["poulet rôti", "poulet grillé", "suprême de poulet", "poulet"],
    defaultPrice: 15,
    ingredients: [
      { name: "Poulet", quantity: 200, unit: "g" },
      { name: "Pommes de terre", quantity: 180, unit: "g" },
      { name: "Beurre", quantity: 15, unit: "g" },
    ],
  },
  {
    keys: ["fish and chips", "fish & chips", "cabillaud", "poisson pané"],
    defaultPrice: 16,
    ingredients: [
      { name: "Cabillaud", quantity: 180, unit: "g" },
      { name: "Pommes de terre", quantity: 250, unit: "g" },
      { name: "Farine", quantity: 40, unit: "g" },
      { name: "Huile", quantity: 30, unit: "ml" },
    ],
  },
  {
    keys: ["soupe", "velouté", "potage"],
    defaultPrice: 8,
    ingredients: [
      { name: "Légumes", quantity: 200, unit: "g" },
      { name: "Crème", quantity: 40, unit: "ml" },
      { name: "Beurre", quantity: 10, unit: "g" },
    ],
  },
  {
    keys: ["croque", "croque-monsieur", "croque monsieur"],
    defaultPrice: 10,
    ingredients: [
      { name: "Pain de mie", quantity: 2, unit: "pcs" },
      { name: "Jambon", quantity: 60, unit: "g" },
      { name: "Fromage", quantity: 50, unit: "g" },
      { name: "Beurre", quantity: 15, unit: "g" },
    ],
  },
  {
    keys: ["quiche"],
    defaultPrice: 11,
    ingredients: [
      { name: "Pâte brisée", quantity: 150, unit: "g" },
      { name: "Œufs", quantity: 2, unit: "pcs" },
      { name: "Crème", quantity: 100, unit: "ml" },
      { name: "Lardons", quantity: 80, unit: "g" },
    ],
  },
  {
    keys: ["risotto"],
    defaultPrice: 14,
    ingredients: [
      { name: "Riz arborio", quantity: 90, unit: "g" },
      { name: "Bouillon", quantity: 250, unit: "ml" },
      { name: "Parmesan", quantity: 30, unit: "g" },
      { name: "Beurre", quantity: 20, unit: "g" },
    ],
  },
  {
    keys: ["tacos", "taco"],
    defaultPrice: 12,
    ingredients: [
      { name: "Tortilla", quantity: 2, unit: "pcs" },
      { name: "Poulet", quantity: 100, unit: "g" },
      { name: "Salade", quantity: 30, unit: "g" },
      { name: "Fromage", quantity: 40, unit: "g" },
    ],
  },
  {
    keys: ["bowl", "poké", "poke"],
    defaultPrice: 14,
    ingredients: [
      { name: "Riz", quantity: 150, unit: "g" },
      { name: "Saumon", quantity: 80, unit: "g" },
      { name: "Avocat", quantity: 50, unit: "g" },
      { name: "Concombre", quantity: 40, unit: "g" },
    ],
  },
  {
    keys: ["dessert", "tiramisu", "fondant", "mousse", "tarte"],
    defaultPrice: 7,
    ingredients: [
      { name: "Sucre", quantity: 40, unit: "g" },
      { name: "Œufs", quantity: 1, unit: "pcs" },
      { name: "Crème", quantity: 80, unit: "ml" },
      { name: "Chocolat", quantity: 50, unit: "g" },
    ],
  },
  {
    keys: ["café", "espresso"],
    defaultPrice: 2.5,
    ingredients: [
      { name: "Café", quantity: 18, unit: "g" },
      { name: "Eau", quantity: 40, unit: "ml" },
    ],
  },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/€/g, "e")
    .trim();
}

function parseQtyUnit(
  rawQty: string,
  rawUnit: string | undefined,
  ingredientName: string
): { quantity: number; unit: "g" | "ml" | "pcs"; needsQuantity: boolean } {
  const qty = Number(String(rawQty).replace(",", "."));
  const u = (rawUnit || "").toLowerCase().trim();

  if (!(qty > 0)) {
    return { quantity: 0, unit: "g", needsQuantity: true };
  }

  if (/^(kg)$/i.test(u)) return { quantity: qty * 1000, unit: "g", needsQuantity: false };
  if (/^(l|litre|litres)$/i.test(u))
    return { quantity: qty * 1000, unit: "ml", needsQuantity: false };
  if (/^(ml)$/i.test(u)) return { quantity: qty, unit: "ml", needsQuantity: false };
  if (/^(g|gr|grammes?)$/i.test(u))
    return { quantity: qty, unit: "g", needsQuantity: false };
  if (/^(u|unité|unités|pcs?|pi[eè]ces?)$/i.test(u))
    return { quantity: qty, unit: "pcs", needsQuantity: false };
  if (/portion/i.test(u) || /portion/i.test(ingredientName)) {
    return { quantity: qty, unit: "pcs", needsQuantity: true };
  }
  // Pas d’unité → g par défaut si nom « frais », sinon pcs pour 1
  if (!u) {
    if (qty === 1 && /salade|feuille|nori|macaron|mochi|canette|bouteille/i.test(ingredientName)) {
      return { quantity: 1, unit: "pcs", needsQuantity: false };
    }
    return { quantity: qty, unit: "g", needsQuantity: false };
  }
  return { quantity: qty, unit: "g", needsQuantity: false };
}

/**
 * Parse fiches produit structurées (ChatGPT / Margin) :
 *   POP Salmon — 9,90€
 *   - Riz vinaigré : 100g
 *   - Nori : 1u
 */
export function parseRecipeFiches(text: string): ProposedDish[] | null {
  const lines = text.split(/\r?\n/);
  const dishes: ProposedDish[] = [];
  let current: ProposedDish | null = null;

  const dishRe =
    /^(.+?)\s*[—–\-]\s*(\d+[.,]\d{1,2}|\d+)\s*€\s*$/;
  const dishReAlt =
    /^(.+?)\s+(\d+[.,]\d{1,2}|\d+)\s*€\s*$/;
  const ingRe =
    /^[-•*]\s*(.+?)\s*:\s*(\d+[.,]?\d*)\s*(kg|g|gr|grammes?|ml|l|litres?|u|unité|unités|pcs?|pi[eè]ces?|portion)?\s*$/i;
  const sectionSkip =
    /^(━|─|═|=){3,}|^MARGIN\b|^Note\s*:|^\s*$|^\([^)]*\)\s*$/i;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || sectionSkip.test(line)) continue;
    if (/^[━─═]/.test(line)) continue;
    // Section headers: ALL CAPS or "LES TEMAKI" without price
    if (
      !dishRe.test(line) &&
      !dishReAlt.test(line) &&
      !ingRe.test(line) &&
      (/^[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ0-9\s'’()\-]{6,}$/.test(line) ||
        /^(les|nos|pop|formule)/i.test(line))
    ) {
      continue;
    }

    let dishMatch = line.match(dishRe);
    if (!dishMatch) dishMatch = line.match(dishReAlt);
    if (dishMatch && !ingRe.test(line)) {
      if (current && current.ingredients.length > 0) {
        dishes.push(current);
      }
      const name = dishMatch[1].replace(/\s+/g, " ").trim();
      const salePrice = Number(dishMatch[2].replace(",", "."));
      current = {
        name,
        salePrice,
        ingredients: [],
        confidence: 0.95,
        source: "heuristic",
        note: "Fiche collée — prix et grammages lus tels quels.",
      };
      continue;
    }

    const ingMatch = line.match(ingRe);
    if (ingMatch && current) {
      const ingName = ingMatch[1].replace(/\s+/g, " ").trim();
      const parsed = parseQtyUnit(ingMatch[2], ingMatch[3], ingName);
      current.ingredients.push({
        name: ingName,
        quantity: parsed.quantity,
        unit: parsed.unit,
        confidence: parsed.needsQuantity ? 0.4 : 0.95,
      });
      if (parsed.needsQuantity) {
        current.note =
          (current.note || "") +
          ` · Quantité à préciser : ${ingName}`;
      }
      continue;
    }
  }

  if (current && current.ingredients.length > 0) dishes.push(current);

  const usable = dishes.filter((d) => d.ingredients.length > 0);
  if (usable.length < 1) return null;
  // Heuristic: fiche format if we got at least one dish with 2+ ingredients
  // or several dishes from bullet lists
  const rich = usable.filter((d) => d.ingredients.length >= 2).length;
  if (rich < 1 && usable.length < 3) return null;
  return usable;
}

/** Parse lines like "Burger Signature ...... 14,50€" or "Steak frites - 18€" */
export function parseMenuLines(text: string): { name: string; price: number | null }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && !/^[-–—=*]{3,}/.test(l));

  const items: { name: string; price: number | null }[] = [];

  for (const line of lines) {
    // skip section headers that are all caps short words
    if (/^(entrees?|plats?|desserts?|boissons?|menu|formules?)$/i.test(line)) {
      continue;
    }

    const priceMatch = line.match(
      /(\d+[.,]\d{1,2}|\d+)\s*€?\s*$/
    );
    let price: number | null = null;
    let name = line;

    if (priceMatch) {
      price = Number(priceMatch[1].replace(",", "."));
      name = line.slice(0, priceMatch.index).replace(/[.\-–—•]+$/g, "").trim();
    }

    name = name.replace(/^[\d.)\-–—•]+\s*/, "").trim();
    if (name.length < 2) continue;
    if (/^(entrees?|plats?|desserts?|boissons?)$/i.test(name)) continue;

    items.push({ name, price });
  }

  return items;
}

function matchTemplate(dishName: string): RecipeTemplate | null {
  const n = normalize(dishName);
  let best: RecipeTemplate | null = null;
  let bestLen = 0;
  for (const t of KNOWLEDGE) {
    for (const key of t.keys) {
      const k = normalize(key);
      if (n.includes(k) && k.length > bestLen) {
        best = t;
        bestLen = k.length;
      }
    }
  }
  return best;
}

function heuristicGuess(dishName: string): ProposedDish {
  const words = normalize(dishName).split(/\s+/).filter(Boolean);
  const ingredients: ProposedIngredient[] = [];

  const hints: Record<string, Omit<ProposedIngredient, "confidence">> = {
    saumon: { name: "Saumon", quantity: 80, unit: "g" },
    thon: { name: "Thon", quantity: 80, unit: "g" },
    poulet: { name: "Poulet", quantity: 120, unit: "g" },
    boeuf: { name: "Bœuf", quantity: 150, unit: "g" },
    veau: { name: "Veau", quantity: 150, unit: "g" },
    agneau: { name: "Agneau", quantity: 150, unit: "g" },
    porc: { name: "Porc", quantity: 140, unit: "g" },
    canard: { name: "Canard", quantity: 160, unit: "g" },
    fromage: { name: "Fromage", quantity: 40, unit: "g" },
    mozzarella: { name: "Mozzarella", quantity: 80, unit: "g" },
    avocado: { name: "Avocat", quantity: 50, unit: "g" },
    avocat: { name: "Avocat", quantity: 50, unit: "g" },
    tomate: { name: "Tomate", quantity: 50, unit: "g" },
    riz: { name: "Riz", quantity: 120, unit: "g" },
    frites: { name: "Pommes de terre", quantity: 200, unit: "g" },
    oeuf: { name: "Œufs", quantity: 1, unit: "pcs" },
    oeufs: { name: "Œufs", quantity: 2, unit: "pcs" },
  };

  for (const w of words) {
    if (hints[w]) {
      ingredients.push({ ...hints[w], confidence: 0.55 });
    }
  }

  if (ingredients.length === 0) {
    ingredients.push(
      { name: "Ingrédient principal", quantity: 150, unit: "g", confidence: 0.3 },
      { name: "Garniture", quantity: 80, unit: "g", confidence: 0.3 },
      { name: "Assaisonnement", quantity: 10, unit: "g", confidence: 0.25 }
    );
  }

  return {
    name: dishName,
    salePrice: 12,
    ingredients,
    confidence: 0.35,
    source: "heuristic",
    note: "Estimation générique — à ajuster avant validation.",
  };
}

function fromTemplate(
  name: string,
  price: number | null,
  template: RecipeTemplate
): ProposedDish {
  return {
    name,
    salePrice: price ?? template.defaultPrice,
    ingredients: template.ingredients.map((i) => ({
      ...i,
      confidence: 0.82,
    })),
    confidence: 0.82,
    source: "knowledge",
    note: "Décomposition issue de la base produits Margin.",
  };
}

export type OpenAICallOptions = {
  apiKey?: string;
  model?: string;
};

async function analyzeWithOpenAI(
  text: string,
  existingIngredients: string[],
  options: OpenAICallOptions = {}
): Promise<{ dishes: ProposedDish[] | null; error?: string }> {
  const key = (options.apiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!key) {
    return {
      dishes: null,
      error:
        "Clé OpenAI manquante. Ajoutez-la dans Réglages → OpenAI, ou dans le fichier .env.",
    };
  }

  const model =
    (options.model || process.env.OPENAI_MODEL || "gpt-4o-mini").trim() ||
    "gpt-4o-mini";

  const prompt = `Tu es un expert en fiches techniques de commerce (France).
À partir du menu ci-dessous, propose pour chaque plat une composition d'ingrédients avec quantités réalistes pour 1 portion.
Ingrédients déjà en stock (réutilise ces noms si possible): ${existingIngredients.join(", ") || "aucun"}.

Réponds UNIQUEMENT en JSON valide:
{"dishes":[{"name":"...","salePrice":12.5,"ingredients":[{"name":"...","quantity":100,"unit":"g|ml|pcs","confidence":0.0}],"confidence":0.0,"note":"..."}]}

Menu:
${text}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Tu génères des fiches recettes JSON précises.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) {
        return {
          dishes: null,
          error:
            "OpenAI saturé (quota / rate limit). Réessayez dans 1 minute, ou continuez en mode local.",
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          dishes: null,
          error: `Clé OpenAI refusée (${res.status}). Vérifiez-la dans Réglages.`,
        };
      }
      return {
        dishes: null,
        error: `OpenAI a refusé la requête (${res.status}). ${body.slice(0, 180)}`,
      };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { dishes: null, error: "Réponse OpenAI vide." };
    }
    const parsed = JSON.parse(content) as { dishes?: ProposedDish[] };
    if (!parsed.dishes?.length) {
      return { dishes: null, error: "OpenAI n’a détecté aucun plat." };
    }
    return {
      dishes: parsed.dishes.map((d) => ({
        ...d,
        source: "llm" as const,
        salePrice: Number(d.salePrice) || 12,
        ingredients: (d.ingredients || []).map((i) => ({
          name: i.name,
          quantity: Number(i.quantity) || 1,
          unit: (["g", "ml", "pcs"].includes(i.unit) ? i.unit : "g") as
            | "g"
            | "ml"
            | "pcs",
          confidence: Number(i.confidence) || 0.7,
        })),
        confidence: Number(d.confidence) || 0.7,
      })),
    };
  } catch (e) {
    return {
      dishes: null,
      error:
        e instanceof Error
          ? `Erreur OpenAI : ${e.message}`
          : "Erreur OpenAI inconnue.",
    };
  }
}

export async function analyzeMenuText(
  text: string,
  existingIngredients: string[] = [],
  options: OpenAICallOptions = {}
): Promise<MenuAnalysisResult & { openaiError?: string }> {
  // 1) Fiches structurées (ChatGPT / Margin) — pas besoin d’IA
  const fiches = parseRecipeFiches(text);
  if (fiches?.length) {
    return {
      dishes: fiches,
      engine: "local",
      rawLines: text.split(/\r?\n/).filter((l) => l.trim()),
    };
  }

  const llm = await analyzeWithOpenAI(text, existingIngredients, options);
  if (llm.dishes?.length) {
    return {
      dishes: llm.dishes,
      engine: "openai",
      rawLines: text.split(/\r?\n/).filter((l) => l.trim()),
    };
  }

  const parsed = parseMenuLines(text);
  const dishes = parsed.map((item) => {
    const template = matchTemplate(item.name);
    if (template) return fromTemplate(item.name, item.price, template);
    const guess = heuristicGuess(item.name);
    if (item.price) guess.salePrice = item.price;
    return guess;
  });

  return {
    dishes,
    engine: "local",
    rawLines: parsed.map((p) => p.name),
    openaiError: llm.error,
  };
}
