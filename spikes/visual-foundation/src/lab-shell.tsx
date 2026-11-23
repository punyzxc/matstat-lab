import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, BookOpen, X } from 'lucide-react';

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
function Notes({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      className="lab-notes"
      ref={ref}
      aria-labelledby="notes-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div>
        <div className="notes-chrome">
          <BookOpen size={17} />
          <button onClick={close} aria-label="Close notes">
            <X size={17} />
          </button>
        </div>
        <h2 id="notes-title">Lab notes</h2>
        <h3>Geometric studies</h3>
        <p>
          The trefoil winds twice around a torus and three times through its hole. The yellow cross-section
          sits at the probability coordinate F(x) of the inspected draw. Choose the draw readout to advance
          through the sample. Drag it horizontally or use the left and right arrow keys to turn it. The Earth
          study projects Natural Earth land data onto a rotating sphere. Its links are simulated.
        </p>
        <h3>Reading the sample</h3>
        <p>
          Each experiment uses a seeded sequence. The trace shows the first 48 draws in order. The ASCII
          histogram counts observations in 34 equal-width bins. Sample variance uses n − 1.
        </p>
        <h3>Experiment index</h3>
        <p>
          Open an instrument directly from its orbital preview. Each preview shows its most recent saved
          result or a labeled example. Distribution Explorer generates and exports samples. The other five
          studies explore prefixes of the same completed run.
        </p>
        <a
          href="https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/"
          target="_blank"
          rel="noreferrer"
        >
          Earth geometry source <ArrowUpRight size={14} />
        </a>
      </div>
    </dialog>
  );
}
export function LabHeader({ home = false, action }: { home?: boolean; action?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <>
      <header className="lab-bar">
        <div className="lab-brand">
          <a href="#observatory" aria-label="STATUM LAB home">
            <LabMark />
            <strong>
              STATUM<span>LAB</span>
            </strong>
          </a>
        </div>
        <nav aria-label="Laboratory navigation">
          <a href="#observatory" aria-current={home ? 'page' : undefined}>
            Observatory
          </a>
          <a href="#experiments">Experiments</a>
          <button ref={trigger} onClick={() => setOpen(true)} aria-haspopup="dialog">
            Lab notes
          </button>
        </nav>
        <div className="lab-session">
          {action ?? (
            <>
              <i /> Local session
            </>
          )}
        </div>
      </header>
      {open && <Notes close={close} />}
    </>
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
