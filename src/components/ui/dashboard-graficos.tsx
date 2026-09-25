"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatarMoeda } from "@/lib/format";

export function GraficoVendas({
  dados,
  moeda,
}: {
  dados: { data: string; total: number }[];
  moeda: string;
}) {
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="data"
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
          />
          <Tooltip
            cursor={{ stroke: "#27272a", strokeWidth: 1, strokeDasharray: "3 3" }}
            contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
            formatter={(value: any) => [formatarMoeda(Number(value), moeda), "Vendas"]}
            labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#34d399"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorVendas)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
