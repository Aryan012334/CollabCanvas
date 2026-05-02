import type React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MousePointer2, Layers } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className='relative'>
      <div className='mx-auto max-w-6xl px-4 py-16 md:py-24'>
        <div className='mx-auto max-w-3xl text-center animate-in fade-in slide-in-from-bottom-4 duration-700'>
          <Badge
            variant='secondary'
            className='mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1'>
            <Sparkles className='size-4' />
            Real-time sketching, zero friction
          </Badge>
          <h1 className='text-balance text-4xl font-semibold tracking-tight md:text-6xl'>
            Sketch. Collaborate. Create.
          </h1>
          <p className='mt-4 text-pretty text-muted-foreground md:text-lg leading-relaxed'>
            A delightful, keyboard-first canvas that feels instant. Built with
            Next.js, shadcn/ui, Tailwind, and lucide.
          </p>

          <div className='mt-8 flex items-center justify-center gap-3'>
            <Button asChild size='lg' className='group'>
              <Link href='/signup'>
                Start drawing
                <MousePointer2 className='ml-2 size-4 transition-transform group-hover:translate-x-0.5' />
              </Link>
            </Button>
            <Button asChild size='lg' variant='secondary' className='group'>
              <Link href='#demo'>
                Live demo
                <Layers className='ml-2 size-4 transition-transform group-hover:-translate-y-0.5' />
              </Link>
            </Button>
          </div>

          <div className='pointer-events-none mx-auto mt-10 h-px w-40 bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-in fade-in duration-700' />
        </div>

        <div className='mt-12 grid gap-4 md:grid-cols-3'>
          <HeroCard
            title='Infinite canvas'
            desc='Zoom and pan with buttery-smooth performance.'
            icon={<Layers className='size-5' />}
            delay='100'
          />
          <HeroCard
            title='Snappy tools'
            desc='Shapes, arrows, text, and magic align—all instant.'
            icon={<MousePointer2 className='size-5' />}
            delay='200'
          />
          <HeroCard
            title='Beautiful by default'
            desc='Pleasant styles and a lovable hand-drawn look.'
            icon={<Sparkles className='size-5' />}
            delay='300'
          />
        </div>
      </div>
    </section>
  );
}

function HeroCard({
  title,
  desc,
  icon,
  delay,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  delay?: string;
}) {
  return (
    <div
      className='rounded-xl border bg-card p-5 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-2'
      style={{ animationDelay: `${delay}ms` }}>
      <div className='flex items-start gap-3'>
        <div className='mt-1 inline-flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground'>
          {icon}
        </div>
        <div>
          <h3 className='font-medium'>{title}</h3>
          <p className='mt-1 text-sm text-muted-foreground'>{desc}</p>
        </div>
      </div>
    </div>
  );
}
