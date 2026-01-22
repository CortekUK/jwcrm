import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useTranslation } from "react-i18next";

export function Toaster() {
  const { toasts } = useToast();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} dir={isRtl ? "rtl" : "ltr"}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose isRtl={isRtl} />
          </Toast>
        );
      })}
      <ToastViewport isRtl={isRtl} />
    </ToastProvider>
  );
}
