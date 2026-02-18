import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline: "border border-border/60 bg-transparent hover:bg-accent/30",
        ghost: "hover:bg-accent/30",
      },
    },
    defaultVariants: {
      variant: "ghost",
    },
  },
);

