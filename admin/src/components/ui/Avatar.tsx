export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("") || "؟";
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-brand font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}
