import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MathText } from '../math';
import { scientistText } from '../i18n';
import { findScientist, Portrait } from './portrait';
import { STORY_TEXT as T } from './story-text';

/**
 * History in context (#134): while a step that names scientists is read, small cards sit in a corner of the
 * live figure: the owner's portrait slot (#98), name, years and one line of what they found. "More" opens two or
 * three sentences in place. A step change fades the cards out and the next step's cards in.
 */
export function ScientistCards({ slugs, step }: { slugs: string[]; step: number }) {
  const key = `${step}:${slugs.join(',')}`;
  const [shown, setShown] = useState({ key, slugs, leaving: false });
  const timer = useRef(0);
  useEffect(() => {
    if (key === shown.key) return;
    // fade the old cards out, then bring in the new ones
    setShown((s) => ({ ...s, leaving: true }));
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown({ key, slugs, leaving: false }), shown.slugs.length ? 260 : 0);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!shown.slugs.length) return null;
  return (
    <aside className={`scientist-cards${shown.leaving ? ' is-leaving' : ''}`} aria-label={T.scientists} data-testid="scientist-cards" key={shown.key}>
      {shown.slugs.map((slug) => <ScientistCard key={slug} slug={slug} />)}
    </aside>
  );
}

function ScientistCard({ slug }: { slug: string }) {
  const person = findScientist(slug);
  const [open, setOpen] = useState(false);
  if (!person) return null;
  const more = person.more ? scientistText(slug, 'more', person.more) : null;
  return (
    <article className={`scientist-card${open ? ' is-open' : ''}`} data-slug={slug}>
      <Portrait slug={slug} />
      <div className="scientist-card-text">
        <p className="scientist-card-name">
          <b>{scientistText(slug, 'name', person.name)}</b> <span>{person.years}</span>
        </p>
        <p className="scientist-card-line"><MathText text={scientistText(slug, 'contribution', person.contribution)} /></p>
        {open && more && <p className="scientist-card-more"><MathText text={more} /></p>}
        {more && (
          <button type="button" className="scientist-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? T.less : T.more} <ChevronDown size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}
