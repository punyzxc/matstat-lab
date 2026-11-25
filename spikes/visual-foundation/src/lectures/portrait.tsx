import { useEffect, useState } from 'react';
import { useStationReducedMotion } from '../motion-preference';
import { fitPortrait, PORTRAIT, portraitScale, revealFrames, revealPortrait, type Scientist } from './script';
import roster from '../../lectures/scientists.json';
import { MathText } from '../math';
import { scientistText, t } from '../i18n';
import './lectures.css';

const scientists = (roster as { scientists: Scientist[] }).scientists;
export const findScientist = (slug: string) => scientists.find((s) => s.slug === slug);

const portraitCache = new Map<string, Promise<string | null>>();
function loadPortrait(slug: string) {
  let p = portraitCache.get(slug);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}portraits/${slug}.txt`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.text() : null))
      .then(fitPortrait)
      .catch(() => {
        portraitCache.delete(slug); // a network error is retried on the next visit
        return null;
      });
    portraitCache.set(slug, p);
  }
  return p;
}

/** The owner's ASCII portrait in a fixed slot, or a labelled placeholder while the file is empty or missing. */
export function Portrait({ slug }: { slug: string }) {
  const person = findScientist(slug);
  const [art, setArt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadPortrait(slug).then((a) => live && setArt(a));
    return () => {
      live = false;
    };
  }, [slug]);
  const name = person ? scientistText(slug, 'name', person.name) : slug;
  return (
    <figure className="portrait" data-slug={slug} data-state={art ? 'art' : 'placeholder'} style={{ ['--cols' as string]: PORTRAIT.columns, ['--lines' as string]: PORTRAIT.lines }}>
      {art ? (
        <PortraitArt art={art} name={name} />
      ) : (
        <div className="portrait-art portrait-placeholder" aria-hidden="true">
          <span>{initials(name)}</span>
          <small>{t('portrait', 'портрет')} · {slug}.txt</small>
        </div>
      )}
      <figcaption>
        <b>{name}</b> {person && <span className="portrait-years">{person.years}</span>}
        {person && <span className="portrait-line"><MathText text={scientistText(slug, 'contribution', person.contribution)} /></span>}
      </figcaption>
    </figure>
  );
}
/**
 * The art types itself in with a short diagonal sweep (about 0.8 s), then stays. Art larger than the slot is
 * scaled down as a whole, so no line ever wraps. Reduced motion shows it at once.
 */
function PortraitArt({ art, name }: { art: string; name: string }) {
  const reduced = useStationReducedMotion();
  const frames = revealFrames(art);
  const [k, setK] = useState(() => (reduced ? frames : 0));
  useEffect(() => {
    if (reduced) return setK(frames);
    setK(0);
    const t0 = performance.now(), duration = 800;
    let raf = 0;
    const tick = (now: number) => {
      const next = Math.ceil((frames * (now - t0)) / duration);
      setK(next);
      if (next < frames) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [art, frames, reduced]);
  const { scale } = portraitScale(art);
  const typing = k < frames;
  return (
    <pre className="portrait-art" role="img" aria-label={t(`ASCII portrait of ${name}`, `ASCII-портрет: ${name}`)} data-typing={typing || undefined}>
      <span className="portrait-text" style={{ ['--fit' as string]: scale }}>{typing ? revealPortrait(art, k) : art}</span>
    </pre>
  );
}

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w) && !/^(de|von|van|le|la)$/.test(w))
    .map((w) => w[0])
    .slice(0, 3)
    .join('');
