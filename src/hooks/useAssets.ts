// Custom hook for fetching assets
import { useQuery } from '@tanstack/react-query';
import { assetsService } from '@/services/assets.service';
import type { AssetCategory } from '@/types/jobs';

export function useAssetCategories() {
  return useQuery({
    queryKey: ['assetCategories'],
    queryFn: () => assetsService.getAssetCategories(),
    // Categories can be updated by backend scripts; refresh when screens remount.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useAssetCategory(id: string | undefined) {
  return useQuery({
    queryKey: ['assetCategory', id],
    queryFn: () => id ? assetsService.getAssetCategory(id) : null,
    enabled: !!id,
    staleTime: Infinity,
  });
}

