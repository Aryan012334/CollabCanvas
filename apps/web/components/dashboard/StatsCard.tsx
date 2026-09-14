// components/dashboard/StatsCards.tsx
"use client";

import { Users, Clock, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRooms } from "@/actions/action";
import { formatDistanceToNow } from "date-fns";

interface Room {
  id: string;
  slug: string;
  updatedAt: string | Date;
  createdAt: string | Date;
  participants?: { id: string }[];
}

export function StatsCards() {
  const { data, isPending } = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
    // Reuse the same cache as RoomsGrid — no extra network call
    staleTime: 30_000,
  });

  const rooms: Room[] = data?.rooms ?? [];

  // Total rooms owned by this user
  const totalRooms = rooms.length;

  // Unique collaborators across all rooms via RoomParticipant
  const collaboratorSet = new Set<string>();
  rooms.forEach((r) => {
    (r.participants ?? []).forEach((p) => collaboratorSet.add(p.id));
  });
  const totalCollaborators = collaboratorSet.size;

  // Most recently updated room — show how long ago
  const mostRecentUpdate = rooms.reduce<Date | null>((latest, r) => {
    const d = new Date(r.updatedAt);
    return !latest || d > latest ? d : latest;
  }, null);

  const lastActiveLabel = mostRecentUpdate
    ? formatDistanceToNow(mostRecentUpdate, { addSuffix: true })
    : "No activity yet";

  const stats = [
    {
      label: "Total Rooms",
      value: isPending ? null : String(totalRooms),
      icon: Zap,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
    },
    {
      label: "Collaborators",
      value: isPending ? null : String(totalCollaborators),
      icon: Users,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/10 to-pink-500/10",
    },
    {
      label: "Last Active",
      value: isPending ? null : lastActiveLabel,
      icon: Clock,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-500/10 to-red-500/10",
      small: true, // smaller text for the relative-time string
    },
  ];

  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 h-full'>
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`p-6 bg-gradient-to-br ${stat.bgGradient} border-0 hover:scale-105 transition-transform cursor-default group`}>
          <div className='flex items-start justify-between'>
            <div className='flex-1 min-w-0'>
              <p className='text-sm text-muted-foreground mb-1'>{stat.label}</p>
              {stat.value === null ? (
                <Skeleton className='h-8 w-16 mt-1' />
              ) : (
                <p
                  className={`font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent ${
                    stat.small ? "text-lg leading-tight mt-1" : "text-3xl"
                  }`}>
                  {stat.value}
                </p>
              )}
            </div>
            <div
              className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} group-hover:scale-110 transition-transform flex-shrink-0`}>
              <stat.icon className='w-5 h-5 text-white' aria-hidden='true' />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
