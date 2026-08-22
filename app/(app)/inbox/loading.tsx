export default function LiveInboxLoading() {
  return <div className="space-y-5" aria-label="Loading live inbox"><div className="h-56 animate-pulse rounded-[28px] bg-[#181818]" /><div className="space-y-3 rounded-[24px] bg-[#181818] p-5">{Array.from({ length: 4 }, (_, index) => <div className="h-36 animate-pulse rounded-[20px] bg-[#111111]" key={index} />)}</div></div>;
}
