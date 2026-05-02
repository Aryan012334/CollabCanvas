"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Sun, Moon, Computer, Github, Twitter, Instagram } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
export const CanvasDropdown = () => {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (
    theme: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    setTheme(theme);
  };
  return (
    <>
      <DropdownMenuItem
        className='flex items-center gap-2 focus:bg-accent cursor-pointer focus:text-accent-foreground'
        asChild>
        <a
          href='https://github.com/yourusername'
          target='_blank'
          rel='noopener noreferrer'>
          <Github className='w-4 h-4' />
          <span>GitHub</span>
        </a>
      </DropdownMenuItem>

      <DropdownMenuItem
        className='flex items-center gap-2 focus:bg-accent cursor-pointer focus:text-accent-foreground'
        asChild>
        <a
          href='https://twitter.com/yourusername'
          target='_blank'
          rel='noopener noreferrer'>
          <Twitter className='w-4 h-4' />
          <span>Twitter</span>
        </a>
      </DropdownMenuItem>

      <DropdownMenuItem
        className='flex items-center gap-2 focus:bg-accent cursor-pointer focus:text-accent-foreground'
        asChild>
        <a
          href='https://instagram.com/yourusername'
          target='_blank'
          rel='noopener noreferrer'>
          <Instagram className='w-4 h-4' />
          <span>Instagram</span>
        </a>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        className='flex flex-col items-start gap-2'
        onSelect={(e) => e.preventDefault()}>
        <span className='text-sm font-medium'>Theme</span>
        <div className='flex gap-1 w-full'>
          <Button
            size='sm'
            variant={theme === "light" ? "default" : "ghost"}
            onClick={(e) => handleThemeChange("light", e)}
            className='flex-1'>
            <Sun
              className={cn(
                "w-4 h-4",
                theme === "light"
                  ? "text-white" // selected → visible on dark background
                  : "text-gray-800 dark:text-gray-100" // unselected → theme-aware
              )}
            />
          </Button>

          <Button
            size='sm'
            variant={theme === "dark" ? "default" : "ghost"}
            onClick={(e) => handleThemeChange("dark", e)}
            className='flex-1'>
            <Moon
              className={cn(
                "w-4 h-4",
                theme === "dark"
                  ? "text-white"
                  : "text-gray-800 dark:text-gray-100"
              )}
            />
          </Button>

          <Button
            size='sm'
            variant={theme === "system" ? "default" : "ghost"}
            onClick={(e) => handleThemeChange("system", e)}
            className='flex-1'>
            <Computer
              className={cn(
                "w-4 h-4",
                theme === "system"
                  ? "text-white"
                  : "text-gray-800 dark:text-gray-100"
              )}
            />
          </Button>
        </div>
      </DropdownMenuItem>
    </>
  );
};
