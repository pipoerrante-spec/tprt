import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium tracking-tight",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-secondary/40 text-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
        danger: "border-rose-500/30 bg-rose-500/10 text-rose-200",
        info: "border-sky-500/30 bg-sky-500/10 text-sky-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
