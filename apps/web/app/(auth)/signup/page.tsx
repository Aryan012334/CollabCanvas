import { PaintBucket } from "lucide-react";

import { SignupForm } from "@/components/signup-form";
import DarkMode from "@/components/DarkMode";
import AuthImage from "@/components/auth/AuthImage";

export default function SignupPage() {
  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div
        className='flex flex-col gap-4 p-6 md:p-10 h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400
'>
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
            <SignupForm />
          </div>
        </div>
        <div className='fixed bottom-10'>
          <DarkMode />
        </div>
      </div>
      <AuthImage />
    </div>
  );
}
