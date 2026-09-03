import type React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, CircleDotDashed, MousePointer2, UsersRound } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className='relative isolate overflow-hidden'>
      <div className='absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent)]' />
      <div className='absolute -left-28 top-40 -z-10 size-80 rounded-full bg-cyan-300/15 blur-3xl dark:bg-cyan-400/10' />
      <div className='absolute -right-28 top-20 -z-10 size-80 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-400/10' />
      <div className='mx-auto max-w-7xl px-5 py-20 md:py-28'>
        <div className='mx-auto max-w-4xl text-center animate-in fade-in slide-in-from-bottom-4 duration-700'>
          <Badge
            variant='secondary'
            className='mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3.5 py-1.5 text-foreground shadow-sm'>
            <CircleDotDashed className='size-3.5 text-primary' />
            Designed for live ideas, not static files
          </Badge>
          <h1 className='text-balance text-5xl font-semibold tracking-[-0.055em] md:text-7xl lg:text-8xl'>
            Give your ideas a <span className='text-primary'>place to move.</span>
          </h1>
          <p className='mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-xl'>
            CollabDraw is the calm, shared workspace for sketches, systems, and the conversations that turn them into reality.
          </p>

          <div className='mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row'>
            <Button asChild size='lg' className='group h-12 rounded-full px-6 text-base shadow-lg shadow-primary/20'>
              <Link href='/signup'>
                Start drawing for free
                <ArrowRight className='ml-2 size-4 transition-transform group-hover:translate-x-1' />
              </Link>
            </Button>
            <Button asChild size='lg' variant='outline' className='group h-12 rounded-full bg-background/60 px-6 text-base'>
              <Link href='#demo'>
                See the canvas
                <MousePointer2 className='ml-2 size-4 transition-transform group-hover:-translate-y-0.5' />
              </Link>
            </Button>
          </div>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground'>
            {['No credit card', 'Private by default', 'Built for teams'].map((item) => (
              <span key={item} className='inline-flex items-center gap-1.5'><Check className='size-3.5 text-primary' />{item}</span>
            ))}
          </div>
        </div>

        <div className='mt-16 grid gap-4 md:grid-cols-3'>
          <HeroCard
            title='An infinite, focused surface'
            desc='Zoom, pan, and shape a thought without losing your place.'
            icon={<CircleDotDashed className='size-5' />}
            delay='100'
          />
          <HeroCard
            title='Tools that get out of the way'
            desc='Shapes, arrows, text, and selection feel immediate.'
            icon={<MousePointer2 className='size-5' />}
            delay='200'
          />
          <HeroCard
            title='Made to think together'
            desc='Invite collaborators and see the shared canvas evolve live.'
            icon={<UsersRound className='size-5' />}
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
      className='rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur transition-transform duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-2'
      style={{ animationDelay: `${delay}ms` }}>
      <div className='flex items-start gap-3'>
        <div className='mt-1 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
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
