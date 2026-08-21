import clsx from 'clsx';

/**
 * Static inline-SVG sparkline (no animation — motion serves state only).
 * Green when the last close >= the first, red otherwise. Renders nothing
 * for fewer than 2 points.
 */
export default function Sparkline({ data, className }: { data: number[] | null | undefined; className?: string }) {
  if (!data || data.length < 2) return null;

  const W = 100;
  const H = 32;
  const PAD = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // flat series -> horizontal mid-line

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const up = data[data.length - 1] >= data[0];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={clsx('h-10 w-full', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={up ? '#34D399' : '#F87171'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
