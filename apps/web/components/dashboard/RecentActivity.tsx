// components/dashboard/RecentActivity.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Pencil,
  UserPlus,
  MessageSquare,
  Trash2,
  Share2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: "draw" | "join" | "message" | "delete" | "share";
  user: {
    name: string;
    avatar?: string;
  };
  room: string;
  timestamp: Date;
  description: string;
}

export function RecentActivity() {
  // Mock data - replace with real data fetching
  const activities: Activity[] = [
    {
      id: "1",
      type: "draw",
      user: { name: "You" },
      room: "Design Sprint 2024",
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      description: "drew 3 new shapes",
    },
    {
      id: "2",
      type: "join",
      user: { name: "John Smith" },
      room: "Marketing Brainstorm",
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      description: "joined the room",
    },
    {
      id: "3",
      type: "message",
      user: { name: "Sarah Johnson" },
      room: "Product Roadmap Q1",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      description: "left a comment",
    },
    {
      id: "4",
      type: "share",
      user: { name: "You" },
      room: "UI/UX Workshop",
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      description: "shared the room with 3 people",
    },
    {
      id: "5",
      type: "draw",
      user: { name: "Mike Chen" },
      room: "Design Sprint 2024",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      description: "added text annotations",
    },
  ];

  const getActivityIcon = (type: Activity["type"]) => {
    const icons = {
      draw: Pencil,
      join: UserPlus,
      message: MessageSquare,
      delete: Trash2,
      share: Share2,
    };
    const Icon = icons[type];
    return <Icon className='w-4 h-4' />;
  };

  const getActivityColor = (type: Activity["type"]) => {
    const colors = {
      draw: "bg-blue-500/10 text-blue-600 border-blue-200",
      join: "bg-green-500/10 text-green-600 border-green-200",
      message: "bg-purple-500/10 text-purple-600 border-purple-200",
      delete: "bg-red-500/10 text-red-600 border-red-200",
      share: "bg-orange-500/10 text-orange-600 border-orange-200",
    };
    return colors[type];
  };

  return (
    <Card className='p-6 h-full overflow-hidden bg-background/60 backdrop-blur-sm flex flex-col'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-xl font-bold'>Recent Activity</h2>
        <Clock className='w-5 h-5 text-muted-foreground' />
      </div>

      <ScrollArea className='flex-1 -mx-2 px-2'>
        <div className='space-y-4'>
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className='flex gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group'>
              {/* Avatar/Icon */}
              <div className='relative flex-shrink-0'>
                {activity.user.name === "You" ? (
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${getActivityColor(
                      activity.type
                    )}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                ) : (
                  <Avatar className='w-10 h-10 ring-2 ring-background'>
                    <AvatarImage src={activity.user.avatar} />
                    <AvatarFallback className='bg-gradient-to-br from-primary to-purple-600 text-white text-sm'>
                      {activity.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                )}
                {/* Connecting line */}
                {index < activities.length - 1 && (
                  <div className='absolute left-1/2 top-10 w-px h-8 bg-border -translate-x-1/2' />
                )}
              </div>

              {/* Content */}
              <div className='flex-1 min-w-0 pt-1'>
                <p className='text-sm'>
                  <span className='font-semibold'>{activity.user.name}</span>{" "}
                  <span className='text-muted-foreground'>
                    {activity.description}
                  </span>
                </p>
                <div className='flex items-center gap-2 mt-1'>
                  <Badge variant='outline' className='text-xs font-normal'>
                    {activity.room}
                  </Badge>
                  <span className='text-xs text-muted-foreground'>
                    {formatDistanceToNow(activity.timestamp, {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
