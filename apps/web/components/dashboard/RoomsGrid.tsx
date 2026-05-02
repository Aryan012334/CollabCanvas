// components/dashboard/RoomsGrid.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { Item, ItemDescription, ItemTitle } from "@/components/ui/item";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import {
  Users,
  Clock,
  Share2,
  Trash2,
  MoreVertical,
  ExternalLink,
  Crown,
  Copy,
  Link2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRoom, getRooms } from "@/actions/action";
import { Context } from "../providers/ContextProvider";
import { set } from "zod";

type UserLike = { id: string };

interface Room {
  id: string;
  slug: string;
  updatedAt: Date | string;
  createdAt?: Date | string;
  adminId: string;
}

interface RoomsGridProps {
  searchQuery: string;
  rooms?: Room[];
  user?: UserLike | null;
  isLoading?: boolean;
}

function toTitle(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function RoomsGrid({ searchQuery }: RoomsGridProps) {
  const { user } = React.useContext(Context);
  const { data, isPending } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms(),
  });
  if (isPending) {
    return (
      <div className='lg:col-span-8 md:col-span-2 lg:row-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-40 w-full rounded-xl' />
        ))}
      </div>
    );
  }
  const filteredRooms = data?.rooms?.filter((it: any) =>
    it?.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className='p-6 h-full overflow-auto bg-background/60 backdrop-blur-sm'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-2xl font-bold'>My Rooms</h2>
        <Badge variant='secondary' className='text-sm'>
          {filteredRooms.length} rooms
        </Badge>
      </div>

      {filteredRooms.length === 0 ? (
        <Empty>
          <EmptyMedia variant={"icon"}>
            <ExternalLink
              className='h-8 w-8 text-muted-foreground'
              aria-hidden='true'
            />
          </EmptyMedia>
          <EmptyTitle>No rooms found</EmptyTitle>
          <EmptyDescription>
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first room to get started"}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {filteredRooms.map((room: any) => (
            <RoomCard key={room.id} room={room} user={user} />
          ))}
        </div>
      )}
    </Card>
  );
}

function RoomCard({ room, user }: { room: Room; user: UserLike | null }) {
  const [open, setOpen] = React.useState(false);
  const [targetId, setTargetId] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleRoomDelete = async () => {
    if (!targetId) return;
    mutate(targetId);
  };

  const { mutate } = useMutation({
    mutationFn: (targetId: string) => deleteRoom(targetId),
    onSuccess: () => {
      toast.success("Room deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setTargetId(null);
    },
    onError: () => {
      toast.error("Something went wrong");
      setTargetId(null);
    },
  });

  const shareLink =
    (typeof window !== "undefined" ? window.location.origin : "") +
    `/board/${room.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Card className='group overflow-hidden transition-all duration-200 border hover:shadow-md hover:border-primary/40 focus-within:ring-1 focus-within:ring-primary'>
      {/* Thumbnail */}
      {/* <div className='relative h-36 bg-muted'>
        <div className='absolute inset-0 flex items-center justify-center'>
          <span
            aria-hidden='true'
            className='text-5xl font-bold text-muted-foreground/40'>
            {room.slug.charAt(0).toUpperCase()}
          </span>
        </div>
        </div> */}

      {/* Content */}
      <div className='p-4 relative'>
        {room.adminId === user?.id && (
          <Badge
            className='absolute -top-4 right-2'
            variant='default'
            aria-label='You are the admin'>
            <Crown className='w-3 h-3 mr-1' />
            Admin
          </Badge>
        )}
        <div className='flex items-start justify-between mb-3'>
          <div className='flex-1 min-w-0'>
            <h3 className='font-semibold text-lg truncate group-hover:text-primary transition-colors'>
              {toTitle(room.slug)}
            </h3>
            <p
              className='text-sm text-muted-foreground truncate'
              aria-label={`Slug ${room.slug}`}>
              /{room.slug}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                aria-label='More options'>
                <MoreVertical className='w-4 h-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setOpen(true);
                }}>
                <Share2 className='w-4 h-4 mr-2' />
                Share
              </DropdownMenuItem>
              {room.adminId === user?.id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className='text-red-500 focus:text-destructive'
                      onSelect={(e) => {
                        setTargetId(room.id);
                        e.preventDefault();
                      }}>
                      <Trash2 className='w-4 h-4 mr-2' />
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleRoomDelete}
                        className='bg-destructive text-white'>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta info with Item components */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4'>
          <Item>
            <Users
              className='h-4 w-4 text-muted-foreground'
              aria-hidden='true'
            />
            <div className='min-w-0'>
              <ItemTitle>Members</ItemTitle>
              <ItemDescription>—</ItemDescription>
            </div>
          </Item>
          <Item>
            <Clock
              className='h-4 w-4 text-muted-foreground'
              aria-hidden='true'
            />
            <div className='min-w-0'>
              <ItemTitle>Updated</ItemTitle>
              <ItemDescription>
                {formatDistanceToNow(new Date(room.updatedAt), {
                  addSuffix: true,
                })}
              </ItemDescription>
            </div>
          </Item>
        </div>

        {/* Actions */}
        <div className='flex gap-2'>
          <Button
            asChild
            className='flex-1'
            size='sm'
            aria-label={`Open ${room.id}`}>
            <Link href={`/board/${room.id}`}>
              <ExternalLink className='w-4 h-4 mr-2' />
              Open
            </Link>
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setOpen(true)}
            aria-label='Share room'>
            <Share2 className='w-4 h-4' />
          </Button>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby='share-desc'>
          <DialogHeader>
            <DialogTitle>Share this room</DialogTitle>
            <DialogDescription id='share-desc'>
              Send this link to collaborators to open the room.
            </DialogDescription>
          </DialogHeader>

          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-2 w-full rounded-md border bg-muted px-3 py-2'>
              <Link2
                className='h-4 w-4 text-muted-foreground'
                aria-hidden='true'
              />
              <Input
                aria-label='Share link'
                readOnly
                value={shareLink}
                className='border-0 bg-transparent p-0 focus-visible:ring-0'
              />
            </div>
            <Button
              variant='secondary'
              onClick={copyLink}
              aria-label='Copy share link'>
              <Copy className='h-4 w-4 mr-2' />
              Copy
            </Button>
          </div>

          <DialogFooter className='sm:justify-start'>
            <Button
              variant='outline'
              onClick={async () => {
                if (typeof navigator !== "undefined" && "share" in navigator) {
                  try {
                    await navigator.share({
                      title: toTitle(room.slug),
                      url: shareLink,
                    });
                  } catch {}
                } else {
                  await copyLink();
                }
              }}>
              <Share2 className='h-4 w-4 mr-2' />
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
