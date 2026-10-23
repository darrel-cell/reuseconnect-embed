import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateBookingSiteContact } from "@/hooks/useBookings";

interface SiteContactEditDialogProps {
  bookingId: string;
  booking: { siteContactName?: string | null; siteContactPhone?: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SiteContactEditDialog({ bookingId, booking, open, onOpenChange }: SiteContactEditDialogProps) {
  const updateSiteContact = useUpdateBookingSiteContact();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (open) {
      setName(booking.siteContactName || "");
      setPhone(booking.siteContactPhone || "");
    }
    // Reset only when the dialog opens, not on every booking refetch while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    try {
      await updateSiteContact.mutateAsync({
        bookingId,
        contact: { siteContactName: name, siteContactPhone: phone },
      });
      toast.success("Site contact updated");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update site contact", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !updateSiteContact.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Site Contact</DialogTitle>
          <DialogDescription>Who the driver should ask for at the collection site.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-siteContactName">Site Contact Name</Label>
            <Input
              id="edit-siteContactName"
              placeholder="Site contact person"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-siteContactPhone">Site Contact Phone</Label>
            <Input
              id="edit-siteContactPhone"
              placeholder="+44 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={updateSiteContact.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={updateSiteContact.isPending} onClick={handleSave}>
            {updateSiteContact.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
