import { PaintBucket } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import DarkMode from "@/components/DarkMode";
import AuthImage from "@/components/auth/AuthImage";

export default function LoginPage() {
  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div className='flex flex-col gap-4 p-6 md:p-10 '>
        <div className='flex justify-center gap-2 md:justify-start'>
          <a href='#' className='flex items-center gap-2 font-medium'>
            <div className='bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-md'>
              <PaintBucket className='size-6' />
            </div>
            Excalidraw Clone
          </a>
        </div>
        <div className='flex flex-1 items-center justify-center'>
          <div className='w-full max-w-xs'>
            <LoginForm />
          </div>
        </div>
        <div>
          <DarkMode />
        </div>
      </div>
      <AuthImage />
    </div>
  );
}
