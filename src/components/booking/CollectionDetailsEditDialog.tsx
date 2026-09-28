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
import { useUpdateBookingJourneyFields } from "@/hooks/useBookings";
import {
  COLLECTION_DETAIL_FIELDS,
  collectionDetailsFromBooking,
  type CollectionDetails,
} from "@/lib/collection-details";

type CollectionDetailsSource = Parameters<typeof collectionDetailsFromBooking>[0];

interface CollectionDetailsEditDialogProps {
  bookingId: string;
  booking: CollectionDetailsSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionDetailsEditDialog({
  bookingId,
  booking,
  open,
  onOpenChange,
}: CollectionDetailsEditDialogProps) {
  const updateJourneyFields = useUpdateBookingJourneyFields();
  const [draft, setDraft] = useState<CollectionDetails>(() => collectionDetailsFromBooking(booking));

  useEffect(() => {
    if (open) setDraft(collectionDetailsFromBooking(booking));
    // Reset only when the dialog opens, not on every booking refetch while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    try {
      await updateJourneyFields.mutateAsync({ bookingId, fields: draft });
      toast.success("Collection details updated");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update collection details", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !updateJourneyFields.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Collection Details</DialogTitle>
          <DialogDescription>
            Update site access and handling information after speaking with the booker.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {COLLECTION_DETAIL_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
              <Input
                id={`edit-${field.key}`}
                placeholder={field.placeholder}
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={updateJourneyFields.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={updateJourneyFields.isPending} onClick={handleSave}>
            {updateJourneyFields.isPending ? (
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
