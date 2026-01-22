import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          className={cn(
            "h-[44px] rounded-md pr-10 rtl:pr-3 rtl:pl-10 placeholder:text-[#A0A0A0]",
            error ? "border-[#C0392B]" : "border-[#E6E6E4]",
            "focus:border-[#C6A03B] focus:ring-2 focus:ring-[rgba(198,160,59,0.35)]",
            "transition-all duration-200",
            className
          )}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent rtl:right-auto rtl:left-0"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
          ) : (
            <Eye className="h-4 w-4 text-[hsl(var(--jw-gold-accent))]" />
          )}
        </Button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
