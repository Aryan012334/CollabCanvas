"use client";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { DemoSection } from "@/components/landing/demo-section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Testimonials } from "@/components/landing/testimonials";
import { CtaBanner } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { useContext } from "react";
import { Context } from "@/components/providers/ContextProvider";

export default function Page() {
  const { user } = useContext(Context);
  console.log(user);
  return (
    <main className='min-h-svh flex flex-col'>
      <Navbar />
      <Hero />
      <DemoSection />
      <FeatureGrid />
      <Testimonials />
      <CtaBanner />
      <Footer />
    </main>
  );
}
