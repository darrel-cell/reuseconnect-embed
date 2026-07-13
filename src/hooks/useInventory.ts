import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService, InventoryItem, InventoryUploadItem } from "@/services/inventory.service";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function useInventory(clientId?: string | null) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['inventory', clientId || user?.id],
    queryFn: () => inventoryService.getInventory(clientId || undefined),
    enabled: !!user,
  });
}

export function useAvailableInventory(allocatedTo: string, category?: string, conditionCode?: string) {
  return useQuery({
    queryKey: ['inventory', 'available', allocatedTo, category, conditionCode],
    queryFn: () => inventoryService.getAvailableInventory(allocatedTo, category, conditionCode),
    enabled: !!allocatedTo,
  });
}

/** Mover bookings: mover_allocated for client; bookingId scopes rows to that mover booking. */
export function useMoverAllocatedInventory(
  clientId: string | undefined,
  bookingId?: string | undefined,
  category?: string,
  conditionCode?: string
) {
  return useQuery({
    queryKey: ['inventory', 'mover-allocated', clientId, bookingId, category, conditionCode],
    queryFn: () => inventoryService.getMoverAllocatedInventory(clientId!, bookingId, category, conditionCode),
    enabled: !!clientId,
  });
}

export function useUploadInventory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      items,
      clientId,
      sourceBookingId,
    }: {
      items: InventoryUploadItem[];
      clientId?: string;
      sourceBookingId?: string;
    }) => inventoryService.uploadInventory(items, clientId, sourceBookingId),
    onSuccess: async (data) => {
      const updated = data.updated ?? 0;
      const uniqueTotal = data.uniqueTotal ?? data.total;
      if (data.created === 0 && updated === 0) {
        toast.success("No inventory changes", {
          description: "All uploaded rows were duplicates with no effective update.",
        });
      } else if (updated > 0 && data.created > 0) {
        toast.success("Inventory upload completed", {
          description: `Created ${data.created} and updated ${updated} serial(s) from ${uniqueTotal} unique row(s).`,
        });
      } else if (updated > 0) {
        toast.success("Inventory updated", {
          description: `Updated ${updated} serial(s) using latest uploaded values.`,
        });
      } else {
        toast.success("Inventory uploaded successfully", {
          description: `Created ${data.created} item(s).`,
        });
      }
      // Invalidate all inventory queries (with any clientId or userId) to ensure the list refreshes
      // Using exact: false will match all queries that start with ['inventory']
      await queryClient.invalidateQueries({ 
        queryKey: ['inventory'],
        exact: false
      });
      // Also explicitly refetch to ensure immediate update
      await queryClient.refetchQueries({ 
        queryKey: ['inventory'],
        exact: false
      });
    },
    onError: (error) => {
      toast.error("Failed to upload inventory", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
}

export function useSyncInventory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (clientId?: string | null) => inventoryService.syncInventory(clientId || undefined),
    onSuccess: (data) => {
      toast.success("Inventory synced successfully", {
        description: `Synced ${data.synced} items (${data.created} created, ${data.updated} updated)`,
      });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => {
      toast.error("Failed to sync inventory", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
}
