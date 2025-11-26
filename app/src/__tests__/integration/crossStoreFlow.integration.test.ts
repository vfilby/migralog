/**
 * Integration Test: Cross-Store Workflows
 * 
 * Tests workflows that span multiple stores:
 * - Episode with linked medication doses
 * - Deleting episode cascades to linked data
 * - Medication usage during episodes
 */

import { useMedicationStore } from '../../store/medicationStore';
import { useEpisodeStore } from '../../store/episodeStore';
import { medicationRepository, medicationDoseRepository } from '../../database/medicationRepository';
import { episodeRepository } from '../../database/episodeRepository';
import { MedicationType, Medication, Episode, MedicationDose, PainLocation, PainQuality, Symptom, Trigger } from '../../models/types';

// Mock repositories
jest.mock('../../database/medicationRepository');
jest.mock('../../database/episodeRepository');

describe('Integration: Cross-Store Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear cache to prevent data bleed between tests
    const { cacheManager } = require('../../utils/cacheManager');
    cacheManager.clear();
    
    // Reset both stores
    useMedicationStore.setState({
      medications: [],
      preventativeMedications: [],
      rescueMedications: [],
      otherMedications: [],
      schedules: [],
      doses: [],
      loading: false,
      error: null,
    });

    useEpisodeStore.setState({
      currentEpisode: null,
      episodes: [],
      loading: false,
      error: null,
    });
  });

  it('should link medication doses to episodes', async () => {
    const medStore = useMedicationStore.getState();
    const epStore = useEpisodeStore.getState();

    const mockMedication: Medication = {
      id: 'med-1',
      name: 'Sumatriptan',
      type: 'rescue',
      dosageAmount: 100,
      dosageUnit: 'mg',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockEpisode: Episode = {
      id: 'episode-1',
      startTime: Date.now() - 3600000,
      endTime: undefined,
      locations: ['left_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: ['nausea'] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    };

    const timestamp = Date.now();
    const mockDose: MedicationDose = {
      id: 'dose-1',
      medicationId: 'med-1',
      episodeId: 'episode-1',
      timestamp,
      quantity: 1,
      dosageAmount: 100,
      dosageUnit: 'mg',
      status: 'taken',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Setup mocks
    (medicationRepository.create as jest.Mock).mockResolvedValue(mockMedication);
    (medicationRepository.getActive as jest.Mock).mockResolvedValue([mockMedication]);
    (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());
    
    (episodeRepository.create as jest.Mock).mockResolvedValue(mockEpisode);
    (episodeRepository.getCurrentEpisode as jest.Mock).mockResolvedValue(mockEpisode);
    (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockResolvedValue(mockEpisode);
    
    (medicationDoseRepository.create as jest.Mock).mockResolvedValue(mockDose);
    (medicationDoseRepository.getAll as jest.Mock).mockResolvedValue([mockDose]);
    (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([mockDose]);

    // Workflow: Start episode -> Add medication -> Log dose linked to episode

    // Step 1: Create medication
    const medication = await medStore.addMedication({
      name: 'Sumatriptan',
      type: 'rescue' as MedicationType,
      dosageAmount: 100,
      dosageUnit: 'mg',
      active: true,
    });

    expect(medication.id).toBe('med-1');

    // Step 2: Start episode
    const episode = await epStore.startEpisode({
      startTime: Date.now() - 3600000,
      locations: ['left_temple'] as PainLocation[],
      qualities: ['throbbing'] as PainQuality[],
      symptoms: ['nausea'] as Symptom[],
      triggers: [] as Trigger[],
    });

    expect(episode.id).toBe('episode-1');

    // Step 3: Log dose during episode (episodeId will be auto-linked via findEpisodeByTimestamp)
    const dose = await medStore.logDose({
      medicationId: medication.id,
      timestamp,
      quantity: 1,
      dosageAmount: 100,
      dosageUnit: 'mg',
      updatedAt: timestamp,
    });

    // Verify that findEpisodeByTimestamp was called to link the dose
    expect(episodeRepository.findEpisodeByTimestamp).toHaveBeenCalledWith(timestamp);
    expect(dose.episodeId).toBe('episode-1');

    // Step 4: Load recent doses
    await medStore.loadRecentDoses();

    const medState = useMedicationStore.getState();
    expect(medState.doses).toHaveLength(1);
    expect(medState.doses[0].episodeId).toBe('episode-1');
    expect(medState.doses[0].medicationId).toBe('med-1');
  });

  it('should maintain referential integrity when deleting episodes', async () => {
    const medStore = useMedicationStore.getState();
    const epStore = useEpisodeStore.getState();

    const medication: Medication = {
      id: 'med-1',
      name: 'Ibuprofen',
      type: 'rescue',
      dosageAmount: 200,
      dosageUnit: 'mg',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const episode: Episode = {
      id: 'episode-1',
      startTime: Date.now() - 7200000,
      endTime: Date.now() - 3600000,
      locations: ['right_temple'] as PainLocation[],
      qualities: ['sharp'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now() - 3600000,
    };

    const linkedDose: MedicationDose = {
      id: 'dose-1',
      medicationId: 'med-1',
      episodeId: 'episode-1',
      timestamp: Date.now() - 5400000,
      quantity: 2,
      dosageAmount: 200,
      dosageUnit: 'mg',
      status: 'taken',
      createdAt: Date.now() - 5400000,
      updatedAt: Date.now() - 5400000,
    };

    const unlinkedDose: MedicationDose = {
      id: 'dose-2',
      medicationId: 'med-1',
      episodeId: undefined,
      timestamp: Date.now() - 86400000, // 1 day ago
      quantity: 1,
      dosageAmount: 200,
      dosageUnit: 'mg',
      status: 'taken',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
    };

    // Setup mocks
    (medicationRepository.getActive as jest.Mock).mockResolvedValue([medication]);
    (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());
    
    // Mock episode repository for initial load and after delete
    (episodeRepository.getAll as jest.Mock)
      .mockResolvedValueOnce([episode])  // Initial load
      .mockResolvedValueOnce([]);         // After delete

    (episodeRepository.delete as jest.Mock).mockResolvedValue(undefined);

    // Mock dose repository: Before delete returns both doses, after delete only unlinked dose
    // Note: In real DB, CASCADE delete would remove linked dose automatically
    (medicationDoseRepository.getByMedicationId as jest.Mock)
      .mockResolvedValueOnce([linkedDose, unlinkedDose])  // Initial load for med-1
      .mockResolvedValueOnce([unlinkedDose]);              // After cascade delete for med-1

    // Load medications first (required for loadRecentDoses)
    await medStore.loadMedications();

    // Load initial state
    await epStore.loadEpisodes();
    await medStore.loadRecentDoses();

    expect(useEpisodeStore.getState().episodes).toHaveLength(1);
    expect(useMedicationStore.getState().doses).toHaveLength(2);

    // Delete episode - in real DB, CASCADE constraint deletes linked doses automatically
    await epStore.deleteEpisode('episode-1');

    // Reload both stores to see the cascade effect
    await epStore.loadEpisodes();
    await medStore.loadRecentDoses();

    const epState = useEpisodeStore.getState();
    const medState = useMedicationStore.getState();

    // Episode should be deleted
    expect(epState.episodes).toHaveLength(0);

    // Only unlinked dose should remain (linked dose was cascade deleted)
    expect(medState.doses).toHaveLength(1);
    expect(medState.doses[0].id).toBe('dose-2');
    expect(medState.doses[0].episodeId).toBeUndefined();
  });

  it('should handle medication logging during active episode', async () => {
    const medStore = useMedicationStore.getState();
    const epStore = useEpisodeStore.getState();

    const medication: Medication = {
      id: 'med-1',
      name: 'Aspirin',
      type: 'rescue',
      dosageAmount: 325,
      dosageUnit: 'mg',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const activeEpisode: Episode = {
      id: 'episode-active',
      startTime: Date.now() - 1800000, // 30 minutes ago
      endTime: undefined,
      locations: ['left_eye'] as PainLocation[],
      qualities: ['pressure'] as PainQuality[],
      symptoms: [] as Symptom[],
      triggers: [] as Trigger[],
      createdAt: Date.now() - 1800000,
      updatedAt: Date.now() - 1800000,
    };

    // Setup mocks
    (medicationRepository.getAll as jest.Mock).mockImplementation(
      async (_db?: any) => [medication]
    );
    (medicationDoseRepository.getMedicationUsageCounts as jest.Mock).mockResolvedValue(new Map());
    (medicationDoseRepository.getByMedicationId as jest.Mock).mockResolvedValue([]);
    (episodeRepository.getCurrentEpisode as jest.Mock).mockImplementation(
      async (_db?: any) => activeEpisode
    );
    (episodeRepository.findEpisodeByTimestamp as jest.Mock).mockImplementation(
      async (_timestamp: number, _db?: any) => activeEpisode
    );

    // Load current episode
    await epStore.loadCurrentEpisode();
    expect(useEpisodeStore.getState().currentEpisode?.id).toBe('episode-active');

    // Log dose - should auto-link to active episode
    const doseTime = Date.now();
    const linkedDose: MedicationDose = {
      id: 'dose-1',
      medicationId: 'med-1',
      episodeId: 'episode-active', // Auto-linked by store
      timestamp: doseTime,
      quantity: 2,
      dosageAmount: 325,
      dosageUnit: 'mg',
      createdAt: doseTime,
      updatedAt: doseTime,
    };

    (medicationDoseRepository.create as jest.Mock).mockResolvedValue(linkedDose);
    (medicationDoseRepository.getAll as jest.Mock).mockImplementation(
      async (_limit?: number, _db?: any) => [linkedDose]
    );
    (medicationDoseRepository.getByMedicationId as jest.Mock).mockImplementation(
      async (medicationId: string, _limit?: number, _db?: any) => 
        medicationId === 'med-1' ? [linkedDose] : []
    );

    const dose = await medStore.logDose({
      medicationId: medication.id,
      timestamp: doseTime,
      quantity: 2,
      dosageAmount: 325,
      dosageUnit: 'mg',
      updatedAt: doseTime,
    });

    // Dose should be linked to active episode
    expect(dose.episodeId).toBe('episode-active');
  });
});
