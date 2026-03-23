type AppHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function AppHeader({ eyebrow, title, description }: AppHeaderProps) {
  return (
    <header className="rounded-[28px] border border-[#27272a] bg-[linear-gradient(180deg,rgba(17,17,19,0.94),rgba(10,10,11,0.96))] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.46)] backdrop-blur-xl lg:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#d4d4d8]">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#F8FAFC] lg:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#a1a1aa] lg:text-base">{description}</p>
    </header>
  );
}
