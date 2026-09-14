// components/dashboard/RecentActivity.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Layers, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getRooms } from "@/actions/action";
import Link from "next/link";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface Room {
  id: string | number;
  slug: string;
  updatedAt: string | Date;
  createdAt: string | Date;
}

function toTitle(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function RecentActivity() {
  const { data, isPending } = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
    staleTime: 30_000,
  });

  const rooms: Room[] = data?.rooms ?? [];

  // Sort by updatedAt descending and take the 6 most recently active
  const recent = [...rooms]
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 6);

  return (
    <Card className='p-6 h-full overflow-hidden bg-background/60 backdrop-blur-sm flex flex-col'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-xl font-bold'>Recent Activity</h2>
        <Clock className='w-5 h-5 text-muted-foreground' aria-hidden='true' />
      </div>

      {isPending ? (
        <div className='space-y-4 flex-1'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='flex gap-3 items-start'>
              <Skeleton className='w-10 h-10 rounded-full flex-shrink-0' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-3 w-1/2' />
              </div>
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <Empty className='flex-1'>
          <EmptyMedia variant='icon'>
            <Layers className='h-8 w-8 text-muted-foreground' aria-hidden='true' />
          </EmptyMedia>
          <EmptyTitle>No activity yet</EmptyTitle>
          <EmptyDescription>Create a room to get started</EmptyDescription>
        </Empty>
      ) : (
        <ScrollArea className='flex-1 -mx-2 px-2'>
          <div className='space-y-2'>
            {recent.map((room, index) => (
              <Link
                key={room.id}
                href={`/board/${room.id}`}
                className='flex gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group items-center'
                aria-label={`Open ${toTitle(room.slug)}`}
              >
                {/* Room icon */}
                <div className='w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary flex-shrink-0 group-hover:bg-primary/20 transition-colors'>
                  <span className='text-sm font-bold'>
                    {room.slug.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-semibold truncate group-hover:text-primary transition-colors'>
                    {toTitle(room.slug)}
                  </p>
                  <div className='flex items-center gap-2 mt-0.5'>
                    <Badge variant='outline' className='text-xs font-normal px-1.5 py-0'>
                      /{room.slug}
                    </Badge>
                    <span className='text-xs text-muted-foreground'>
                      {formatDistanceToNow(new Date(room.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Open icon */}
                <ExternalLink
                  className='w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0'
                  aria-hidden='true'
                />

                {/* Connector line between items */}
                {index < recent.length - 1 && (
                  <span className='sr-only'>separator</span>
                )}
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
