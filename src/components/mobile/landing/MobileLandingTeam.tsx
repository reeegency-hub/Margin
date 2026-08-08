/** Section équipe — planning employé en visuel. */
export function MobileLandingTeam() {
  return (
    <section className="mland-team" id="equipe" aria-label="Équipe">
      <div className="mland-team__wrap">
        <p className="mland-team__eyebrow">Équipe</p>
        <h2 className="mland-section-title">Qui est en rayon, sans excel</h2>
        <p className="mland-team__lead">
          Planning et présence visibles — pour savoir qui tient la boutique.
        </p>

        <div className="mland-team__visual" aria-hidden>
          <div className="mland-team__card">
            <header className="mland-team__head">
              <span className="mland-team__avatar">K</span>
              <div>
                <strong>Kevin</strong>
                <small>Employé · aujourd’hui</small>
              </div>
              <span className="mland-team__badge">Présent</span>
            </header>

            <div className="mland-team__shift">
              <div className="mland-team__shift-meta">
                <span>8h</span>
                <span>Shift</span>
                <span>21h</span>
              </div>
              <div className="mland-team__bar">
                <span className="mland-team__bar-fill" />
                <span className="mland-team__bar-now" />
              </div>
              <p className="mland-team__hours">8h – 21h · en cours</p>
            </div>

            <ul className="mland-team__rows">
              <li>
                <span className="mland-team__dot is-on" />
                <strong>Kevin</strong>
                <small>8h – 21h</small>
              </li>
              <li>
                <span className="mland-team__dot" />
                <strong>Léa</strong>
                <small>Demain · 9h – 17h</small>
              </li>
            </ul>
          </div>
        </div>

        <p className="mland-team__caption">
          Pointage et créneaux dans Margin — pas un tableur à jour le soir.
        </p>
      </div>
    </section>
  );
}
