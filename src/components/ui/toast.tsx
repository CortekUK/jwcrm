import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> & { isRtl?: boolean }
>(({ className, isRtl, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      isRtl ? "sm:left-0" : "sm:right-0",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-md border p-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border-[hsl(var(--jw-gold-accent))]/30 bg-background text-foreground shadow-[0_4px_12px_rgba(198,160,59,0.15)]",
        destructive: "destructive group border-[hsl(var(--destructive))]/40 bg-[#FFF8F0] text-[#8B4513] shadow-[0_4px_12px_rgba(184,105,60,0.2)]",
        success: "border-[hsl(var(--jw-primary-green))]/40 bg-[#F0F9F4] text-[hsl(var(--jw-primary-green))] shadow-[0_4px_12px_rgba(12,85,54,0.15)]",
        info: "border-[hsl(var(--jw-gold-accent))]/40 bg-[#FFFBF0] text-[hsl(var(--jw-text-charcoal))] shadow-[0_4px_12px_rgba(198,160,59,0.15)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary group-[.destructive]:border-[hsl(var(--destructive))]/40 group-[.destructive]:hover:border-[hsl(var(--destructive))] group-[.destructive]:hover:bg-[hsl(var(--destructive))] group-[.destructive]:hover:text-white group-[.success]:border-[hsl(var(--jw-primary-green))]/40 group-[.success]:hover:border-[hsl(var(--jw-primary-green))] group-[.success]:hover:bg-[hsl(var(--jw-primary-green))] group-[.success]:hover:text-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-gold-accent))] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> & { isRtl?: boolean }
>(({ className, isRtl, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 group-[.destructive]:text-[hsl(var(--destructive))] hover:text-foreground group-[.destructive]:hover:text-[#8B4513] group-[.success]:text-[hsl(var(--jw-primary-green))]/70 group-[.success]:hover:text-[hsl(var(--jw-primary-green))] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--jw-gold-accent))] focus:ring-offset-background",
      isRtl ? "left-2" : "right-2",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
