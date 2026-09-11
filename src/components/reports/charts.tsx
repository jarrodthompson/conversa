"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

const AXIS = { fontSize: 12, fill: "#647985" };
const PALETTE = ["#06B6D4", "#22D3EE", "#6366F1", "#10B981", "#F59E0B", "#EF4444"];

export function ChannelBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DCEAF0" vertical={false} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: "#DCEAF0" }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(6,182,212,0.06)" }}
          contentStyle={{ borderRadius: 10, border: "1px solid #DCEAF0", fontSize: 12 }}
        />
        <Bar dataKey="value" fill="#06B6D4" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #DCEAF0", fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
