// Milenium Motos crown mark. Geometry taken from the Claude Design prototype
// (3-peak crown + base band), with a gold gradient and jeweled peaks to match
// the reference login/sidebar screens.
export default function Crown({ size = 26 }: { size?: number }) {
  const gradId = 'crownGold';
  return (
    <svg
      width={size} height={Math.round(size * 0.72)}
      viewBox="-165 -110 330 235" xmlns="http://www.w3.org/2000/svg"
      aria-hidden focusable="false" style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7D24B" />
          <stop offset="1" stopColor="#D99A2B" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradId})`}>
        <path d="M-120 60 L-150 -60 L-70 10 L0 -90 L70 10 L150 -60 L120 60 Z" />
        <rect x="-120" y="70" width="240" height="34" rx="10" />
      </g>
      <g fill="#FCE9A6">
        <circle cx="0" cy="-90" r="15" />
        <circle cx="-150" cy="-60" r="14" />
        <circle cx="150" cy="-60" r="14" />
      </g>
    </svg>
  );
}
