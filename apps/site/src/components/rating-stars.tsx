interface RatingStarsProps {
  value: number;
  max?: number;
  size?: number;
  label?: string;
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" strokeLinejoin="round" />
    </svg>
  );
}

export function RatingStars({ value, max = 10, size = 16, label }: RatingStarsProps) {
  const rounded = Math.round(value);
  const stars = Array.from({ length: max }, (_, i) => i < rounded);

  return (
    <span
      className="rating-stars"
      role="img"
      aria-label={label ? `${label}: ${value.toFixed(1)} из ${max}` : `${value.toFixed(1)} из ${max}`}
    >
      {stars.map((filled, i) => (
        <Star key={i} filled={filled} size={size} />
      ))}
    </span>
  );
}
