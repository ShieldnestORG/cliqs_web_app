import * as React from "react"

import { cn } from "@/lib/utils"

type InputVariant = "default" | "institutional" | "filled"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  label?: string
  description?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type, 
    variant = "default",
    error,
    leftIcon,
    rightIcon,
    label,
    description,
    id,
    ...props 
  }, ref) => {
    const inputId = id || React.useId()
    
    const variantClasses = {
      default: "rounded-lg border border-input bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      institutional: "rounded-xl border-2 border-border bg-card font-mono focus:border-green-accent focus:ring-0 focus:ring-offset-0",
      filled: "rounded-lg border-none bg-muted focus:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring",
    }

    const inputElement = (
      <input
        type={type}
        id={inputId}
        className={cn(
          "flex h-10 w-full px-3 py-2 text-sm ring-offset-background transition-colors duration-200",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          leftIcon && "pl-10",
          rightIcon && "pr-10",
          error && "border-destructive focus:border-destructive bg-destructive/5",
          className
        )}
        ref={ref}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : description ? `${inputId}-desc` : undefined}
        {...props}
      />
    )

    // If no label/icons/error, return simple input
    if (!label && !leftIcon && !rightIcon && !error && !description) {
      return inputElement
    }

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
            {props.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          {inputElement}
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        
        {description && !error && (
          <p id={`${inputId}-desc`} className="mt-1.5 text-xs text-muted-foreground">
            {description}
          </p>
        )}
        
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input, type InputVariant }
