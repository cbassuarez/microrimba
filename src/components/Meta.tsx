import { useEffect } from 'react';

type MetaProps = {
  title?: string;
  description?: string;
  canonicalPath?: string;
};

const SITE_NAME = 'Microtonal Marimba Instruments';
const DEFAULT_DESCRIPTION = 'A measured, playable microtonal marimba reference library for composers and students: recordings, analysis, and tunings.';
const SITE_URL = 'https://cbassuarez.github.io/microrimba/';

function normalizeCanonicalPath(canonicalPath: string) {
  if (!canonicalPath) return '/';
  return canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
}

export function Meta({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
}: MetaProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;

    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta');
      descriptionTag.setAttribute('name', 'description');
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute('content', description);

    if (canonicalPath) {
      const normalizedPath = normalizeCanonicalPath(canonicalPath);
      const canonicalUrl = new URL(normalizedPath === '/' ? '' : normalizedPath.replace(/^\//, ''), SITE_URL).toString();

      let canonicalTag = document.querySelector('link[rel="canonical"]');
      if (!canonicalTag) {
        canonicalTag = document.createElement('link');
        canonicalTag.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalTag);
      }
      canonicalTag.setAttribute('href', canonicalUrl);
    }
  }, [canonicalPath, description, title]);

  return null;
}

export { DEFAULT_DESCRIPTION };
