// components/dashboard/SearchBar.tsx
"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className='relative group'>
      <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors' />
      <Input
        type='search'
        placeholder='Search rooms, users, or canvas content...'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='pl-12 h-14 text-base bg-background/60 backdrop-blur-sm border-2 focus-visible:ring-4 focus-visible:ring-primary/10 transition-all'
      />
    </div>
  );
}
