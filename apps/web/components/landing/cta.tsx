import { Button } from "@/components/ui/button";
import Link from "next/link";

export function CtaBanner() {
  return (
    <section id='pricing' className='border-t'>
      <div className='mx-auto max-w-6xl px-4 py-14 md:py-16'>
        <div className='relative overflow-hidden rounded-2xl border bg-card p-8 md:p-10'>
          <div className='absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-in fade-in' />
          <div className='flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <h3 className='text-balance text-2xl font-semibold tracking-tight md:text-3xl'>
                Ready to draw at the speed of thought?
              </h3>
              <p className='mt-1 text-pretty text-muted-foreground leading-relaxed'>
                Create your first board in seconds. Free to start, no credit
                card.
              </p>
            </div>
            <div className='flex gap-2'>
              <Button asChild size='lg'>
                <Link href='/signup'>Get started</Link>
              </Button>
              <Button asChild variant='secondary' size='lg'>
                <Link href='/login'>I have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
