"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardSkeleton() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950'>
      {/* Header */}
      <header className='border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md'>
        <div className='container mx-auto px-4 py-4 max-w-7xl flex items-center justify-between'>
          <Skeleton className='h-8 w-32 rounded-lg' />
          <Skeleton className='h-8 w-8 rounded-full' />
        </div>
      </header>

      <main className='container mx-auto px-4 py-8 max-w-7xl'>
        {/* Search */}
        <div className='mb-8'>
          <Skeleton className='h-10 w-full rounded-lg' />
        </div>

        {/* Dashboard Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 auto-rows-auto'>
          {/* Quick Actions */}
          <div className='lg:col-span-4 md:col-span-1 space-y-4'>
            <Skeleton className='h-32 w-full rounded-xl' />
            <Skeleton className='h-32 w-full rounded-xl' />
            <Skeleton className='h-32 w-full rounded-xl' />
          </div>

          {/* Stats Cards */}
          <div className='lg:col-span-8 md:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            <Skeleton className='h-24 w-full rounded-xl' />
            <Skeleton className='h-24 w-full rounded-xl' />
            <Skeleton className='h-24 w-full rounded-xl' />
          </div>

          {/* Rooms Grid */}
          <div className='lg:col-span-8 md:col-span-2 lg:row-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-40 w-full rounded-xl' />
            ))}
          </div>

          {/* Recent Activity */}
          <div className='lg:col-span-4 md:col-span-2 lg:row-span-2 space-y-4 mt-4'>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className='flex items-center gap-4'>
                <Skeleton className='h-10 w-10 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-4 w-1/2' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
