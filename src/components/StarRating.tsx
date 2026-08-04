import { Star } from "lucide-react";

export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.25 && value - full < 0.75;
  const total = 5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={filled ? "fill-primary text-primary" : "text-border"}
          />
        );
      })}
    </div>
  );
}
