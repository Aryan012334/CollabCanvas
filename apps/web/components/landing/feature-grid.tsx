import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Layers,
  PenTool,
  Users,
  ShieldCheck,
  Keyboard,
} from "lucide-react";

export function FeatureGrid() {
  const features = [
    {
      title: "Instant performance",
      desc: "Low-latency interactions that feel native. No jank.",
      icon: <Zap className='size-5' />,
    },
    {
      title: "Infinite layers",
      desc: "Reorder, group, and arrange without limits.",
      icon: <Layers className='size-5' />,
    },
    {
      title: "Precise tools",
      desc: "Shapes, arrows, alignment, and smart handles.",
      icon: <PenTool className='size-5' />,
    },
    {
      title: "Multiplayer-ready",
      desc: "Built for collaboration from the ground up.",
      icon: <Users className='size-5' />,
    },
    {
      title: "Secure by default",
      desc: "Private boards and access controls.",
      icon: <ShieldCheck className='size-5' />,
    },
    {
      title: "Keyboard-first",
      desc: "Fluid shortcuts that keep you in the flow.",
      icon: <Keyboard className='size-5' />,
    },
  ];

  return (
    <section id='features' className='border-t'>
      <div className='mx-auto max-w-6xl px-4 py-16 md:py-20'>
        <div className='mb-8 text-center'>
          <Badge variant='outline' className='px-3 py-1'>
            Powerful features
          </Badge>
          <h2 className='mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl'>
            Thoughtfully engineered for speed
          </h2>
          <p className='mx-auto mt-2 max-w-2xl text-pretty text-muted-foreground md:text-lg leading-relaxed'>
            Everything you need to ideate and communicate visually, without the
            overhead.
          </p>
        </div>

        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {features.map((f, i) => (
            <Card
              key={f.title}
              className='group rounded-xl border p-5 transition-transform hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-2'
              style={{ animationDelay: `${i * 60}ms` }}>
              <div className='flex items-start gap-3'>
                <div className='mt-1 inline-flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground'>
                  {f.icon}
                </div>
                <div>
                  <h3 className='font-medium'>{f.title}</h3>
                  <p className='mt-1 text-sm text-muted-foreground'>{f.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
