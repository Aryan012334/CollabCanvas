"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Github, Paintbrush } from "lucide-react";
import DarkMode from "../DarkMode";

export function Navbar() {
  return (
    <header className='sticky top-0 z-50 w-full border-b border-white/10 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55'>
      <div className='mx-auto max-w-7xl px-5'>
        <div className='flex h-16 items-center justify-between'>
          <Link
            href='/'
            className='group inline-flex items-center gap-2'
            aria-label='CollabDraw Home'>
            <span className='grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm'>
              <Paintbrush className='size-4' />
            </span>
            <span className='font-semibold tracking-tight'>collabdraw</span>
          </Link>

          <nav className='hidden items-center gap-6 md:flex'>
            <Link
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
              href='#features'>
              Features
            </Link>
            <Link
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
              href='#demo'>
              Demo
            </Link>
            <Link
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
              href='#how-it-works'>
              How it works
            </Link>
          </nav>

          <div className='flex items-center gap-2'>
            <Button asChild variant='ghost' className='hidden sm:inline-flex'>
              <Link href='/login'>Log in</Link>
            </Button>
            <Button asChild className='rounded-full px-4'>
              <Link href='/signup'>Start a board <ArrowUpRight className='size-4' /></Link>
            </Button>
            <Button
              asChild
              variant='ghost'
              size='icon'
              aria-label='GitHub'
              title='GitHub'>
              <a href='https://github.com' target='_blank' rel='noreferrer'>
                <Github className='size-5' />
              </a>
            </Button>
            <DarkMode />
          </div>
        </div>
      </div>
    </header>
  );
}
