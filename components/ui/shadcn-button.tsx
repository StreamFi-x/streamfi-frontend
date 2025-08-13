import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white hover:bg-purple-700 focus:ring-2 py-3 px-5  focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black",
        outline:
          "bg-transparent border border-purple-600 text-purple-600 hover:bg-purple-600/10 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost:
          "bg-transparent text-white hover:bg-white/10 focus:ring-2 focus:ring-white/20",
        link: "bg-transparent text-purple-600 hover:underline  h-auto",
      },
      size: {
        default: "h-9 text-xs px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs py-1.5",
        md: "text-sm px-4 py-2",
        lg: "h-10 text-base rounded-md px-8",
        icon: "h-9 w-9",
      },
      state: {
        active: "cursor-default",
        disabled: "opacity-60 cursor-not-allowed",
        loading: "cursor-wait",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      state: "active",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  isLink?: boolean;
  href?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      state,
      asChild = false,
      loading,
      isLink,
      href,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    if (isLink && href) {
      return (
        <Link
          href={href}
          className={
            state == "disabled" || loading ? "pointer-events-none" : ""
          }
        >
          <Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...(loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />)}
            {...props}
          />
        </Link>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
