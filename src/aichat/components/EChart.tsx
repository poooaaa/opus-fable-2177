import { useEffect, useRef, useState } from "react";

/** Render grafik ECharts dari opsi JSON yang dihasilkan AI. */
export function EChart({ code }: { code: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let chart: { resize: () => void; dispose: () => void } | null = null;
    let observer: ResizeObserver | null = null;

    const run = async () => {
      const host = hostRef.current;
      if (!host) return;

      let option: Record<string, unknown>;
      try {
        option = JSON.parse(code) as Record<string, unknown>;
      } catch {
        try {
          // Toleransi terhadap JS object literal (kutip tunggal / kunci tanpa kutip).
          option = new Function(`"use strict";return (${code});`)() as Record<string, unknown>;
        } catch {
          setError("Opsi grafik tidak valid.");
          return;
        }
      }

      const echarts = await import("echarts");
      if (disposed || !hostRef.current) return;

      chart = echarts.init(hostRef.current, "dark", { renderer: "canvas" });
      chart.setOption?.({
        backgroundColor: "transparent",
        textStyle: { fontFamily: "inherit" },
        ...option,
      } as never);

      observer = new ResizeObserver(() => chart?.resize());
      observer.observe(hostRef.current);
    };

    void run();

    return () => {
      disposed = true;
      observer?.disconnect();
      chart?.dispose();
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
    <div className="chat-table-scroll my-4 w-full max-w-full overflow-x-auto overscroll-x-contain">
      <div
        className="h-[300px] w-full border border-table-border bg-table-body"
        style={{ minWidth: 520 }}
        ref={hostRef}
      />
    </div>
  );
}

export default EChart;
