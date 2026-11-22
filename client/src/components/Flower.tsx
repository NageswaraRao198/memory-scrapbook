interface FlowerProps {
  color: string;
  /** 1-5; shapes the bloom without ranking it as better or worse. */
  intensity?: number | null;
  size?: number;
  className?: string;
}

/** A small hand-drawn style bloom. Petal count follows intensity; colour follows mood. */
export function Flower({ color, intensity, size = 40, className }: FlowerProps) {
  const level = intensity ?? 3;
  const petals = 4 + level;
  const petalLength = 9 + level * 1.4;
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" className={className} aria-hidden="true" focusable="false">
      <g>
        {Array.from({ length: petals }, (_, i) => (
          <ellipse
            key={i}
            cx="0"
            cy={-petalLength * 0.62}
            rx={4.2 + level * 0.25}
            ry={petalLength * 0.62}
            fill={color}
            fillOpacity="0.82"
            stroke="rgba(60,40,30,0.18)"
            strokeWidth="0.6"
            transform={`rotate(${(360 / petals) * i})`}
          />
        ))}
        <circle r="3.8" fill="#FFF6E3" stroke="rgba(60,40,30,0.25)" strokeWidth="0.6" />
        <circle r="1.6" fill={color} fillOpacity="0.9" />
      </g>
    </svg>
  );
}

export function Sprout({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path d="M16 28V16" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M16 18c-5 0-7-3-7-6 5 0 7 2 7 6zM16 15c0-4 2-6 7-6 0 4-2 6-7 6z" fill="var(--sage)" fillOpacity="0.8" />
    </svg>
  );
}
