"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * Optional accessible description, rendered visually hidden through
   * DialogPrimitive.Description. Use it when the dialog has no visible
   * <DialogDescription />.
   */
  description?: React.ReactNode
  /**
   * Accessible label of the built-in close button. Defaults to the translated
   * `common.actions.close` message.
   */
  closeLabel?: string
  /** Disables the built-in close button (e.g. while a form submits). */
  closeDisabled?: boolean
}

const FALLBACK_CLOSE_LABEL = "Close"

/**
 * Translated label for the close button. Dialogs are also rendered outside a
 * NextIntlClientProvider (isolated component tests, error boundaries), where
 * `useTranslations` throws; fall back to English there instead of crashing.
 * The provider never appears or disappears for a mounted dialog, so the hook
 * call order stays stable between renders.
 */
function useCloseLabel(): string {
  try {
    const label = useTranslations("common.actions")("close")
    return typeof label === "string" && label ? label : FALLBACK_CLOSE_LABEL
  } catch {
    return FALLBACK_CLOSE_LABEL
  }
}

/**
 * Radix always points `aria-describedby` at its description id and warns
 * ("Missing `Description` or `aria-describedby={undefined}`") when no
 * Description is rendered. Instead of forcing every dialog to pass
 * `aria-describedby={undefined}` (which would also unlink real descriptions),
 * we keep the attribute only while the referenced element exists in the DOM.
 * The check runs from the content's ref callback (the Portal mounts the content
 * after DialogContent's own first commit) and again after every render; both
 * happen before Radix's passive warning effect.
 */
function syncDescribedBy(node: HTMLElement, descriptionIdRef: React.MutableRefObject<string | null>) {
  const id = node.getAttribute("aria-describedby") ?? descriptionIdRef.current
  if (!id) return
  descriptionIdRef.current = id
  if (node.ownerDocument.getElementById(id)) {
    node.setAttribute("aria-describedby", id)
  } else {
    node.removeAttribute("aria-describedby")
  }
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, description, closeLabel, closeDisabled, ...props }, forwardedRef) => {
  const defaultCloseLabel = useCloseLabel()
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const descriptionIdRef = React.useRef<string | null>(null)
  // Respect an explicit aria-describedby from the caller.
  const managesDescription = !("aria-describedby" in props)
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node
      if (node && managesDescription) syncDescribedBy(node, descriptionIdRef)
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef, managesDescription]
  )
  React.useLayoutEffect(() => {
    if (managesDescription && contentRef.current) {
      syncDescribedBy(contentRef.current, descriptionIdRef)
    }
  })

  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={setRefs}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {description ? (
        <DialogPrimitive.Description className="sr-only">
          {description}
        </DialogPrimitive.Description>
      ) : null}
      {children}
      {/* 40px hit area around the 16px icon. */}
      <DialogPrimitive.Close
        disabled={closeDisabled}
        className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground ring-offset-background transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{closeLabel ?? defaultCloseLabel}</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
