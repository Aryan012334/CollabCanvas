// components/dashboard/Header.tsx
"use client";

import { Bell, PaintBucket, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import DarkMode from "../DarkMode";
import { useContext } from "react";
import { Context } from "../providers/ContextProvider";

export function Header() {
  const { user } = useContext(Context);
  return (
    <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='container mx-auto px-4 flex h-16 items-center justify-between max-w-7xl'>
        {/* Logo */}
        <Link href='/dashboard' className='flex items-center gap-2 group'>
          <div className='relative'>
            <PaintBucket className='w-8 h-8 text-primary group-hover:text-primary/80 transition-colors' />
            <div className='absolute inset-0 blur-xl bg-primary/20 group-hover:bg-primary/30 transition-all' />
          </div>
          <span className='font-bold text-xl bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent'>
            Excalidraw Clone
          </span>
        </Link>

        {/* Right side */}
        <div className='flex items-center gap-4'>
          <DarkMode />
          {/* Notifications */}
          <Button variant='ghost' size='icon' className='relative'>
            <Bell className='w-5 h-5' />
            <span className='absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full' />
          </Button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                className='relative h-10 w-10 rounded-full'>
                <Avatar className='h-10 w-10 ring-2 ring-primary/10 hover:ring-primary/30 transition-all'>
                  <AvatarImage src='' alt='User' />
                  <AvatarFallback className='bg-gradient-to-br from-primary to-purple-600 text-white'>
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='w-56' align='end' forceMount>
              <DropdownMenuLabel className='font-normal'>
                <div className='flex flex-col space-y-1'>
                  <p className='text-sm font-medium leading-none'>
                    {user.name}
                  </p>
                  <p className='text-xs leading-none text-muted-foreground'>
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className='mr-2 h-4 w-4' />
                <span>View Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className='mr-2 h-4 w-4' />
                <span>Account Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className='text-red-600 focus:text-red-600'>
                <LogOut className='mr-2 h-4 w-4' />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
