// Custom hooks for grading
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { gradingService } from '@/services/grading.service';
import type { GradingRecord } from '@/mocks/mock-entities';

export function useGradingRecords(bookingId?: string) {
  return useQuery({
    queryKey: ['grading', bookingId],
    queryFn: () => gradingService.getGradingRecords(bookingId),
  });
}

export function useCreateGradingRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      bookingId: string;
      assetId: string;
      assetCategory: string;
      grade: GradingRecord['grade'];
      gradedBy: string;
      condition?: string;
      notes?: string;
      quantity?: number;
      serialNumbers?: string[];
      imeiNumbers?: string[];
    }) => gradingService.createGradingRecord(
      data.bookingId,
      data.assetId,
      data.assetCategory,
      data.grade,
      data.gradedBy,
      data.condition,
      data.notes,
      data.quantity,
      data.serialNumbers,
      data.imeiNumbers
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useCalculateResaleValue(category?: string, grade?: GradingRecord['grade'], quantity?: number) {
  return useQuery({
    queryKey: ['calculateResaleValue', category, grade, quantity],
    queryFn: () => {
      if (!category || !grade || !quantity) return 0;
      return gradingService.calculateResaleValue(category, grade, quantity);
    },
    enabled: !!category && !!grade && !!quantity && quantity > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useCalculateResaleValueFn() {
  return async (category: string, grade: GradingRecord['grade'], quantity: number) => {
    return gradingService.calculateResaleValue(category, grade, quantity);
  };
}

