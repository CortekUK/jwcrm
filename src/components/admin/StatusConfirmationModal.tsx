import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_WORKFLOW, type WillStatus } from "@/lib/status-config";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface StatusConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStatus: WillStatus;
  toStatus: WillStatus;
  onConfirm: (notes: string) => void;
}

export function StatusConfirmationModal({
  open,
  onOpenChange,
  fromStatus,
  toStatus,
  onConfirm,
}: StatusConfirmationModalProps) {
  const [notes, setNotes] = useState("");
  const fromConfig = STATUS_WORKFLOW[fromStatus];
  const toConfig = STATUS_WORKFLOW[toStatus];

  const isBackwardTransition = toConfig.order < fromConfig.order;
  const isFinalized = toStatus === "finalized";

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[#E6E6E4]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl text-[hsl(var(--jw-primary-green))] flex items-center gap-2">
            {(isBackwardTransition || isFinalized) && (
              <AlertTriangle className="h-5 w-5 text-[#C6A03B]" />
            )}
            Confirm Status Change
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#555555]">
            Are you sure you want to change this will's status from{" "}
            <span className="font-semibold" style={{ color: fromConfig.color }}>
              {fromConfig.label}
            </span>{" "}
            to{" "}
            <span className="font-semibold" style={{ color: toConfig.color }}>
              {toConfig.label}
            </span>
            ?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {isFinalized && (
            <div className="rounded-lg bg-[#C6A03B]/10 border border-[#C6A03B] p-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#555555]">
                <strong>Warning:</strong> Finalizing a will is an irreversible action. Make sure all
                reviews are complete.
              </p>
            </div>
          )}

          {isBackwardTransition && (
            <div className="rounded-lg bg-[#C6A03B]/10 border border-[#C6A03B] p-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-[#C6A03B] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#555555]">
                <strong>Warning:</strong> You are moving backwards in the workflow. Please provide a
                reason below.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-[#555555]">
              Notes {isBackwardTransition && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isBackwardTransition
                  ? "Required: Explain why you are reverting this status..."
                  : "Optional: Add notes about this status change..."
              }
              className="resize-none border-[#E6E6E4] focus:border-[#C6A03B] focus:ring-[#C6A03B]"
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="border-[#E6E6E4] text-[#555555] hover:bg-[#F8F6EC]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isBackwardTransition && !notes.trim()}
            className="bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-hover-green))] disabled:opacity-50"
          >
            Confirm Change
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
