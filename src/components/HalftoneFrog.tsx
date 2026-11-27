/**
 * Halftone frog tucked into the top-right corner of the header: the mascot
 * artwork is the mask, so the dot screen keeps the exact silhouette, with black
 * diamonds punching out the pupils and a soft fade where it meets the page.
 */
export default function HalftoneFrog({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="cp-halftone" width="3.1" height="3.1" patternUnits="userSpaceOnUse"
          patternTransform="rotate(27)">
          <circle cx="1.55" cy="1.55" r="0.98" fill="currentColor" />
        </pattern>
        <linearGradient id="cp-halftone-fade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.62" stopColor="#fff" />
        </linearGradient>
        <mask id="cp-halftone-fade-mask">
          <rect x="0" y="0" width="200" height="200" fill="url(#cp-halftone-fade)" />
        </mask>
        <mask id="cp-halftone-mask">
          <g transform="rotate(-13 100 100)">
            <image href="/frogs/mascot.png" x="-8" y="-16" width="214" height="206" />
          </g>
        </mask>
      </defs>
      <g mask="url(#cp-halftone-fade-mask)" opacity="0.9">
        <rect x="0" y="0" width="200" height="200" fill="url(#cp-halftone)" mask="url(#cp-halftone-mask)" />
      </g>
    </svg>
  );
}
