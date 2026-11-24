import { Component, useEffect, useRef, type ReactNode } from 'react';

/** A failing station must never take the scene down with it. */
class StationBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error ? <p className="station-status" role="alert">This station failed to render: {this.state.error}</p> : this.props.children;
  }
}
import { X } from 'lucide-react';

/**
 * A station or drawer opened inside the scene. The scene, the header and the orbit switcher stay
 * visible; only this panel scrolls. Escape or the close button returns to the scene; the scene
 * moves focus back to the card or tool that opened the panel.
 */
export function SceneDock({
  title,
  eyebrow,
  lead,
  side = 'center',
  onClose,
  children,
  testId,
  className,
}: {
  title: string;
  eyebrow?: ReactNode;
  lead?: ReactNode;
  side?: 'center' | 'end';
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <section ref={panel} className={`scene-dock scene-dock--${side}${className ? ` ${className}` : ''}`} aria-labelledby="dock-title" data-testid={testId}>
      <header className="scene-dock-head">
        <div>
          {eyebrow && <p className="edition">{eyebrow}</p>}
          <h2 id="dock-title" tabIndex={-1}>{title}</h2>
          {lead && <p className="scene-dock-lead">{lead}</p>}
        </div>
        <button type="button" className="scene-dock-close" onClick={onClose} aria-label={`Close ${title}`} title="Close (Esc)">
          <X size={17} aria-hidden="true" />
        </button>
      </header>
      <div className="scene-dock-body"><StationBoundary>{children}</StationBoundary></div>
    </section>
  );
}
