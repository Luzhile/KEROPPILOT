/**
 * The KEROPPILOT mascots. Three supplied stickers (waving, hands-on-cheeks,
 * on-the-phone) are keyed to transparency and re-coloured to the exact palette
 * of the slider frog — body, cheek, ink and the red-striped outfit — so every
 * frog in the app reads as one set.
 */
export const FROG_VARIANTS = ['smile', 'wink', 'surprised', 'love', 'sad', 'annoyed'] as const;
export type FrogVariant = (typeof FROG_VARIANTS)[number];
export type FrogPose = 'wave' | 'hands' | 'phone';

const ART: Record<FrogPose, { src: string; ratio: number }> = {
  wave: { src: '/frogs/keroppi-wave.png', ratio: 568 / 488 },
  hands: { src: '/frogs/keroppi-hands.png', ratio: 260 / 211 },
  phone: { src: '/frogs/keroppi-phone.png', ratio: 648 / 565 },
};

interface Props {
  size?: number;
  className?: string;
  variant?: FrogVariant;
  /** Which sticker to show; defaults to the waving one. */
  pose?: FrogPose;
  /** Accessible label; the mascot is decorative unless a title is given. */
  title?: string;
}

export default function FrogMark({ size = 36, className, variant = 'smile', pose, title }: Props) {
  const key: FrogPose = pose ?? (variant === 'sad' || variant === 'surprised' || variant === 'annoyed'
    ? 'hands'
    : 'wave');
  const art = ART[key];
  return (
    <img
      src={art.src}
      width={size}
      height={Math.round(size * art.ratio)}
      className={className}
      data-mood={variant}
      data-pose={key}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
      decoding="async"
    />
  );
}

/** Same artwork as a flat silhouette for the oversized, low-contrast watermarks. */
export function FrogFace({
  className,
  layer = 'solid',
  pose = 'wave',
}: {
  className?: string;
  layer?: 'solid' | 'outline';
  pose?: FrogPose;
}) {
  if (layer === 'outline') {
    return (
      <span className={`frog-face-outline ${className ?? ''}`} aria-hidden="true">
        <i className="frog-face-fill" />
        <i className="frog-face-line" />
      </span>
    );
  }
  return <span className={`frog-face frog-face--${pose} ${className ?? ''}`} aria-hidden="true" />;
}
