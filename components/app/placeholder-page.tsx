import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{
    title: string;
    description: string;
  }>;
};

export function PlaceholderPage({ eyebrow, title, description, cards }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#27312E] bg-[#111716]/92 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] lg:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[#7BF179]">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#F3F5F4] lg:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9DA9A4] lg:text-base">{description}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="text-xl">{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-flex items-center rounded-full border border-[#2f3b37] bg-[#111716] px-3 py-1 text-xs font-medium text-[#7BF179]">
                Planned
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
