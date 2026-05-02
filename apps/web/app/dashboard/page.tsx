// app/dashboard/page.tsx
"use client";

import { useContext, useEffect, useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { SearchBar } from "@/components/dashboard/Searchbar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RoomsGrid } from "@/components/dashboard/RoomsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { StatsCards } from "@/components/dashboard/StatsCard";
import { useFetchUser } from "@/hooks/useUserFetcher";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";

export default function DashboardPage() {
  //   const { data: fetchedUser, isLoading, invalidateUser } = useFetchUser();

  const [searchQuery, setSearchQuery] = useState("");

  //   if (isLoading) {
  //     return <DashboardSkeleton />;
  //   }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950'>
      <Header />

      <main className='container mx-auto px-4 py-8 max-w-7xl'>
        <div className='mb-8'>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 auto-rows-auto'>
          <div className='lg:col-span-4 md:col-span-1'>
            <QuickActions />
          </div>

          <div className='lg:col-span-8 md:col-span-1'>
            <StatsCards />
          </div>

          <div className='lg:col-span-8 md:col-span-2 lg:row-span-2'>
            <RoomsGrid searchQuery={searchQuery} />
          </div>

          <div className='lg:col-span-4 md:col-span-2 lg:row-span-2'>
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  );
}
