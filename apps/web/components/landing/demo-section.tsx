import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Lock,
  Code2,
  GrabIcon,
  LucideIcon,
  Hand,
  RectangleCircle,
  RectangleVertical,
  Circle,
  ArrowBigDown,
  TextIcon,
} from "lucide-react";

export function DemoSection() {
  return (
    <section id='demo' className='border-t bg-muted/30'>
      <div className='mx-auto max-w-6xl px-4 py-16 md:py-20'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <Badge variant='outline' className='px-3 py-1'>
            In-browser demo
          </Badge>
          <h2 className='text-balance text-3xl font-semibold tracking-tight md:text-5xl'>
            Draw with a playful, fast canvas
          </h2>
          <p className='max-w-2xl text-pretty text-muted-foreground leading-relaxed md:text-lg'>
            Minimal UI, powerful primitives. It feels like your favorite
            whiteboard—only faster.
          </p>
        </div>

        <Card className='mx-auto mt-8 w-full max-w-5xl overflow-hidden border bg-card'>
          <div className='flex'>
            <div className='flex w-full flex-col'>
              <Toolbar />
              <CanvasMock />
            </div>
          </div>
        </Card>

        <div className='mt-6 flex flex-wrap items-center justify-center gap-2'>
          <Button variant='secondary' className='group'>
            Share link
            <Share2 className='ml-2 size-4 transition-transform group-hover:-translate-y-0.5' />
          </Button>
          <Button variant='outline' className='group bg-transparent'>
            Private board
            <Lock className='ml-2 size-4 transition-transform group-hover:translate-x-0.5' />
          </Button>
          <Button variant='ghost' className='group'>
            View code
            <Code2 className='ml-2 size-4 transition-transform group-hover:rotate-3' />
          </Button>
        </div>
      </div>
    </section>
  );
}

function Toolbar() {
  return (
    <div className='flex items-center gap-2 border-b bg-secondary/60 px-3 py-2'>
      <ToolbarDot label={<Hand />} />
      <ToolbarDot label={<RectangleVertical />} />
      <ToolbarDot label={<Circle />} />
      <ToolbarDot label={<ArrowBigDown />} />
      <ToolbarDot label={<TextIcon />} />
      {/* <ToolbarDot label='Hand' /> */}
    </div>
  );
}

function ToolbarDot({ label }: { label: any }) {
  return (
    <div className='inline-flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm shadow-sm ring-1 ring-border'>
      {/* <span className='size-2 rounded-full bg-primary' /> */}
      <span className='text-muted-foreground'>{label}</span>
    </div>
  );
}

function CanvasMock() {
  return (
    <div className='relative h-[340px] w-full bg-background'>
      {/* grid */}
      <div className='absolute inset-0 bg-[linear-gradient(to_right,theme(colors.border)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.border)_1px,transparent_1px)] bg-[size:28px_28px]' />
      {/* paper */}
      <div className='relative m-4 rounded-lg border bg-card p-4 shadow-sm'>
        <div className='animate-in zoom-in-50 duration-700'>
          <h3 className='font-medium'>Flow</h3>
          <p className='mt-1 text-sm text-muted-foreground max-w-[36ch]'>
            Place shapes, draw arrows, and drop text. It just flows.
          </p>
        </div>

        <div
          className='pointer-events-none absolute -bottom-4 right-6 hidden select-none items-center gap-2 rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur md:flex animate-in fade-in slide-in-from-right-4'
          style={{ animationDelay: "300ms" }}>
          <div className='size-2 rounded-full bg-primary' />
          tip: press{" "}
          <kbd className='rounded bg-muted px-1 text-foreground'>V</kbd> to
          switch tools
        </div>
      </div>
    </div>
  );
}
