import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = "#16a34a", height = 36 }: SparklineProps) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function generateSparkData(base: number, points = 12, trend = 0.02): number[] {
  const data = [base];
  for (let i = 1; i < points; i++) {
    data.push(data[i - 1] * (1 + trend * (Math.random() - 0.3)));
  }
  return data;
}
