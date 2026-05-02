import React from "react";

const AuthImage = () => {
  return (
    <div className='bg-muted relative hidden h-screen lg:block overflow-hidden rounded-tl-4xl rounded-bl-4xl'>
      <img
        src='https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1760'
        alt='Image'
        className='absolute inset-0 h-full w-full object-cover dark:brightness-[0.6]'
      />
    </div>
  );
};

export default AuthImage;
