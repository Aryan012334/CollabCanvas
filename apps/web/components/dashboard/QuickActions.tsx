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
import { useRef, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { createRoom } from "@/actions/action";
import { useRouter } from "next/navigation";

export function QuickActions() {
  const inputRef = useRef<HTMLInputElement>(null);
  const joinCodeRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const QueryClient = useQueryClient();
  const router = useRouter();

  const [joinOpen, setJoinOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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

  const handleJoinViaCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = joinCodeRef.current?.value?.trim();
    if (!code) return;
    setJoinOpen(false);
    // Navigate to the board — code can be a room ID or slug
    router.push(`/board/${code}`);
  };

  const handleImportCanvas = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = importFileRef.current?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        // Store in sessionStorage so the board page can pick it up
        sessionStorage.setItem("importedCanvas", JSON.stringify(json));
        toast.success("Canvas imported — open a room to apply it");
        setImportOpen(false);
      } catch {
        toast.error("Invalid canvas file");
      }
    };
    reader.readAsText(file);
  };

  const handleExportCanvas = () => {
    // Export is only meaningful from inside a board; here we just inform the user
    toast.info("Open a room and use the board menu to export the canvas");
  };

  return (
    <Card className='p-6 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20 hover:border-primary/40 transition-all h-full'>
      <h2 className='text-lg font-semibold mb-4 flex items-center gap-2'>
        <span className='w-2 h-2 rounded-full bg-primary animate-pulse' />
        Quick Actions
      </h2>
      <div className='space-y-3'>
        {/* Create New Room */}
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
                    <Button variant='outline' type='button'>Cancel</Button>
                    <Button type='submit'>Create Room</Button>
                  </div>
                </DialogClose>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Join via Code */}
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger asChild>
            <Button
              variant='outline'
              className='w-full justify-start gap-3 h-12 border-2 hover:bg-accent'
              size='lg'>
              <Link2 className='w-5 h-5' />
              Join via Code
            </Button>
          </DialogTrigger>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Join a room</DialogTitle>
              <DialogDescription>
                Enter a room ID or slug to join an existing room.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoinViaCode}>
              <div className='grid gap-4'>
                <div className='grid gap-3'>
                  <Label htmlFor='join-code'>Room ID or name</Label>
                  <Input
                    ref={joinCodeRef}
                    id='join-code'
                    name='code'
                    placeholder='e.g. 42 or my-room-name'
                    required
                  />
                </div>
              </div>
              <DialogFooter className='mt-4'>
                <Button variant='outline' type='button' onClick={() => setJoinOpen(false)}>
                  Cancel
                </Button>
                <Button type='submit'>Join Room</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Import Canvas */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button
              variant='outline'
              className='w-full justify-start gap-3 h-12 border-2 hover:bg-accent'
              size='lg'>
              <Upload className='w-5 h-5' />
              Import Canvas
            </Button>
          </DialogTrigger>
          <DialogContent className='sm:max-w-[425px]'>
            <DialogHeader>
              <DialogTitle>Import Canvas</DialogTitle>
              <DialogDescription>
                Select a previously exported canvas JSON file.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleImportCanvas}>
              <div className='grid gap-4'>
                <div className='grid gap-3'>
                  <Label htmlFor='import-file'>Canvas file (.json)</Label>
                  <Input
                    ref={importFileRef}
                    id='import-file'
                    name='file'
                    type='file'
                    accept='.json'
                    required
                  />
                </div>
              </div>
              <DialogFooter className='mt-4'>
                <Button variant='outline' type='button' onClick={() => setImportOpen(false)}>
                  Cancel
                </Button>
                <Button type='submit'>Import</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Export Canvas */}
        <Button
          variant='outline'
          className='w-full justify-start gap-3 h-12 border-2 hover:bg-accent'
          size='lg'
          onClick={handleExportCanvas}>
          <Download className='w-5 h-5' />
          Export Canvas
        </Button>
      </div>
    </Card>
  );
}
