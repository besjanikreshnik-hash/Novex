'use client';

function fmtUsd(val: number): string {
  return val.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function DonutChart({
  slices,
}: {
  slices: { label: string; value: number; color: string; percent: number }[];
}) {
  const radius = 80;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px] max-h-[220px]">
      {slices.map((slice, i) => {
        const dashLength = (slice.percent / 100) * circumference;
        const dashOffset = -offset;
        offset += dashLength;
        return (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            className="transition-all duration-500"
          />
        );
      })}
      {/* Center text */}
      <text
        x="100"
        y="94"
        textAnchor="middle"
        className="fill-nvx-text-muted text-[10px]"
        fontSize="10"
      >
        Total Value
      </text>
      <text
        x="100"
        y="112"
        textAnchor="middle"
        className="fill-nvx-text-primary text-[14px] font-bold"
        fontSize="14"
        fontWeight="bold"
      >
        {slices.length > 0
          ? fmtUsd(slices.reduce((s, sl) => s + sl.value, 0))
          : '$0.00'}
      </text>
    </svg>
  );
}
