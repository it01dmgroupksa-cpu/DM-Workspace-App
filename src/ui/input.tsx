// input.tsx
import * as React from "react";
import { cn } from "../../lib/utils";
import { User } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, ...props }, ref) => {
    const hasStartIcon = startIcon && React.isValidElement(startIcon);
    const hasEndIcon = endIcon && React.isValidElement(endIcon);

    const inputContainerClasses = cn(
      "relative",
      "flex",
      "items-center"
    );

    const inputClasses = cn(
      "w-full", // Set width to 100%
      "border",
      "bg-white",
      "px-3",
      "py-2",
      "text-sm",
      "ring-offset-background",
      "file:border-0",
      "file:bg-transparent",
      "file:text-sm",
      "file:font-medium",
      "placeholder:gray-100",
      "focus-visible:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
      "rounded-md",
      "placeholder-text-muted",
      hasStartIcon ? "pl-10" : "", // Add left padding when there is a start icon
      hasEndIcon ? "pr-10" : "" // Add right padding when there is an end icon
    );

    return (
      <div className={inputContainerClasses}>
        {hasStartIcon && (
          <span className="absolute left-3">
            {startIcon}
          </span>
        )}
        <input
          type={type}
          className={inputClasses}
          ref={ref}
          {...props}
        />
        {hasEndIcon && (
          <span className="absolute right-3">
            {endIcon}
          </span>
        )}
      </div>
    );
  }
);

export { Input };
