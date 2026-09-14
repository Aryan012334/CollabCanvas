// components/dashboard/QuickActions.tsx
"use client";
import {
  Dialog,
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
  const inputRef    = useRef<HTMLInputElement>(null);
  const joinCodeRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const router      = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen,   setJoinOpen]   = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: createRoom,
    onSuccess: (data) => {
      // Close dialog first, then update UI
      setCreateOpen(false);
      toast.success("Room created successfully");
      // Invalidate so the rooms grid refreshes
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      // Navigate directly to the new room if the API returns roomId
      const roomId = data?.data?.roomId;
      if (roomId) {
        router.push(`/board/${roomId}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Error creating the room");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = inputRef.current?.value?.trim();
    if (!name) return;
    mutate({ name });
  };

  const handleJoinViaCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = joinCodeRef.current?.value?.trim();
    if (!code) return;
    setJoinOpen(false);
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
    toast.info("Open a room, then use the board menu (☰) → Export as PNG");
  };

  return (
    <Card className='p-6 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20 hover:border-primary/40 transition-all h-full'>
      <h2 className='text-lg font-semibold mb-4 flex items-center gap-2'>
        <span className='w-2 h-2 rounded-full bg-primary animate-pulse' />
        Quick Actions
      </h2>
      <div className='space-y-3'>

        {/* ── Create New Room ──────────────────────────────────── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                Give your room a short name (3–20 characters, no spaces).
                You&apos;ll be taken straight to the board.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className='grid gap-4'>
                <div className='grid gap-3'>
                  <Label htmlFor='room-name'>Room name</Label>
                  <Input
                    ref={inputRef}
                    id='room-name'
                    name='name'
                    placeholder='e.g. design-sprint'
                    minLength={3}
                    maxLength={20}
                    pattern='[a-zA-Z0-9\-_]+'
                    title='Letters, numbers, hyphens and underscores only'
                    autoFocus
                    required
                  />
                  <p className='text-xs text-muted-foreground'>
                    Letters, numbers, hyphens and underscores · max 20 chars
                  </p>
                </div>
              </div>
              <DialogFooter className='mt-4'>
                <Button
                  variant='outline'
                  type='button'
                  onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type='submit' disabled={isPending}>
                  {isPending ? "Creating…" : "Create Room"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Join via Code ────────────────────────────────────── */}
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
                    placeholder='e.g. 42 or design-sprint'
                    autoFocus
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

        {/* ── Import Canvas ─────────────────────────────────────── */}
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

        {/* ── Export Canvas ─────────────────────────────────────── */}
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
