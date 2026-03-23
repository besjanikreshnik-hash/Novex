'use client';

import { useMemo, useRef, useCallback, useState } from 'react';

interface DepthEntry {
  price: string;
  quantity: string;
  total: string;
}

interface DepthChartProps {
  bids: DepthEntry[];
  asks: DepthEntry[];
}

interface TooltipData {
  x: number;
  y: number;
  price: string;
  cumVolume: string;
  side: 'bid' | 'ask';
}

const COLORS = {
  bidFill: 'rgba(0, 214, 143, 0.15)',
  bidStroke: '#00D68F',
  askFill: 'rgba(255, 61, 113, 0.15)',
  askStroke: '#FF3D71',
  grid: 'rgba(255, 255, 255, 0.05)',
  text: 'rgba(255, 255, 255, 0.4)',
  bg: '#151528',
  crosshair: 'rgba(255, 255, 255, 0.2)',
};

const CHART_HEIGHT = 200;
const PADDING = { top: 10, right: 12, bottom: 24, left: 12 };

export function DepthChart({ bids, asks }: DepthChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [containerWidth, setContainerWidth] = useState(560);

  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Build cumulative data
  const { bidPoints, askPoints, minPrice, maxPrice, maxVolume } = useMemo(() => {
    // Bids: sorted highest to lowest price, cumulate from highest to lowest
    const sortedBids = [...bids]
      .map((b) => ({ price: parseFloat(b.price), qty: parseFloat(b.quantity) }))
      .sort((a, b) => b.price - a.price);

    // Asks: sorted lowest to highest price, cumulate from lowest to highest
    const sortedAsks = [...asks]
      .map((a) => ({ price: parseFloat(a.price), qty: parseFloat(a.quantity) }))
      .sort((a, b) => a.price - b.price);

    let cumBid = 0;
    const bidPts = sortedBids.map((b) => {
      cumBid += b.qty;
      return { price: b.price, cumVolume: cumBid };
    });
    // Reverse so we draw from low price (left) to high price (right)
    bidPts.reverse();

    let cumAsk = 0;
    const askPts = sortedAsks.map((a) => {
      cumAsk += a.qty;
      return { price: a.price, cumVolume: cumAsk };
    });

    const allPrices = [...bidPts, ...askPts].map((p) => p.price);
    const min = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const max = allPrices.length > 0 ? Math.max(...allPrices) : 1;
    const maxVol = Math.max(
      bidPts.length > 0 ? Math.max(...bidPts.map((p) => p.cumVolume)) : 0,
      askPts.length > 0 ? Math.max(...askPts.map((p) => p.cumVolume)) : 0,
      1,
    );

    return { bidPoints: bidPts, askPoints: askPts, minPrice: min, maxPrice: max, maxVolume: maxVol };
  }, [bids, asks]);

  const chartW = containerWidth - PADDING.left - PADDING.right;
  const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const scaleX = useCallback(
    (price: number) => {
      if (maxPrice === minPrice) return chartW / 2;
      return ((price - minPrice) / (maxPrice - minPrice)) * chartW;
    },
    [minPrice, maxPrice, chartW],
  );

  const scaleY = useCallback(
    (vol: number) => {
      return chartH - (vol / maxVolume) * chartH;
    },
    [maxVolume, chartH],
  );

  // Build SVG path for area
  const buildAreaPath = useCallback(
    (points: { price: number; cumVolume: number }[]) => {
      if (points.length === 0) return '';

      // Step-style path for order book look
      const stepParts: string[] = [];
      for (let i = 0; i < points.length; i++) {
        const x = scaleX(points[i]!.price);
        const y = scaleY(points[i]!.cumVolume);
        if (i === 0) {
          stepParts.push(`M${x},${y}`);
        } else {
          const prevY = scaleY(points[i - 1]!.cumVolume);
          stepParts.push(`L${x},${prevY}`);
          stepParts.push(`L${x},${y}`);
        }
      }

      // Close to baseline
      const lastX = scaleX(points[points.length - 1]!.price);
      const firstX = scaleX(points[0]!.price);
      stepParts.push(`L${lastX},${chartH}`);
      stepParts.push(`L${firstX},${chartH}`);
      stepParts.push('Z');

      return stepParts.join(' ');
    },
    [scaleX, scaleY, chartH],
  );

  const buildLinePath = useCallback(
    (points: { price: number; cumVolume: number }[]) => {
      if (points.length === 0) return '';
      const parts: string[] = [];
      for (let i = 0; i < points.length; i++) {
        const x = scaleX(points[i]!.price);
        const y = scaleY(points[i]!.cumVolume);
        if (i === 0) {
          parts.push(`M${x},${y}`);
        } else {
          const prevY = scaleY(points[i - 1]!.cumVolume);
          parts.push(`L${x},${prevY}`);
          parts.push(`L${x},${y}`);
        }
      }
      return parts.join(' ');
    },
    [scaleX, scaleY],
  );

  // Price axis labels
  const priceLabels = useMemo(() => {
    const count = 5;
    const labels: { price: number; x: number }[] = [];
    for (let i = 0; i <= count; i++) {
      const price = minPrice + ((maxPrice - minPrice) * i) / count;
      labels.push({ price, x: scaleX(price) });
    }
    return labels;
  }, [minPrice, maxPrice, scaleX]);

  // Volume axis labels
  const volLabels = useMemo(() => {
    const count = 3;
    const labels: { vol: number; y: number }[] = [];
    for (let i = 0; i <= count; i++) {
      const vol = (maxVolume * i) / count;
      labels.push({ vol, y: scaleY(vol) });
    }
    return labels;
  }, [maxVolume, scaleY]);

  // Mouse handler for tooltip
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - PADDING.left;

      // Map mouseX to price
      const price = minPrice + (mouseX / chartW) * (maxPrice - minPrice);

      // Find closest point
      const allPoints = [
        ...bidPoints.map((p) => ({ ...p, side: 'bid' as const })),
        ...askPoints.map((p) => ({ ...p, side: 'ask' as const })),
      ];

      let closest = allPoints[0];
      let minDist = Infinity;
      for (const pt of allPoints) {
        const dist = Math.abs(pt.price - price);
        if (dist < minDist) {
          minDist = dist;
          closest = pt;
        }
      }

      if (closest) {
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          price: closest.price.toFixed(2),
          cumVolume: closest.cumVolume.toFixed(4),
          side: closest.side,
        });
      }
    },
    [bidPoints, askPoints, minPrice, maxPrice, chartW],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (bids.length === 0 && asks.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-nvx-text-muted text-xs"
        style={{ height: CHART_HEIGHT, background: COLORS.bg }}
      >
        No depth data available
      </div>
    );
  }

  return (
    <div ref={measuredRef} className="relative w-full" style={{ height: CHART_HEIGHT, background: COLORS.bg }}>
      <svg
        ref={svgRef}
        width={containerWidth}
        height={CHART_HEIGHT}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
      >
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Grid lines */}
          {volLabels.map((l, i) => (
            <line
              key={`grid-${i}`}
              x1={0}
              x2={chartW}
              y1={l.y}
              y2={l.y}
              stroke={COLORS.grid}
              strokeWidth={1}
            />
          ))}

          {/* Bid area (green) */}
          <path d={buildAreaPath(bidPoints)} fill={COLORS.bidFill} />
          <path d={buildLinePath(bidPoints)} fill="none" stroke={COLORS.bidStroke} strokeWidth={1.5} />

          {/* Ask area (red) */}
          <path d={buildAreaPath(askPoints)} fill={COLORS.askFill} />
          <path d={buildLinePath(askPoints)} fill="none" stroke={COLORS.askStroke} strokeWidth={1.5} />

          {/* Price axis labels */}
          {priceLabels.map((l, i) => (
            <text
              key={`price-${i}`}
              x={l.x}
              y={chartH + 16}
              textAnchor="middle"
              fill={COLORS.text}
              fontSize={9}
              fontFamily="monospace"
            >
              {l.price >= 1000 ? `${(l.price / 1000).toFixed(1)}k` : l.price.toFixed(2)}
            </text>
          ))}

          {/* Crosshair on hover */}
          {tooltip && (
            <line
              x1={tooltip.x - PADDING.left}
              x2={tooltip.x - PADDING.left}
              y1={0}
              y2={chartH}
              stroke={COLORS.crosshair}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 rounded text-[10px] font-mono border"
          style={{
            left: Math.min(tooltip.x + 12, containerWidth - 130),
            top: Math.max(tooltip.y - 40, 4),
            background: 'rgba(21, 21, 40, 0.95)',
            borderColor: tooltip.side === 'bid' ? COLORS.bidStroke : COLORS.askStroke,
            color: '#fff',
          }}
        >
          <div>
            Price: <span style={{ color: tooltip.side === 'bid' ? COLORS.bidStroke : COLORS.askStroke }}>{tooltip.price}</span>
          </div>
          <div>
            Cum. Vol: <span className="text-nvx-text-secondary">{tooltip.cumVolume}</span>
          </div>
        </div>
      )}
    </div>
  );
}
