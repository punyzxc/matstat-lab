import type { ReactNode } from 'react';
import { ArrowUpRight, BookOpen, GraduationCap } from 'lucide-react';
import { orbits, type OrbitId } from './stations/catalog';
import { orbitHash } from './stations/route';

export function LabMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className="lab-mark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="20" cy="20" rx="6" ry="16.5" transform={`rotate(${i * 22.5} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="2.2" fill="currentColor" />
    </svg>
  );
}
export function LabNotesContent() {
  return (
    <div className="lab-notes-body">
      <h3>Geometric studies</h3>
        <p>
          The trefoil winds twice around a torus and three times through its hole. The yellow cross-section
          sits at the probability coordinate F(x) of the inspected draw. Choose the draw readout to advance
          through the sample. Drag it horizontally or use the left and right arrow keys to turn it. The Earth
          study projects Natural Earth land data onto a rotating sphere. The ASCII satellites, starfield and
          links are simulated.
        </p>
        <h3>Reading the sample</h3>
        <p>
          Each experiment uses a seeded sequence. The trace shows the first 48 draws in order. The ASCII
          histogram counts observations in 34 equal-width bins. Sample variance uses n − 1.
        </p>
        <h3>Moving around</h3>
      <p>
        Choose a lecture orbit in the top bar, then open a station from its card. A station opens inside the
        scene and Escape closes it. The address bar keeps the station, its parameters and its seed, so a copied
        link reopens the same run.
      </p>
        <a
          href="https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/"
          target="_blank"
          rel="noreferrer"
        >
          Earth geometry source <ArrowUpRight size={14} aria-hidden="true" />
        </a>
    </div>
  );
}
export function LabHeader({ orbit, action }: { orbit?: OrbitId | null; action?: ReactNode }) {
  return (
    <header className="lab-bar">
      <div className="lab-brand">
        <a href={orbit ? orbitHash(orbit) : '#'} aria-label="STATUM LAB, back to the scene">
          <LabMark />
          <strong translate="no">
            STATUM<span>LAB</span>
          </strong>
        </a>
      </div>
      <nav aria-label="Lecture orbits" className="orbit-switch">
        {orbits.map((o) => (
          <a key={o.id} href={orbitHash(o.id)} aria-current={orbit === o.id ? 'true' : undefined} title={`Lectures ${o.lectures}`}>
            <b>{o.numeral}</b> {o.name}
          </a>
        ))}
      </nav>
      <div className="lab-session">
        {action}
        <a href="#lectures" className="lab-tool"><GraduationCap size={14} aria-hidden="true" /> Lectures</a>
        <a href="#record" className="lab-tool">Sample record</a>
        <a href="#notes" className="lab-tool"><BookOpen size={14} aria-hidden="true" /> Lab notes</a>
      </div>
    </header>
  );
}
export function FigureCaption({ number, children }: { number: string; children: ReactNode }) {
  return (
    <span className="fig-caption">
      <span className="fig-cross" aria-hidden="true" />
      <span className="fig-id">FIG. {number}</span>
      <i />
      {children}
    </span>
  );
}
export function LabFooter() {
  return (
    <footer className="lab-footer">
      <span>STATUM LAB</span>
      <span>Monte Carlo laboratory</span>
    </footer>
  );
}
