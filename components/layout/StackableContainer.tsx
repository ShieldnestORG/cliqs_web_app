import { cn } from "@/lib/utils";

type ContainerVariant = "default" | "institutional" | "elevated";
type ContainerAccent = "none" | "left" | "top" | "bracket";

interface Props {
  base?: boolean;
  children: React.ReactNode;
  lessPadding?: boolean;
  lessMargin?: boolean;
  lessRadius?: boolean;
  fullHeight?: boolean;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
  variant?: ContainerVariant;
  accent?: ContainerAccent;
  hover?: boolean;
}

const StackableContainer = ({
  base,
  children,
  lessPadding,
  lessMargin,
  lessRadius,
  fullHeight,
  divProps,
  variant = "default",
  accent = "none",
  hover = false,
}: Props) => {
  const { className: divClassName, ...restDivProps } = divProps || {};

  const variantClasses = {
    default: base
      ? "bg-card border border-border shadow-lg"
      : "bg-muted/30 border border-border/50",
    institutional: "bg-card border-2 border-border shadow-card",
    elevated: "bg-card border border-border shadow-lg hover:shadow-xl",
  };

  const accentClasses = {
    none: "",
    left: "card-accent-left",
    top: "card-accent-top",
    bracket: "card-bracket-corner",
  };

  return (
    <div
      className={cn(
        // Base styles
        "relative flex flex-col justify-between",
        "transition-all duration-200",

        // Variant styles
        variantClasses[variant],

        // Accent styles
        accentClasses[accent],

        // Padding
        lessPadding ? "p-4" : "p-6",

        // Margin
        lessMargin || base ? "mt-4" : "mt-6",
        "first:mt-0",

        // Border radius - institutional variant uses rounded corners
        variant === "institutional" ? "rounded-xl" : lessRadius ? "rounded-lg" : "rounded-xl",

        // Height
        fullHeight && "h-full",

        // Max width for base containers
        base && "w-full",

        // Hover effect
        hover && "cursor-pointer hover:-translate-y-[3px] hover:shadow-card-hover",

        // Custom className from divProps
        divClassName,
      )}
      {...restDivProps}
    >
      {children}
    </div>
  );
};

export default StackableContainer;
