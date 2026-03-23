'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { marketApi } from '@/lib/api';

// ── Indicator calculation helpers ─────────────────────────

function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      result.push(sum / period);
    }
  }
  return result;
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[j];
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push(closes[i] * k + prev * (1 - k));
    }
  }
  return result;
}

function calcRSI(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  result.push(null); // index 0, no change
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

function calcMACD(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = calcEMA(closes, fastPeriod);
  const slowEma = calcEMA(closes, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      macdLine.push(fastEma[i]! - slowEma[i]!);
    } else {
      macdLine.push(null);
    }
  }

  // Calculate signal as EMA of MACD values
  const macdValues = macdLine.filter((v) => v !== null) as number[];
  const signalEma = calcEMA(macdValues, signalPeriod);

  // Map signal back to full-length array
  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let macdIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      const sigVal = signalEma[macdIdx] ?? null;
      signal.push(sigVal);
      histogram.push(sigVal !== null ? macdLine[i]! - sigVal : null);
      macdIdx++;
    } else {
      signal.push(null);
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal, histogram };
}

function calcBollingerBands(
  closes: number[],
  period: number,
  stdDevMultiplier: number,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSqDiff = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = closes[j] - middle[i]!;
        sumSqDiff += diff * diff;
      }
      const stdDev = Math.sqrt(sumSqDiff / period);
      upper.push(middle[i]! + stdDevMultiplier * stdDev);
      lower.push(middle[i]! - stdDevMultiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}

// ── Types ─────────────────────────────────────────────────

interface PriceChartProps {
  symbol: string;
}

type ChartTimeFrame = '1h' | '4h' | '1d' | '1w' | '1M';
const timeFrames: ChartTimeFrame[] = ['1h', '4h', '1d', '1w', '1M'];

type IndicatorKey = 'MA' | 'RSI' | 'MACD' | 'BB';

