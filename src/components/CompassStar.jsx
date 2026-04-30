/**
 * Thin-line compass-star mark inspired by the Waypoint Periodontics logo.
 * Used as the brand mark in the sidebar and (subtly) on dark accent surfaces.
 *
 * Pure SVG so it scales crisply at any size and can be tinted via `currentColor`
 * (the rose-gold accent in our palette).
 */
export default function CompassStar({ size = 32, className = '', strokeWidth = 1 }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="32" cy="32" r="22" opacity="0.5" />
      {/* Cardinal long points (N S E W) — long, narrow diamonds */}
      <path d="M32 4 L34 30 L32 60 L30 30 Z" />
      <path d="M4 32 L30 30 L60 32 L30 34 Z" />
      {/* Diagonal short points (NE SE SW NW) */}
      <path d="M48 16 L34 30 L48 16 Z" opacity="0.55" />
      <path d="M16 48 L30 34 L16 48 Z" opacity="0.55" />
      <path d="M16 16 L30 30 L16 16 Z" opacity="0.55" />
      <path d="M48 48 L34 34 L48 48 Z" opacity="0.55" />
      <path d="M16 16 L30 30" />
      <path d="M48 16 L34 30" />
      <path d="M16 48 L30 34" />
      <path d="M48 48 L34 34" />
    </svg>
  )
}
