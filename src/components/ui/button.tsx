import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md active:bg-primary-active",
        header: "rounded-full bg-primary/5 border border-border text-foreground hover:bg-foreground/10 hover:shadow-sm active:bg-primary/15",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/95",
        outline: "border border-input bg-background hover:bg-secondary text-foreground hover:border-primary/50 active:bg-secondary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        ghost: "hover:bg-secondary/80 hover:text-foreground active:bg-secondary/70",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        accent: "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90",
        hero: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md hover:shadow-lg font-semibold",
        glass: "bg-card/80 backdrop-blur-sm border border-border/50 text-foreground hover:bg-card/90 shadow-sm",
      },
      size: {
        default: "h-10 px-4 py-2 rounded-lg",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 px-5 text-sm",
        xl: "h-14 rounded-xl px-8 text-lg",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