export function PriceChart({ symbol }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const rsiChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const macdChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null);
  const candleSeriesRef = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addCandlestickSeries']> | null>(null);
  const volumeSeriesRef = useRef<ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addHistogramSeries']> | null>(null);

  // Indicator series refs
  const indicatorSeriesRef = useRef<{
    sma7?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    sma25?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    ema99?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    bbUpper?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    bbMiddle?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    bbLower?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    rsiLine?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    rsiOverbought?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    rsiOversold?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    macdLine?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    macdSignal?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addLineSeries']>;
    macdHistogram?: ReturnType<ReturnType<typeof import('lightweight-charts').createChart>['addHistogramSeries']>;
  }>({});

  const [timeFrame, setTimeFrame] = useState<ChartTimeFrame>('1h');
  const [loading, setLoading] = useState(true);
  const [activeIndicators, setActiveIndicators] = useState<Record<IndicatorKey, boolean>>({
    MA: true,
    RSI: false,
    MACD: false,
    BB: false,
  });
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const candleDataRef = useRef<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[]>([]);

  const toggleIndicator = (key: IndicatorKey) => {
    setActiveIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Shared chart theme options ──────────────────────────
  const getSubChartOptions = useCallback(
    (height: number) => ({
      layout: {
        background: { type: 'Solid' as const, color: '#151528' },
        textColor: '#A0A0C0',
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(42, 42, 74, 0.3)' },
        horzLines: { color: 'rgba(42, 42, 74, 0.3)' },
      },
      rightPriceScale: {
        borderColor: '#2A2A4A',
      },
      timeScale: {
        borderColor: '#2A2A4A',
        timeVisible: true,
        secondsVisible: false,
        visible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(108, 92, 231, 0.4)', width: 1 as 1, style: 2 as 2 },
        horzLine: { color: 'rgba(108, 92, 231, 0.4)', width: 1 as 1, style: 2 as 2 },
      },
      handleScroll: true,
      handleScale: true,
      height,
    }),
    [],
  );

  // ── Init lightweight-charts ────────────────────────────
  const initChart = useCallback(async () => {
    if (!chartContainerRef.current) return;

    const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    if (rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
    }
    if (macdChartRef.current) {
      macdChartRef.current.remove();
      macdChartRef.current = null;
    }
    indicatorSeriesRef.current = {};

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#151528' },
        textColor: '#A0A0C0',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(42, 42, 74, 0.3)' },
        horzLines: { color: 'rgba(42, 42, 74, 0.3)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(108, 92, 231, 0.4)', width: 1, style: 2 },
        horzLine: { color: 'rgba(108, 92, 231, 0.4)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#2A2A4A',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#2A2A4A',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00D68F',
      downColor: '#FF3D71',
      borderUpColor: '#00D68F',
      borderDownColor: '#FF3D71',
      wickUpColor: '#00D68F',
      wickDownColor: '#FF3D71',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#6C5CE7',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      try { chart.remove(); } catch { /* already disposed */ }
      try { rsiChartRef.current?.remove(); } catch { /* already disposed */ }
      try { macdChartRef.current?.remove(); } catch { /* already disposed */ }
    };
  }, []);

  // Initialize chart once
  useEffect(() => {
    const cleanup = initChart();
    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [initChart]);

  // ── Sync time scales across sub-charts ─────────────────
  const syncTimeScales = useCallback(() => {
    const main = chartRef.current;
    const rsi = rsiChartRef.current;
    const macd = macdChartRef.current;
    if (!main) return;

    const charts = [rsi, macd].filter(Boolean) as NonNullable<typeof rsi>[];
    if (charts.length === 0) return;

    let syncing = false;
    const mainTs = main.timeScale();

    const handleMainScroll = () => {
      if (syncing) return;
      syncing = true;
      const range = mainTs.getVisibleLogicalRange();
      if (range) {
        charts.forEach((c) => c.timeScale().setVisibleLogicalRange(range));
      }
      syncing = false;
    };

    mainTs.subscribeVisibleLogicalRangeChange(handleMainScroll);

    charts.forEach((c) => {
      c.timeScale().subscribeVisibleLogicalRangeChange(() => {
        if (syncing) return;
        syncing = true;
        const range = c.timeScale().getVisibleLogicalRange();
        if (range) {
          mainTs.setVisibleLogicalRange(range);
          charts.forEach((oc) => {
            if (oc !== c) oc.timeScale().setVisibleLogicalRange(range);
          });
        }
        syncing = false;
      });
    });
  }, []);

  // ── Update indicator series ────────────────────────────
  const updateIndicators = useCallback(async () => {
    const chart = chartRef.current;
    const candles = candleDataRef.current;
    if (!chart || candles.length === 0) return;

    const { createChart } = await import('lightweight-charts');
    const closes = candles.map((c) => c.close);
    const times = candles.map(
      (c) => (c.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    );

    // Helper to build line data
    const buildLineData = (values: (number | null)[]) =>
      values
        .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
        .filter(Boolean) as { time: import('lightweight-charts').UTCTimestamp; value: number }[];

    // ── MA indicators ────────────────────────────────────
    // Remove old MA series
    if (indicatorSeriesRef.current.sma7) {
      try { chart.removeSeries(indicatorSeriesRef.current.sma7); } catch { /* */ }
      indicatorSeriesRef.current.sma7 = undefined;
    }
    if (indicatorSeriesRef.current.sma25) {
      try { chart.removeSeries(indicatorSeriesRef.current.sma25); } catch { /* */ }
      indicatorSeriesRef.current.sma25 = undefined;
    }
    if (indicatorSeriesRef.current.ema99) {
      try { chart.removeSeries(indicatorSeriesRef.current.ema99); } catch { /* */ }
      indicatorSeriesRef.current.ema99 = undefined;
    }

    if (activeIndicators.MA) {
      const sma7Data = buildLineData(calcSMA(closes, 7));
      const sma25Data = buildLineData(calcSMA(closes, 25));
      const ema99Data = buildLineData(calcEMA(closes, 99));

      const sma7Series = chart.addLineSeries({
        color: '#F7D060',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma7Series.setData(sma7Data);
      indicatorSeriesRef.current.sma7 = sma7Series;

      const sma25Series = chart.addLineSeries({
        color: '#5B9BF5',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma25Series.setData(sma25Data);
      indicatorSeriesRef.current.sma25 = sma25Series;

      const ema99Series = chart.addLineSeries({
        color: '#F472B6',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ema99Series.setData(ema99Data);
      indicatorSeriesRef.current.ema99 = ema99Series;
    }

    // ── Bollinger Bands ──────────────────────────────────
    if (indicatorSeriesRef.current.bbUpper) {
      try { chart.removeSeries(indicatorSeriesRef.current.bbUpper); } catch { /* */ }
      indicatorSeriesRef.current.bbUpper = undefined;
    }
    if (indicatorSeriesRef.current.bbMiddle) {
      try { chart.removeSeries(indicatorSeriesRef.current.bbMiddle); } catch { /* */ }
      indicatorSeriesRef.current.bbMiddle = undefined;
    }
    if (indicatorSeriesRef.current.bbLower) {
      try { chart.removeSeries(indicatorSeriesRef.current.bbLower); } catch { /* */ }
      indicatorSeriesRef.current.bbLower = undefined;
    }

    if (activeIndicators.BB) {
      const bb = calcBollingerBands(closes, 20, 2);
      const upperData = buildLineData(bb.upper);
      const middleData = buildLineData(bb.middle);
      const lowerData = buildLineData(bb.lower);

      const bbUpper = chart.addLineSeries({
        color: 'rgba(136, 132, 216, 0.6)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbUpper.setData(upperData);
      indicatorSeriesRef.current.bbUpper = bbUpper;

      const bbMiddle = chart.addLineSeries({
        color: 'rgba(136, 132, 216, 0.9)',
        lineWidth: 1,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbMiddle.setData(middleData);
      indicatorSeriesRef.current.bbMiddle = bbMiddle;

      const bbLower = chart.addLineSeries({
        color: 'rgba(136, 132, 216, 0.6)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      bbLower.setData(lowerData);
      indicatorSeriesRef.current.bbLower = bbLower;
    }

    // ── RSI Chart ────────────────────────────────────────
    if (rsiChartRef.current) {
      try { rsiChartRef.current.remove(); } catch { /* */ }
      rsiChartRef.current = null;
    }

    if (activeIndicators.RSI && rsiContainerRef.current) {
      const rsiChart = createChart(rsiContainerRef.current, {
        ...getSubChartOptions(120),
        rightPriceScale: {
          borderColor: '#2A2A4A',
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
      });

      const rsiData = buildLineData(calcRSI(closes, 14));

      const rsiLine = rsiChart.addLineSeries({
        color: '#A78BFA',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
      });
      rsiLine.setData(rsiData);

      // Overbought line at 70
      const overboughtLine = rsiChart.addLineSeries({
        color: 'rgba(255, 61, 113, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      overboughtLine.setData(
        times.map((t) => ({ time: t, value: 70 })),
      );

      // Oversold line at 30
      const oversoldLine = rsiChart.addLineSeries({
        color: 'rgba(0, 214, 143, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      oversoldLine.setData(
        times.map((t) => ({ time: t, value: 30 })),
      );

      rsiChart.timeScale().fitContent();
      rsiChartRef.current = rsiChart;

      indicatorSeriesRef.current.rsiLine = rsiLine;
      indicatorSeriesRef.current.rsiOverbought = overboughtLine;
      indicatorSeriesRef.current.rsiOversold = oversoldLine;

      // Resize observer for RSI chart
      const rsiResizeObs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          rsiChart.applyOptions({ width: entry.contentRect.width });
        }
      });
      rsiResizeObs.observe(rsiContainerRef.current);
    }

    // ── MACD Chart ───────────────────────────────────────
    if (macdChartRef.current) {
      try { macdChartRef.current.remove(); } catch { /* */ }
      macdChartRef.current = null;
    }

    if (activeIndicators.MACD && macdContainerRef.current) {
      const macdChart = createChart(macdContainerRef.current, {
        ...getSubChartOptions(120),
        rightPriceScale: {
          borderColor: '#2A2A4A',
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
      });

      const macd = calcMACD(closes, 12, 26, 9);
      const macdLineData = buildLineData(macd.macd);
      const signalLineData = buildLineData(macd.signal);
      const histogramData = macd.histogram
        .map((v, i) =>
          v !== null
            ? {
                time: times[i],
                value: v,
                color: v >= 0 ? 'rgba(0, 214, 143, 0.7)' : 'rgba(255, 61, 113, 0.7)',
              }
            : null,
        )
        .filter(Boolean) as {
        time: import('lightweight-charts').UTCTimestamp;
        value: number;
        color: string;
      }[];

      const macdHistSeries = macdChart.addHistogramSeries({
        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macdHistSeries.setData(histogramData);

      const macdLineSeries = macdChart.addLineSeries({
        color: '#5B9BF5',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
      });
      macdLineSeries.setData(macdLineData);

      const signalLineSeries = macdChart.addLineSeries({
        color: '#F7A35C',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
      });
      signalLineSeries.setData(signalLineData);

      macdChart.timeScale().fitContent();
      macdChartRef.current = macdChart;

      indicatorSeriesRef.current.macdLine = macdLineSeries;
      indicatorSeriesRef.current.macdSignal = signalLineSeries;
      indicatorSeriesRef.current.macdHistogram = macdHistSeries;

      // Resize observer for MACD chart
      const macdResizeObs = new ResizeObserver((entries) => {
        for (const entry of entries) {
          macdChart.applyOptions({ width: entry.contentRect.width });
        }
      });
      macdResizeObs.observe(macdContainerRef.current);
    }

    // Sync time scales
    syncTimeScales();
  }, [activeIndicators, getSubChartOptions, syncTimeScales]);

  // Re-render indicators when toggles change
  useEffect(() => {
    updateIndicators();
  }, [updateIndicators]);

  // ── Fetch candle data ──────────────────────────────────
  const fetchCandles = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    try {
      setLoading(true);
      const candles = await marketApi.getCandles(symbol, timeFrame);

      if (!candles || candles.length === 0) {
        setLoading(false);
        return;
      }

      candleDataRef.current = candles;

      const candleChartData = candles.map((c) => ({
        time: (c.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const volumeChartData = candles.map((c) => ({
        time: (c.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0, 214, 143, 0.3)' : 'rgba(255, 61, 113, 0.3)',
      }));

      candleSeriesRef.current.setData(candleChartData);
      volumeSeriesRef.current.setData(volumeChartData);
      chartRef.current?.timeScale().fitContent();

      // Update indicators with new data
      await updateIndicators();
    } catch {
      // silently fail, chart stays empty
    } finally {
      setLoading(false);
    }
  }, [symbol, timeFrame, updateIndicators]);

  // Fetch on symbol/timeframe change + auto-refresh every 30s
  useEffect(() => {
    // Small delay to let chart init
    const timeout = setTimeout(fetchCandles, 200);

    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(fetchCandles, 30000);

    return () => {
      clearTimeout(timeout);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchCandles]);

  // Format display symbol
  const displaySymbol = symbol.replace(/USDT$/, '/USDT').replace(/USDC$/, '/USDC');

  const indicatorButtons: { key: IndicatorKey; label: string }[] = [
    { key: 'MA', label: 'MA' },
    { key: 'RSI', label: 'RSI' },
    { key: 'MACD', label: 'MACD' },
    { key: 'BB', label: 'BB' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-nvx-border flex-shrink-0">
        <span className="text-sm font-semibold text-nvx-text-primary mr-3">
          {displaySymbol}
        </span>
        {timeFrames.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeFrame(tf)}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded transition-colors',
              timeFrame === tf
                ? 'bg-nvx-primary/20 text-nvx-primary'
                : 'text-nvx-text-muted hover:text-nvx-text-secondary hover:bg-nvx-bg-tertiary',
            )}
          >
            {tf}
          </button>
        ))}

        {/* Indicator toggle buttons */}
        <div className="ml-3 flex items-center gap-1 border-l border-nvx-border pl-3">
          {indicatorButtons.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleIndicator(key)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded transition-colors',
                activeIndicators[key]
                  ? 'bg-nvx-accent/20 text-nvx-accent border border-nvx-accent/30'
                  : 'text-nvx-text-muted hover:text-nvx-text-secondary hover:bg-nvx-bg-tertiary border border-transparent',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="ml-auto">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border border-nvx-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Main chart container */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />

      {/* RSI sub-chart */}
      {activeIndicators.RSI && (
        <div className="border-t border-nvx-border flex-shrink-0">
          <div className="px-3 py-0.5 text-[10px] text-nvx-text-muted font-medium tracking-wide">
            RSI(14)
          </div>
          <div ref={rsiContainerRef} style={{ height: 120 }} />
        </div>
      )}

      {/* MACD sub-chart */}
      {activeIndicators.MACD && (
        <div className="border-t border-nvx-border flex-shrink-0">
          <div className="px-3 py-0.5 text-[10px] text-nvx-text-muted font-medium tracking-wide">
            MACD(12,26,9)
          </div>
          <div ref={macdContainerRef} style={{ height: 120 }} />
        </div>
      )}
    </div>
  );
}
