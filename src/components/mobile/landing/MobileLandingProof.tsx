/** Scène preuve — alerte WhatsApp en plein rush. */
export function MobileLandingProof() {
  return (
    <section className="mland-proof" id="preuve" aria-label="Preuve produit">
      <div className="mland-proof__wrap">
        <p className="mland-proof__eyebrow">En plein rush</p>
        <h2 className="mland-section-title">L’alerte avant la rupture</h2>
        <p className="mland-proof__lead">
          Une décision, deux clics — sans quitter le comptoir.
        </p>

        <div className="mland-proof__stage" aria-hidden>
          <div className="mland-proof__phone">
            <div className="mland-proof__notch" />
            <div className="mland-proof__screen">
              <header className="mland-proof__wa-head">
                <span className="mland-proof__wa-dot" />
                <div>
                  <strong>Margin</strong>
                  <small>WhatsApp · maintenant</small>
                </div>
                <span className="mland-proof__urgent">Urgent</span>
              </header>

              <div className="mland-proof__thread">
                <div className="mland-proof__bubble">
                  <p>
                    Il reste <b>2</b> laits demi-écrémé.
                  </p>
                  <p>
                    On en commande <b>12</b> ?
                  </p>
                  <time>18:42</time>
                </div>
              </div>

              <div className="mland-proof__actions">
                <span className="is-yes">Oui, commander</span>
                <span className="is-no">Plus tard</span>
              </div>
            </div>
          </div>

          <div className="mland-proof__float is-stock">
            <strong>Stock</strong>
            <span>2 restants</span>
          </div>
          <div className="mland-proof__float is-order">
            <strong>+12</strong>
            <span>Commande</span>
          </div>
        </div>

        <p className="mland-proof__caption">
          Le message arrive au bon moment — la rupture n’a pas lieu.
        </p>
      </div>
    </section>
  );
}
