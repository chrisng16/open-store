"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StoreCardDisplay from "./_components/store-card-display";

export default function Page() {
  return (
    <Dialog defaultOpen={true}>
      <DialogContent
        className="w-[min(96vw,980px)] h-[min(86vh,720px)] p-0 overflow-hidden"
        overlayClassName="bg-background/90"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b bg-background/80 backdrop-blur px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl">Select a store</DialogTitle>
              <DialogDescription className="text-sm">
                Choose a location to manage. You can switch later.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-6 py-5">
            <StoreCardDisplay />
          </div>

          {/* Footer (optional) */}
          <div className="border-t px-6 py-4 text-xs text-muted-foreground">
            Store access is permission-based.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
