import { useEffect, useRef, useState } from "react";

/** Render grafik Chart.js dari konfigurasi JSON yang dihasilkan AI. */
export function ChartView({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let chart: { destroy: () => void } | null = null;

    const run = async () => {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(code) as Record<string, unknown>;
      } catch {
        try {
          config = new Function(`"use strict";return (${code});`)() as Record<string, unknown>;
        } catch {
          setError("Konfigurasi grafik tidak valid.");
          return;
        }
      }

      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);
      const canvas = canvasRef.current;
      if (disposed || !canvas) return;

      const options = (config["options"] as Record<string, unknown> | undefined) ?? {};
      const conf = config as { type?: "bar"; data?: { labels: string[]; datasets: [] } };
      chart = new Chart(canvas, {
        ...conf,
        type: conf.type ?? "bar",
        data: conf.data ?? { labels: [], datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          color: "#c9c9d1",
          borderColor: "#2a2a30",
          ...options,
        },
      });
    };

    void run();

    return () => {
      disposed = true;
      chart?.destroy();
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-3 rounded-lg border border-[#2a2a30] bg-[#1a1a1e] p-3 text-[13.5px] text-[#b9b9c0]">
        {error}
      </div>
    );
  }

  return (
    <div className="chart-scroll chat-table-scroll my-4 w-full max-w-full overflow-x-auto overscroll-x-contain">
      <div className="chart-box relative h-[300px] w-full min-w-[520px] border border-table-border bg-table-body p-2">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );

}

export default ChartView;
