import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { WillDocumentPreview } from "./WillDocumentPreview";

interface WillPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answers: any;
  clientName: string;
  willId: string;
  locale?: string;
  includeSignature?: boolean;
}

export function WillPrintModal({
  open,
  onOpenChange,
  answers,
  clientName,
  willId,
  locale = "en",
  includeSignature = true,
}: WillPrintModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0">
        <DialogHeader className="px-6 py-4 border-b bg-white no-print sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-[hsl(var(--jw-primary-green))]">
              Will Document Preview
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrint}
                className="bg-[hsl(var(--jw-primary-green))] hover:bg-[hsl(var(--jw-primary-green))]/90 text-white"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print / Save as PDF
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Use Ctrl+P (Windows) or Cmd+P (Mac) to print, or click the Print button above.
            Select "Save as PDF" in your print dialog to create a PDF file.
          </p>
        </DialogHeader>

        <div className="overflow-y-auto h-[calc(95vh-120px)] bg-gray-100">
          <WillDocumentPreview
            answers={answers}
            clientName={clientName}
            willId={willId}
            locale={locale}
            includeSignature={includeSignature}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
