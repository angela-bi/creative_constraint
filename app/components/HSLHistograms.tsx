import React, { useEffect, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type Props = {
  pixelsRef: React.RefObject<Uint8ClampedArray | null>;
  frameId: number;
  bins?: number;
  size?: number;
};

function rgb2hsl(r: number, g: number, b: number) {
    // https://gist.github.com/mjackson/5311256
    r /= 255, g /= 255, b /= 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = 0;
        s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }

      h! /= 6;
    }

    return {'h': h, 's': s, 'l': l };
  }

  export default function HSLHistograms({
    pixelsRef,
    bins = 60,
    frameId
  }: Props) {
  
    const { hHist, sHist, lHist } = useMemo(() => {
      const h = new Array(bins).fill(0);
      const s = new Array(bins).fill(0);
      const l = new Array(bins).fill(0);
  
      const data = pixelsRef.current;
      if (!data) return { hHist: h, sHist: s, lHist: l };
  
      for (let i = 0; i < data.length; i += 4) {
        const { h: hh, s: ss, l: ll } = rgb2hsl(
          data[i],
          data[i + 1],
          data[i + 2]
        );
  
        h[Math.min(bins - 1, Math.floor(hh! * bins))]++;
        s[Math.min(bins - 1, Math.floor(ss * bins))]++;
        l[Math.min(bins - 1, Math.floor(ll * bins))]++;
      }
  
      return { hHist: h, sHist: s, lHist: l };
    }, [frameId]);
  
    const labels = Array.from({ length: bins }, (_, i) => i.toString());
  
    const makeDataset = (
      data: number[],
      colorFn: (i: number) => string
    ) => ({
      labels,
      datasets: [
        {
          data,
          backgroundColor: data.map((_, i) => colorFn(i)),
          borderColor: 'rgba(0, 0, 0, 0.2)',
          borderWidth: 1,
          barPercentage: 1.0,
          categoryPercentage: 1.0
        }
      ]
    });
  
    const options = {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      layout: {
        padding: 4,
      }
    };
  
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Bar
          data={makeDataset(hHist, i => `hsl(${(i / bins) * 360},100%,50%)`)}
          options={options}
          height={60}
        />
        <Bar
          data={makeDataset(sHist, i => `hsl(0,${(i / bins) * 100}%,50%)`)}
          options={options}
          height={40}
        />
        <Bar
          data={makeDataset(lHist, i => `hsl(0,0%,${(i / bins) * 100}%)`)}
          options={options}
          height={40}
        />
      </div>
    );
  }
  