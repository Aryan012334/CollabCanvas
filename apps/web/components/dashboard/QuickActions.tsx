// components/dashboard/QuickActions.tsx
"use client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Link2, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRoom } from "@/actions/action";

export function QuickActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const QueryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: createRoom,

    onSuccess: () => {
      toast.success("Room created successfully", { id: "create-room" });
      QueryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (error) => {
      toast.error(error?.message || "Error creating the room", {
        id: "create-room",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!inputRef.current?.value) return;
    toast.loading("Creating room...", { id: "create-room" });

    mutate({ name: inputRef.current?.value });
  };
  return (
    <Card className='p-6 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20 hover:border-primary/40 transition-all h-full'>
      <h2 className='text-lg font-semibold mb-4 flex items-center gap-2'>
        <span className='w-2 h-2 rounded-full bg-primary animate-pulse' />
        Quick Actions
      </h2>
      <div className='space-y-3'>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              className='w-full justify-start gap-3 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25'
              size='lg'>
              <Plus className='w-5 h-5' />
              Create New Room
            </Button>
          </DialogTrigger>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Create a new room</DialogTitle>
              <DialogDescription>
                Create a new room to start drawing.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className='grid gap-4'>
                <div className='grid gap-3'>
                  <Label htmlFor='name-1'>Give your room a name</Label>
                  <Input ref={inputRef} id='name-1' name='name' required />
                </div>
              </div>
              <DialogFooter className='mt-4'>
                <DialogClose asChild>
                  <div className='flex gap-4'>
                    <Button variant='outline'>Cancel</Button>
                    <Button type='submit'>Create Room</Button>
                  </div>
                </DialogClose>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Button
          variant='outline'
          className='w-full justify-start gap-3 h-12 border-2 hover:bg-accent'
          size='lg'>
          <Link2 className='w-5 h-5' />
          Join via Code
        </Button>
        <Button
          variant='outline'
          className='w-full justify-start gap-3 h-12 border-2 hover:bg-accent'
          size='lg'>
          <Upload className='w-5 h-5' />
          Import Canvas
        </Button>
        <Button
          variant='outline'
          className='w-full justify-start gap-3 h-12 border-2 hover:bg-accent'
          size='lg'>
          <Download className='w-5 h-5' />
          Export Canvas
        </Button>
      </div>
    </Card>
  );
}
