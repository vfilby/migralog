import { create } from 'zustand';
import { Medication, MedicationDose } from '../models/types';
import { medicationRepository, medicationDoseRepository } from '../database/medicationRepository';

interface MedicationState {
  medications: Medication[];
  preventativeMedications: Medication[];
  rescueMedications: Medication[];
  loading: boolean;
  error: string | null;

  // Actions
  loadMedications: () => Promise<void>;
  addMedication: (medication: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Medication>;
  updateMedication: (id: string, updates: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  logDose: (dose: Omit<MedicationDose, 'id' | 'createdAt'>) => Promise<MedicationDose>;
  updateDose: (id: string, updates: Partial<MedicationDose>) => Promise<void>;
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  preventativeMedications: [],
  rescueMedications: [],
  loading: false,
  error: null,

  loadMedications: async () => {
    set({ loading: true, error: null });
    try {
      const medications = await medicationRepository.getActive();
      const preventativeMedications = medications.filter(m => m.type === 'preventative');
      const rescueMedications = medications.filter(m => m.type === 'rescue');

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        loading: false
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  addMedication: async (medication) => {
    set({ loading: true, error: null });
    try {
      const newMedication = await medicationRepository.create(medication);

      const medications = [...get().medications, newMedication];
      const preventativeMedications = medication.type === 'preventative'
        ? [...get().preventativeMedications, newMedication]
        : get().preventativeMedications;
      const rescueMedications = medication.type === 'rescue'
        ? [...get().rescueMedications, newMedication]
        : get().rescueMedications;

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        loading: false
      });

      return newMedication;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateMedication: async (id, updates) => {
    try {
      await medicationRepository.update(id, updates);

      const medications = get().medications.map(m =>
        m.id === id ? { ...m, ...updates } : m
      );
      const preventativeMedications = get().preventativeMedications.map(m =>
        m.id === id ? { ...m, ...updates } : m
      );
      const rescueMedications = get().rescueMedications.map(m =>
        m.id === id ? { ...m, ...updates } : m
      );

      set({
        medications,
        preventativeMedications,
        rescueMedications
      });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteMedication: async (id) => {
    set({ loading: true, error: null });
    try {
      await medicationRepository.delete(id);

      const medications = get().medications.filter(m => m.id !== id);
      const preventativeMedications = get().preventativeMedications.filter(m => m.id !== id);
      const rescueMedications = get().rescueMedications.filter(m => m.id !== id);

      set({
        medications,
        preventativeMedications,
        rescueMedications,
        loading: false
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  logDose: async (dose) => {
    set({ loading: true, error: null });
    try {
      const newDose = await medicationDoseRepository.create(dose);
      set({ loading: false });
      return newDose;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateDose: async (id, updates) => {
    try {
      await medicationDoseRepository.update(id, updates);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },
}));
