"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StoreCardDisplay from "./_components/store-card-display";

export default function Page() {

  return (
    <Dialog defaultOpen={true}>
      <DialogContent
        className="md:max-w-3xl max-w-xl h-4/5 w-full p-0 overflow-hidden"
        overlayClassName="bg-background/90"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b backdrop-blur px-6 py-5">
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
