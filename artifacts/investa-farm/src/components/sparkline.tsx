import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number | string;
  positive?: boolean;
}

export function Sparkline({ data, color, height = 36, width = "100%", positive }: SparklineProps) {
  const strokeColor = color ?? (positive === false ? "#ef4444" : "#16a34a");
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={strokeColor}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function generateSparkData(base: number, points = 12, trend = 0.02): number[] {
  const rand = seededRandom(Math.round(base * 100));
  const data = [base];
  for (let i = 1; i < points; i++) {
    data.push(data[i - 1]! * (1 + trend * (rand() - 0.3)));
  }
  return data;
}
