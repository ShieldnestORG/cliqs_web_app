import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      visibleToasts={5}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "group-[.toast]:font-semibold group-[.toast]:tracking-tight",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-foreground group-[.toast]:text-background group-[.toast]:rounded-lg group-[.toast]:font-semibold group-[.toast]:uppercase group-[.toast]:text-xs group-[.toast]:tracking-wide",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:font-semibold group-[.toast]:uppercase group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-card group-[.toast]:border-2 group-[.toast]:border-border group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:rounded-lg group-[.toast]:transition-colors",
          error:
            "group-[.toaster]:!bg-card group-[.toaster]:!border-destructive group-[.toaster]:!border-l-4",
          success:
            "group-[.toaster]:!bg-card group-[.toaster]:!border-l-4 group-[.toaster]:border-l-[hsl(var(--toast-green))]",
          warning:
            "group-[.toaster]:!bg-card group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-amber-500",
          info:
            "group-[.toaster]:!bg-card group-[.toaster]:!border-l-4 group-[.toaster]:border-l-[hsl(var(--accent-purple))]",
          loading:
            "group-[.toaster]:!bg-card group-[.toaster]:!border-l-4 group-[.toaster]:border-l-[hsl(var(--accent-purple))]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
