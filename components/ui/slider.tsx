import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  size?: "default" | "lg"
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, size = "default", ...props }, ref) => {
  const trackSizes = {
    default: "h-2",
    lg: "h-3",
  }
  
  const thumbSizes = {
    default: "h-5 w-5",
    lg: "h-7 w-7",
  }

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center cursor-pointer",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track 
        className={cn(
          "relative w-full grow overflow-hidden rounded-full bg-muted",
          trackSizes[size]
        )}
      >
        <SliderPrimitive.Range className="absolute h-full bg-green-accent rounded-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block rounded-full border-4 border-green-accent bg-background shadow-lg",
          "ring-offset-background transition-all duration-150",
          "hover:scale-110 hover:shadow-xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "cursor-grab active:cursor-grabbing active:scale-95",
          thumbSizes[size]
        )} 
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
