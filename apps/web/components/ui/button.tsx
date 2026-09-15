import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-brand-orange text-primary-foreground shadow-xs hover:bg-brand-orange-deep active:scale-95 transition-all",
        destructive:
          "bg-destructive text-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-ani-control-border bg-transparent shadow-none hover:border-ani-control-border-hover hover:bg-ani-hover hover:text-ani-text active:scale-[0.98] transition-all",
        secondary:
          "bg-ani-panel text-ani-text shadow-none hover:bg-ani-hover hover:text-ani-text active:scale-[0.98] transition-all",
        ghost:
          "hover:bg-ani-hover hover:text-ani-text active:scale-[0.98] transition-all",
        link: "text-ani-muted underline-offset-4 hover:underline hover:text-ani-text",
        cream:
          "rounded-full border border-transparent bg-ani-primary font-semibold text-ani-on-primary shadow-none hover:bg-ani-primary-hover hover:text-ani-on-primary active:scale-[0.98] focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ani-focus disabled:opacity-40",
        creamOutline:
          "rounded-full border border-ani-control-border bg-transparent font-semibold text-ani-text shadow-none hover:border-ani-control-border-hover hover:bg-ani-hover hover:text-ani-text active:scale-[0.98] focus-visible:border-ani-focus focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ani-focus disabled:opacity-40",
        creamQuiet:
          "rounded-full border border-transparent bg-transparent font-semibold text-ani-muted shadow-none hover:bg-ani-hover hover:text-ani-text active:scale-[0.98] focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ani-focus disabled:opacity-40",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        touch: "min-h-11 min-w-11 rounded-md px-5 py-3 has-[>svg]:px-4",
        control:
          "min-h-11 min-w-11 rounded-full px-[18px] py-2.5 text-[13px] font-semibold has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
