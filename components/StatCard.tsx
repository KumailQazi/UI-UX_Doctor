"use client";

import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  Icon: LucideIcon;
  description?: string;
  className?: string;
}

export default function StatCard({ title, value, Icon, description, className = "" }: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <Icon className="h-6 w-6 text-zinc-600" />
        </div>
        <div className="ml-4">
          <p className="truncate text-sm font-medium text-zinc-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
        </div>
      </div>
      {description && <p className="mt-2 truncate text-xs text-zinc-500">{description}</p>}
    </div>
  );
}
