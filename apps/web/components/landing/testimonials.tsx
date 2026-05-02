import { Card } from "@/components/ui/card";

export function Testimonials() {
  const quotes = [
    {
      body: "The canvas feels unbelievably responsive. I forgot it was a web app.",
      author: "Jordan M.",
      title: "Product Designer",
    },
    {
      body: "The keyboard shortcuts make this the fastest way to communicate ideas.",
      author: "Priya K.",
      title: "Frontend Engineer",
    },
    {
      body: "Beautiful by default. Our team uses it daily for brainstorms.",
      author: "Alex M.",
      title: "VP of Product",
    },
  ];
  return (
    <section id='testimonials' className='border-t bg-muted/30'>
      <div className='mx-auto max-w-6xl px-4 py-16 md:py-20'>
        <div className='mb-8 text-center'>
          <h2 className='text-balance text-3xl font-semibold tracking-tight md:text-4xl'>
            Loved by fast-moving teams
          </h2>
          <p className='mx-auto mt-2 max-w-2xl text-pretty text-muted-foreground md:text-lg leading-relaxed'>
            Designers, engineers, and PMs use Sketchboard to move from idea to
            clarity—together.
          </p>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          {quotes.map((q, i) => (
            <Card
              key={i}
              className='rounded-xl border p-6 animate-in fade-in slide-in-from-bottom-2'
              style={{ animationDelay: `${i * 80}ms` }}>
              <p className='text-pretty leading-relaxed'>“{q.body}”</p>
              <div className='mt-4 text-sm text-muted-foreground'>
                <span className='font-medium text-foreground'>{q.author}</span>{" "}
                • {q.title}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
