// components/dashboard/StatsCards.tsx
"use client";

import { Users, Clock, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatsCards() {
  const stats = [
    {
      label: "Total Rooms",
      value: "12",
      icon: Zap,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
    },
    {
      label: "Collaborators",
      value: "24",
      icon: Users,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
    },
    {
      label: "Hours This Week",
      value: "18.5",
      icon: Clock,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-500/10 to-red-500/10",
    },
  ];

  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 h-full'>
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`p-6 bg-gradient-to-br ${stat.bgGradient} border-0 hover:scale-105 transition-transform cursor-pointer group`}>
          <div className='flex items-start justify-between'>
            <div>
              <p className='text-sm text-muted-foreground mb-1'>{stat.label}</p>
              <p className='text-3xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent'>
                {stat.value}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} group-hover:scale-110 transition-transform`}>
              <stat.icon className='w-5 h-5 text-white' />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
