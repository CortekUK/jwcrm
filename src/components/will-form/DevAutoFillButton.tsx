import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface DevAutoFillButtonProps {
  onAutoFill: () => void;
}

export function DevAutoFillButton({ onAutoFill }: DevAutoFillButtonProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onAutoFill}
      className="border border-border/40 text-muted-foreground bg-background/80 hover:bg-accent hover:text-[#C6A03B] hover:border-[#C6A03B] text-[11px] gap-1 h-6 px-2 opacity-60 hover:opacity-100 transition-all backdrop-blur-sm"
      title="Auto-fill with test data (Dev only)"
    >
      <Sparkles className="w-3 h-3" />
      Fill
    </Button>
  );
}
