"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import DarkMode from "../DarkMode";

export function Navbar() {
  return (
    <header className='sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='mx-auto max-w-6xl px-4'>
        <div className='flex h-14 items-center justify-between'>
          <Link
            href='/'
            className='group inline-flex items-center gap-2'
            aria-label='Excalidraw Clone Home'>
            <Image
              src='/placeholder-logo.svg'
              width={24}
              height={24}
              alt='Logo'
              className='opacity-90 transition-opacity group-hover:opacity-100'
            />
            <span className='font-medium tracking-tight'>Excalidraw Clone</span>
          </Link>

          <nav className='hidden items-center gap-6 md:flex'>
            <Link
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
              href='#features'>
              Features
            </Link>
            <Link
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
              href='#demo'>
              Demo
            </Link>
            <Link
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
              href='#testimonials'>
              Love
            </Link>
            <Link
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
              href='#pricing'>
              Pricing
            </Link>
          </nav>

          <div className='flex items-center gap-2'>
            <Button asChild variant='ghost' className='hidden sm:inline-flex'>
              <Link href='/login'>Log in</Link>
            </Button>
            <Button asChild>
              <Link href='/signup'>Sign up</Link>
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
