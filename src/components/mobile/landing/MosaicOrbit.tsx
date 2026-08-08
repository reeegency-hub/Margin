"use client";

import { useEffect, useRef, type CSSProperties } from "react";

export type OrbitTone = "wa" | "team" | "urgent" | "ok";

export type OrbitNode = {
  id: string;
  icon: "ticket" | "wa" | "check" | "sales" | "user";
  title: string;
  sub: string;
  angle: number;
  /** Fraction du diamètre mosaic (0–0.5). */
  radius: number;
  tone: OrbitTone;
};

type Props = {
  nodes: readonly OrbitNode[];
};

const ORBIT_PERIOD_S = 72;
const FOCUS_DEG = 90;
const SPOT_HALF_DEG = 26;

function normDeg(deg: number) {
  return ((deg % 360) + 360) % 360;
}

function angleDist(a: number, b: number) {
  const d = Math.abs(normDeg(a) - normDeg(b));
  return Math.min(d, 360 - d);
}

/** Orbite unique — spotlight sous le cœur, rayons proportionnels. */
export function MosaicOrbit({ nodes }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const orbit = orbitRef.current;
    if (!root || !orbit) return;

    const prefersReduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const sats = [
      ...root.querySelectorAll<HTMLElement>(".mland-mosaic__sat"),
    ];

    const applyRadii = () => {
      const size = root.getBoundingClientRect().width || 280;
      sats.forEach((sat, i) => {
        const frac = nodes[i]?.radius ?? 0.3;
        const px = Math.round(size * frac);
        sat.style.setProperty("--sat-radius", `${px}px`);
      });
    };

    applyRadii();
    const ro = new ResizeObserver(applyRadii);
    ro.observe(root);

    if (prefersReduce) {
      sats.forEach((sat, i) => {
        const face = sat.querySelector<HTMLElement>(".mland-mosaic__sat-face");
        const angle = nodes[i]?.angle ?? 0;
        sat.style.transform = `rotate(${angle}deg) translateX(var(--sat-radius))`;
        const inner = sat.querySelector<HTMLElement>(".mland-mosaic__sat-inner");
        if (inner) {
          inner.style.transform = `translate(-48px, -68px) rotate(${-angle}deg)`;
        }
        if (face) {
          face.style.opacity = i === 0 ? "1" : "0.35";
          face.style.transform = i === 0 ? "scale(1.06)" : "scale(0.9)";
        }
      });
      return () => ro.disconnect();
    }

    const t0 = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = (now - t0) / 1000;
      const rot = ((elapsed / ORBIT_PERIOD_S) * 360) % 360;
      orbit.style.transform = `rotate(${rot}deg)`;

      let bestIdx = 0;
      let bestDist = 999;

      sats.forEach((sat, i) => {
        const angle = nodes[i]?.angle ?? 0;
        const world = normDeg(rot + angle);
        const dist = angleDist(world, FOCUS_DEG);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }

        const spot = Math.max(0, 1 - dist / SPOT_HALF_DEG);
        const face = sat.querySelector<HTMLElement>(".mland-mosaic__sat-face");
        const inner = sat.querySelector<HTMLElement>(".mland-mosaic__sat-inner");

        if (inner) {
          inner.style.transform = `translate(-48px, -68px) rotate(${-(rot + angle)}deg)`;
        }
        if (face) {
          const isLead = i === bestIdx && spot > 0.15;
          const opacity = isLead ? 0.55 + spot * 0.45 : 0.26 + spot * 0.28;
          const scale = isLead ? 0.98 + spot * 0.18 : 0.86 + spot * 0.1;
          face.style.opacity = String(opacity);
          face.style.transform = `scale(${scale})`;
          face.classList.toggle("is-focus", isLead && spot > 0.45);
          sat.style.zIndex = isLead ? "6" : "1";
        }
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [nodes]);

  return (
    <div className="mland-mosaic__orbits" ref={rootRef}>
      <span className="mland-mosaic__core-hit" aria-hidden />
      <span className="mland-mosaic__focus-slot" aria-hidden />

      <div className="mland-mosaic__orbit" ref={orbitRef}>
        {nodes.map((n) => (
          <Sat key={n.id} node={n} />
        ))}
      </div>
    </div>
  );
}

function Sat({ node }: { node: OrbitNode }) {
  const urgent = node.tone === "urgent";

  return (
    <div
      className={`mland-mosaic__sat mland-mosaic__sat--${node.id}`}
      style={
        {
          ["--sat-angle" as string]: `${node.angle}deg`,
          ["--sat-radius" as string]: "30%",
        } as CSSProperties
      }
    >
      <div className="mland-mosaic__sat-inner">
        <div className="mland-mosaic__sat-face">
          <div
            className={`mland-mosaic__avatar is-${node.icon} tone-${node.tone}`}
          >
            <span />
          </div>
          <div className={`mland-mosaic__bubble tone-${node.tone}`}>
            {urgent ? <em className="mland-mosaic__urgent">Urgent</em> : null}
            <strong>{node.title}</strong>
            <small>{node.sub}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
