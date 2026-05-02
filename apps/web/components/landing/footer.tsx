import Link from "next/link";

export function Footer() {
  return (
    <footer className='border-t'>
      <div className='mx-auto max-w-6xl px-4 py-10'>
        <div className='flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
          <div className='text-sm text-muted-foreground'>
            © {new Date().getFullYear()} Sketchboard. Built with Next.js and
            shadcn/ui.
          </div>

          <nav className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
            <Link
              className='text-muted-foreground hover:text-foreground transition-colors'
              href='#'>
              Docs
            </Link>
            <Link
              className='text-muted-foreground hover:text-foreground transition-colors'
              href='#'>
              Changelog
            </Link>
            <Link
              className='text-muted-foreground hover:text-foreground transition-colors'
              href='#'>
              Privacy
            </Link>
            <Link
              className='text-muted-foreground hover:text-foreground transition-colors'
              href='#'>
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
