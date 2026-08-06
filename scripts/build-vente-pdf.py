#!/usr/bin/env python3
"""Génère MARGIN_VENTE.pdf — document commercial Margin."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "MARGIN_VENTE.pdf"
W, H = A4
SAND = HexColor("#e2ddd4")
INK = HexColor("#1c1a17")
MUTED = HexColor("#5c574f")
ACCENT = HexColor("#2f5d3a")
PAIN = HexColor("#8b3a2a")
CARD = HexColor("#f7f5f1")
LINE = HexColor("#c9c2b6")

MARGIN_X = 16 * mm
CONTENT_W = W - 2 * MARGIN_X


def wrap(c, text, font, size, max_w):
    c.setFont(font, size)
    return simpleSplit(text, font, size, max_w)


def draw_wrapped(c, text, x, y, font, size, max_w, leading=None, color=INK):
    leading = leading or size * 1.35
    c.setFillColor(color)
    lines = wrap(c, text, font, size, max_w)
    for i, line in enumerate(lines):
        c.setFont(font, size)
        c.drawString(x, y - i * leading, line)
    return y - len(lines) * leading


def new_page_bg(c, sand=False):
    c.showPage()
    if sand:
        c.setFillColor(SAND)
        c.rect(0, 0, W, H, fill=1, stroke=0)


def section_head(c, eyebrow, title, y):
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_X, y, eyebrow.upper())
    y -= 16
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(MARGIN_X, y, title)
    y -= 8
    c.setStrokeColor(INK)
    c.setLineWidth(1.5)
    c.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y)
    return y - 16


def card(c, x, y, w, h, title, body, dark=False, title_color=None):
    c.setFillColor(INK if dark else CARD)
    c.setStrokeColor(INK if dark else LINE)
    c.setLineWidth(0.6)
    c.roundRect(x, y - h, w, h, 2, fill=1, stroke=1)
    tc = white if dark else (title_color or INK)
    bc = HexColor("#b8b1a5") if dark else MUTED
    c.setFillColor(tc)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 8, y - 14, title)
    by = draw_wrapped(c, body, x + 8, y - 28, "Helvetica", 8, w - 16, leading=11, color=bc)
    return by


def main():
    c = canvas.Canvas(str(OUT), pagesize=A4)
    c.setTitle("Margin — Présentation commerciale")
    c.setAuthor("Margin")

    # ── COVER ──
    c.setFillColor(SAND)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN_X, H - 28 * mm, "DOCUMENT COMMERCIAL  ·  AOÛT 2026")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 42)
    c.drawString(MARGIN_X, H - 55 * mm, "Margin")
    c.setFont("Helvetica-Bold", 18)
    y = H - 72 * mm
    for line in ["Le stock qui suit la caisse.", "Moins de ruptures. Plus de marge."]:
        c.drawString(MARGIN_X, y, line)
        y -= 22
    y -= 10
    lead = (
        "Logiciel de stock pour commerces de proximité. Chaque vente met le stock à jour. "
        "Alertes claires quand ça manque. Sans changer de caisse. Sans Excel le soir."
    )
    draw_wrapped(c, lead, MARGIN_X, y, "Times-Roman", 12, CONTENT_W * 0.92, leading=16, color=INK)

    c.setStrokeColor(HexColor("#b8b1a5"))
    c.setLineWidth(0.8)
    c.line(MARGIN_X, 32 * mm, MARGIN_X + CONTENT_W, 32 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    foot = [
        ("Pour qui", "Épiceries, alimentation spécialisée,\nprêt-à-porter, beauté, quincaillerie…"),
        ("Offre", "Commerce 89 €/mois · Franchise 249 €/mois\nAnnuel −20 %"),
        ("Promesse", "Votre caisse reste.\nVotre stock devient fiable."),
    ]
    fx = MARGIN_X
    for title, body in foot:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(INK)
        c.drawString(fx, 26 * mm, title)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(MUTED)
        for i, bl in enumerate(body.split("\n")):
            c.drawString(fx, 26 * mm - 11 - i * 10, bl)
        fx += CONTENT_W / 3

    # ── PAGE 2 PROBLEMES ──
    new_page_bg(c)
    y = H - 22 * mm
    y = section_head(c, "Le constat", "Les problèmes du commerce de proximité", y)
    y = draw_wrapped(
        c,
        "La plupart des TPE gèrent le stock avec Excel + mémoire. La caisse enregistre les ventes. Le stock, lui, reste approximatif.",
        MARGIN_X, y, "Times-Italic", 11, CONTENT_W, leading=15, color=MUTED,
    )
    y -= 10

    pains = [
        ("Le stock n’est jamais juste", "Ventes non reportées, oublis en rayon, écart permanent entre « ce qu’on croit avoir » et le réel.", "→ Ruptures surprises · surstock · argent immobilisé"),
        ("La double saisie le soir", "Après la fermeture, quelqu’un retape les ventes dans un tableur. Fatigue, erreurs, retards.", "→ Temps perdu · données fausses · équipes saturées"),
        ("Les ruptures qui coûtent cher", "Le client demande un produit absent. Pas d’alerte à temps. Marge perdue, confiance abîmée.", "→ Ventes manquées · image du magasin"),
        ("Outils trop lourds ou trop faibles", "ERP trop cher pour une TPE. Caisse seule : encaissement OK, stock superficiel.", "→ Soit Excel, soit trop payé pour peu d’usage"),
        ("Changer de caisse ? Non.", "Les commerçants refusent de tout reprendre. Ils veulent garder Zelty, Cashpad, Square…", "→ Besoin d’un outil qui se branche, pas qui remplace"),
        ("Le réassort au feeling", "Pas de seuils fiables. Liste floue. Commandes trop tôt, trop tard, ou en double.", "→ Gaspillage · ruptures · stress du gérant"),
    ]
    col_w = (CONTENT_W - 8) / 2
    for i, (t, b, a) in enumerate(pains):
        col = i % 2
        row = i // 2
        x = MARGIN_X + col * (col_w + 8)
        yy = y - row * 48
        c.setStrokeColor(PAIN)
        c.setLineWidth(2.5)
        c.line(x, yy, x, yy - 38)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 8, yy - 2, t)
        draw_wrapped(c, b, x + 8, yy - 14, "Helvetica", 8, col_w - 12, leading=10, color=MUTED)
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x + 8, yy - 40, a)

    y = y - 3 * 48 - 8
    c.setFillColor(INK)
    c.roundRect(MARGIN_X, y - 36, CONTENT_W, 40, 2, fill=1, stroke=0)
    c.setFillColor(SAND)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN_X + 10, y - 12, "En une phrase")
    c.setFillColor(white)
    c.setFont("Times-Roman", 10)
    draw_wrapped(
        c,
        "Le commerce de proximité a une caisse moderne… et un stock du siècle dernier. Margin comble exactement cet écart.",
        MARGIN_X + 10, y - 26, "Times-Roman", 10, CONTENT_W - 20, leading=13, color=white,
    )

    # ── PAGE 3 BESOINS ──
    new_page_bg(c)
    y = H - 22 * mm
    y = section_head(c, "Les besoins", "À quoi Margin répond — concret", y)
    y = draw_wrapped(
        c,
        "Pas une suite ERP. Pas un remplacement de caisse. Un besoin métier précis : savoir ce qu’il reste, à temps, sans travail supplémentaire.",
        MARGIN_X, y, "Times-Italic", 10, CONTENT_W, leading=14, color=MUTED,
    )
    y -= 12

    headers = ["Besoin du commerçant", "Ce qu’il attend", "Ce que Margin apporte"]
    rows = [
        ["Fiabiliser le stock", "Niveau à jour après chaque vente", "Lien caisse → stock automatique"],
        ["Anticiper les ruptures", "Prévenu avant le rayon vide", "Seuils + alertes WhatsApp (sans spam)"],
        ["Gagner du temps", "Plus de report manuel le soir", "Zéro double saisie quotidienne"],
        ["Garder sa caisse", "Ne pas tout changer", "Branchement sur l’outil existant"],
        ["Réassort simple", "Une liste claire à traiter", "Liste de courses + « marquer fait »"],
        ["Contrôler en rayon", "Corriger théorique / réel", "Comptage / inventaire guidé"],
        ["Démarrer vite", "Pas 3 semaines de paramétrage", "Import + Première heure · ou Ops"],
        ["Scaler 2–3 magasins", "Vue multi-sites sans usine", "Formule Franchise (jusqu’à 3)"],
    ]
    col_ws = [CONTENT_W * 0.28, CONTENT_W * 0.34, CONTENT_W * 0.38]
    row_h = 16
    # header
    c.setFillColor(SAND)
    c.rect(MARGIN_X, y - row_h, CONTENT_W, row_h, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    c.rect(MARGIN_X, y - row_h, CONTENT_W, row_h, fill=0, stroke=1)
    x = MARGIN_X
    for i, h in enumerate(headers):
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x + 4, y - 11, h)
        x += col_ws[i]
    y -= row_h
    for r in rows:
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.rect(MARGIN_X, y - row_h, CONTENT_W, row_h, fill=0, stroke=1)
        x = MARGIN_X
        for i, cell in enumerate(r):
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 7.5)
            c.drawString(x + 4, y - 11, cell)
            x += col_ws[i]
        y -= row_h

    y -= 16
    needs = [
        ("Besoin n°1 — Visibilité", "Savoir ce qu’il y a vraiment en magasin."),
        ("Besoin n°2 — Réactivité", "Agir avant la rupture, pas après le client mécontent."),
        ("Besoin n°3 — Simplicité", "Un outil à la taille d’une TPE, pas d’une centrale."),
    ]
    nw = (CONTENT_W - 12) / 3
    for i, (t, b) in enumerate(needs):
        x = MARGIN_X + i * (nw + 6)
        c.setStrokeColor(ACCENT)
        c.setLineWidth(2.5)
        c.line(x, y, x, y - 42)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(x + 8, y - 8, t)
        draw_wrapped(c, b, x + 8, y - 22, "Helvetica", 8, nw - 12, leading=11, color=MUTED)

    # ── PAGE 4 SOLUTIONS ──
    new_page_bg(c)
    y = H - 22 * mm
    y = section_head(c, "Problématiques → solutions", "Ce que Margin résout, angle par angle", y)

    pairs = [
        ("Stock Excel, mis à jour « quand on peut »", "Chaque ticket de caisse décrémente le stock"),
        ("Rupture découverte au moment de la vente", "Alerte sous seuil, regroupée, sur WhatsApp"),
        ("Changer de caisse pour avoir du stock", "On garde la caisse · Margin s’y branche"),
        ("Catalogue importé sale → tickets support", "Contrôles à l’import + assistant de nettoyage"),
        ("Seul face au paramétrage technique", "Self-serve ou Ops Margin configure pour vous"),
    ]
    for before, after in pairs:
        bw = (CONTENT_W - 28) / 2
        c.setFillColor(CARD)
        c.setStrokeColor(LINE)
        c.roundRect(MARGIN_X, y - 28, bw, 28, 2, fill=1, stroke=1)
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(MARGIN_X + 6, y - 10, "AVANT")
        c.setFillColor(INK)
        c.setFont("Helvetica", 8)
        draw_wrapped(c, before, MARGIN_X + 6, y - 20, "Helvetica", 8, bw - 12, leading=10, color=INK)

        c.setFillColor(PAIN)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(MARGIN_X + bw + 14, y - 18, "→")

        c.setFillColor(CARD)
        c.roundRect(MARGIN_X + bw + 28, y - 28, bw, 28, 2, fill=1, stroke=1)
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(MARGIN_X + bw + 34, y - 10, "AVEC MARGIN")
        c.setFillColor(INK)
        draw_wrapped(c, after, MARGIN_X + bw + 34, y - 20, "Helvetica", 8, bw - 12, leading=10, color=INK)
        y -= 34

    y -= 6
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_X, y, "Impact business attendu")
    y -= 14
    impacts = [
        ("Moins de ruptures", "Seuils + alertes avant le rayon vide → ventes sauvées."),
        ("Moins de temps perdu", "Fin du report Excel du soir · focus rayon & clients."),
        ("Meilleure marge", "Moins de surstock · moins d’achats en urgence."),
    ]
    iw = (CONTENT_W - 12) / 3
    for i, (t, b) in enumerate(impacts):
        x = MARGIN_X + i * (iw + 6)
        c.setFillColor(CARD)
        c.setStrokeColor(LINE)
        c.roundRect(x, y - 48, iw, 48, 2, fill=1, stroke=1)
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 8, y - 14, t)
        draw_wrapped(c, b, x + 8, y - 28, "Helvetica", 8, iw - 16, leading=11, color=MUTED)

    # ── PAGE 5 PRODUIT ──
    new_page_bg(c)
    y = H - 22 * mm
    y = section_head(c, "Le produit", "Comment ça marche", y)

    steps = [
        ("Vous gardez votre caisse", "Zelty, Cashpad, Square, SumUp / Tiller, Lightspeed… Margin se connecte. Pas de migration forcée."),
        ("Vous importez (ou on importe) votre catalogue", "Produits, unités, seuils. Contrôles anti-doublons / prix / unités. Nettoyage guidé."),
        ("Chaque vente met le stock à jour", "Ticket en caisse → niveau stock dans Margin. Plus de saisie le soir."),
        ("Vous êtes alerté quand ça manque", "WhatsApp + app. Une alerte groupée, pas une rafale. Puis liste de courses."),
        ("Vous comptez en rayon quand besoin", "Inventaire / écarts corrigés. Le théorique rejoint le réel."),
    ]
    for i, (t, b) in enumerate(steps, 1):
        c.setFillColor(INK)
        c.circle(MARGIN_X + 8, y - 4, 8, fill=1, stroke=0)
        c.setFillColor(SAND)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(MARGIN_X + 8, y - 7, str(i))
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(MARGIN_X + 24, y - 2, t)
        y = draw_wrapped(c, b, MARGIN_X + 24, y - 14, "Helvetica", 8.5, CONTENT_W - 28, leading=11, color=MUTED)
        y -= 12

    y -= 4
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_X, y, "Ce que contient l’app")
    y -= 12
    mods = [
        ("Stock", "Niveaux, seuils, catalogue, qualité des données"),
        ("Caisse", "Connexion POS, synchro ventes → stock"),
        ("Courses", "Liste de réassort unique · marquer fait"),
        ("Équipe", "Pointage & planning au quotidien magasin"),
        ("WhatsApp", "Canal d’alerte — pas le tableau de bord"),
        ("Ops Margin", "On peut créer / configurer le magasin à votre place"),
    ]
    for name, role in mods:
        c.setStrokeColor(LINE)
        c.rect(MARGIN_X, y - 14, CONTENT_W, 14, fill=0, stroke=1)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(MARGIN_X + 6, y - 10, name)
        c.setFont("Helvetica", 8)
        c.setFillColor(MUTED)
        c.drawString(MARGIN_X + 70, y - 10, role)
        y -= 14

    y -= 10
    c.setFillColor(MUTED)
    c.setFont("Times-Italic", 9)
    c.drawString(MARGIN_X, y, "Margin ne remplace pas votre caisse. Il la rend enfin utile pour le stock.")

    # ── PAGE 6 OFFRE ──
    new_page_bg(c)
    y = H - 22 * mm
    y = section_head(c, "Offre", "Deux formules, une promesse", y)

    # Commerce
    pw = (CONTENT_W - 10) / 2
    c.setFillColor(CARD)
    c.setStrokeColor(LINE)
    c.roundRect(MARGIN_X, y - 105, pw, 105, 3, fill=1, stroke=1)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(MARGIN_X + 10, y - 12, "INDÉPENDANT · 1 BOUTIQUE")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN_X + 10, y - 28, "Commerce")
    c.setFont("Helvetica-Bold", 20)
    c.drawString(MARGIN_X + 10, y - 48, "89 €")
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(MARGIN_X + 52, y - 46, "/ mois HT*")
    c.drawString(MARGIN_X + 10, y - 58, "854 € / an (−20 %)")
    feats = [
        "1 boutique · jusqu’à 200 produits",
        "Stock, alertes, comptage, courses",
        "Lien caisse → stock (une fois branché)",
        "Branchement caisse : à votre charge",
    ]
    yy = y - 72
    for f in feats:
        c.setFillColor(INK)
        c.setFont("Helvetica", 8)
        c.drawString(MARGIN_X + 10, yy, "•  " + f)
        yy -= 10

    # Franchise
    c.setFillColor(INK)
    c.roundRect(MARGIN_X + pw + 10, y - 105, pw, 105, 3, fill=1, stroke=0)
    c.setFillColor(HexColor("#b8b1a5"))
    c.setFont("Helvetica-Bold", 7)
    c.drawString(MARGIN_X + pw + 20, y - 12, "1 À 3 BOUTIQUES")
    c.setFillColor(SAND)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN_X + pw + 20, y - 28, "Franchise")
    c.setFont("Helvetica-Bold", 20)
    c.drawString(MARGIN_X + pw + 20, y - 48, "249 €")
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#b8b1a5"))
    c.drawString(MARGIN_X + pw + 68, y - 46, "/ mois HT*")
    c.drawString(MARGIN_X + pw + 20, y - 58, "2 390 € / an (−20 %)")
    feats2 = [
        "Tout Commerce + multi-magasins",
        "Produits illimités · vue multi-sites",
        "Branchement caisse inclus (~400 €)",
        "Aide prioritaire équipe Margin",
    ]
    yy = y - 72
    for f in feats2:
        c.setFillColor(white)
        c.setFont("Helvetica", 8)
        c.drawString(MARGIN_X + pw + 20, yy, "•  " + f)
        yy -= 10

    y -= 118
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN_X, y, "*TVA selon régime. Setup technique ~400 € : option Commerce · inclus Franchise.")

    y -= 18
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN_X, y, "Pourquoi Margin plutôt qu’un autre outil")
    y -= 14
    why = [
        "On ne change pas votre caisse — on s’y branche.",
        "Pensé TPE — trop petit pour un ERP, trop complexe pour Excel.",
        "Deux chemins — vous faites seul, ou Ops Margin configure pour vous.",
        "WhatsApp utile, pas envahissant — alertes regroupées, app = interface principale.",
    ]
    for wline in why:
        c.setFillColor(INK)
        c.setFont("Helvetica", 9)
        c.drawString(MARGIN_X, y, "•  " + wline)
        y -= 12

    y -= 8
    c.setFillColor(INK)
    c.roundRect(MARGIN_X, y - 62, CONTENT_W, 62, 3, fill=1, stroke=0)
    c.setFillColor(SAND)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN_X + 12, y - 14, "Prochaine étape")
    c.setFillColor(white)
    c.setFont("Helvetica", 9)
    nexts = [
        "1. Identifier votre caisse actuelle (marque / modèle).",
        "2. Choisir Commerce (1 boutique) ou Franchise (jusqu’à 3 + branchement inclus).",
        "3. On démarre : import catalogue → lien caisse → Première heure.",
    ]
    yy = y - 28
    for n in nexts:
        c.drawString(MARGIN_X + 12, yy, n)
        yy -= 11
    c.setFillColor(SAND)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN_X + 12, yy - 2, "Contact Ops Margin — on configure avec vous, ou pour vous.")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(
        MARGIN_X,
        14 * mm,
        "Margin · Logiciel de stock pour commerces de proximité · Document commercial août 2026",
    )

    c.save()
    print(f"OK → {OUT}")


if __name__ == "__main__":
    main()
