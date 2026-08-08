/** Une seule scène de preuve — carte flottante WhatsApp. */
export function MobileLandingProof() {
  return (
    <section className="mland-proof" aria-label="Preuve produit">
      <div className="mland-proof__wrap">
        <p className="mland-proof__eyebrow">En plein rush</p>
        <div className="mland-proof__card" aria-hidden>
          <header className="mland-proof__wa-head">
            <span className="mland-proof__wa-dot" />
            <div>
              <strong>Margin</strong>
              <small>WhatsApp · maintenant</small>
            </div>
          </header>
          <div className="mland-proof__bubble">
            <p>
              Il reste <b>2</b> laits demi-écrémé.
            </p>
            <p>
              On en commande <b>12</b> ?
            </p>
          </div>
          <div className="mland-proof__actions">
            <span className="is-yes">Oui, commander</span>
            <span className="is-no">Plus tard</span>
          </div>
        </div>
        <p className="mland-proof__caption">
          L’alerte arrive avant la rupture — une décision, deux clics.
        </p>
      </div>
    </section>
  );
}
