import zaghetto from "@/assets/zaghetto.png";
import { cn } from "@/lib/utils";

export function ZaghettoIcon({ className }: { className?: string }) {
  return (
    <img
      src={zaghetto}
      alt="Zaghetto"
      className={cn("inline-block h-[1.6em] w-[1.6em] object-contain align-[-0.4em]", className)}
    />
  );
}