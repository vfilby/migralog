import { create } from 'zustand';
import { CalendarOverlay } from '../models/types';
import { overlayRepository } from '../database/overlayRepository';
import { errorLogger } from '../services/errorLogger';
import { toastService } from '../services/toastService';

interface OverlayState {
  overlays: CalendarOverlay[];
  loading: boolean;
  error: string | null;

  // Actions
  /** Load all overlays - use for backup/export only. For app layer, use loadOverlaysForDateRange */
  getAllForExport: () => Promise<void>;
  loadOverlaysForDateRange: (startDate: string, endDate: string) => Promise<void>;
  getOverlaysForDate: (date: string) => Promise<CalendarOverlay[]>;
  createOverlay: (overlay: Omit<CalendarOverlay, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CalendarOverlay>;
  updateOverlay: (id: string, updates: Partial<CalendarOverlay>) => Promise<void>;
  deleteOverlay: (id: string) => Promise<void>;
  reset: () => void;
}

export const useOverlayStore = create<OverlayState>((set, get) => ({
  overlays: [],
  loading: false,
  error: null,

  /** Load all overlays - use for backup/export only. For app layer, use loadOverlaysForDateRange */
  getAllForExport: async () => {
    set({ loading: true, error: null });
    try {
      const overlays = await overlayRepository.getAll();
      set({ overlays, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load overlays for export', error as Error, {
        operation: 'getAllForExport'
      });
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadOverlaysForDateRange: async (startDate, endDate) => {
    set({ loading: true, error: null });
    try {
      const overlays = await overlayRepository.getDateRange(startDate, endDate);
      set({ overlays, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to load overlays for date range', error as Error, {
        operation: 'loadOverlaysForDateRange',
        startDate,
        endDate
      });
      set({ error: (error as Error).message, loading: false });
    }
  },

  getOverlaysForDate: async (date) => {
    try {
      const overlays = await overlayRepository.getByDate(date);
      return overlays;
    } catch (error) {
      await errorLogger.log('database', 'Failed to get overlays for date', error as Error, {
        operation: 'getOverlaysForDate',
        date
      });
      set({ error: (error as Error).message });
      return [];
    }
  },

  createOverlay: async (overlay) => {
    set({ loading: true, error: null });
    try {
      const newOverlay = await overlayRepository.create(overlay);

      // Update local state - add and sort
      const updatedOverlays = [...get().overlays, newOverlay].sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      );

      set({ overlays: updatedOverlays, loading: false });

      return newOverlay;
    } catch (error) {
      await errorLogger.log('database', 'Failed to create overlay', error as Error, {
        operation: 'createOverlay',
        label: overlay.label
      });
      set({ error: (error as Error).message, loading: false });

      // Show error toast
      toastService.error('Failed to create calendar overlay');

      throw error;
    }
  },

  updateOverlay: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await overlayRepository.update(id, updates);

      // Update local state only after successful database update
      const updatedOverlays = get().overlays.map(overlay =>
        overlay.id === id ? { ...overlay, ...updates, updatedAt: Date.now() } : overlay
      );

      set({ overlays: updatedOverlays, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to update overlay', error as Error, {
        operation: 'updateOverlay',
        id
      });
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteOverlay: async (id) => {
    set({ loading: true, error: null });
    try {
      await overlayRepository.delete(id);

      // Update local state - remove the deleted overlay
      const updatedOverlays = get().overlays.filter(overlay => overlay.id !== id);
      set({ overlays: updatedOverlays, loading: false });
    } catch (error) {
      await errorLogger.log('database', 'Failed to delete overlay', error as Error, {
        operation: 'deleteOverlay',
        id
      });
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  reset: () => {
    set({
      overlays: [],
      loading: false,
      error: null,
    });
  },
}));
