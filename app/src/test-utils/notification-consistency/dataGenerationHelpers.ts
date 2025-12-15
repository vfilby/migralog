/**
 * Data Generation Helpers for Notification-Schedule Consistency Testing
 * 
 * Provides utilities for generating realistic test data, edge cases, and large datasets
 * for comprehensive testing of notification-schedule consistency under various scenarios.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Medication, MedicationSchedule, MedicationType } from '../../models/types';
import { logger } from '../../utils/logger';

export interface TestDataGeneratorOptions {
  medicationCount?: number;
  scheduleCountPerMedication?: number;
  includeEdgeCases?: boolean;
  includeInvalidData?: boolean;
  timeZoneVariation?: boolean;
  dateRange?: { start: Date; end: Date };
}

export interface EdgeCaseScenario {
  type: 'boundary_value' | 'invalid_format' | 'null_value' | 'extreme_value' | 'timezone_edge';
  description: string;
  data: any;
  expectedBehavior: 'reject' | 'handle_gracefully' | 'auto_correct';
}

export interface StressTestDataSet {
  medications: Medication[];
  schedules: MedicationSchedule[];
  totalOperations: number;
  estimatedMemoryUsage: number;
  complexity: 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * Realistic Test Data Factory
 */
export class RealisticDataFactory {
  private static medicationNames = [
    'Sumatriptan', 'Topiramate', 'Propranolol', 'Amitriptyline', 'Rizatriptan',
    'Naratriptan', 'Almotriptan', 'Eletriptan', 'Frovatriptan', 'Zolmitriptan',
    'Metoprolol', 'Timolol', 'Valproate', 'Gabapentin', 'Pregabalin',
    'Venlafaxine', 'Duloxetine', 'Botulinum Toxin', 'Magnesium', 'Riboflavin'
  ];

  private static timeSlots = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '12:00',
    '13:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
  ];

  private static timeZones = [
    'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver',
    'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney',
    'America/Mexico_City', 'America/Toronto'
  ];

  static generateMedication(
    id?: string,
    type: MedicationType = 'preventative',
    customName?: string
  ): Medication {
    const medicationId = id || `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const name = customName || this.medicationNames[Math.floor(Math.random() * this.medicationNames.length)];
    
    const baseTimestamp = Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000); // Within last 30 days

    return {
      id: medicationId,
      name,
      type,
      dosageAmount: this.generateRealisticDosage(type),
      dosageUnit: this.generateDosageUnit(type),
      defaultQuantity: type === 'preventative' ? 1 : Math.floor(Math.random() * 3) + 1,
      active: Math.random() > 0.1, // 90% chance of being active
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000), // Updated within 7 days
    };
  }

  static generateSchedule(
    medicationId: string,
    id?: string,
    timeSlot?: string,
    enabled?: boolean
  ): MedicationSchedule {
    const scheduleId = id || `sched-${medicationId.replace('med-', '')}-${Math.random().toString(36).substr(2, 6)}`;
    const time = timeSlot || this.timeSlots[Math.floor(Math.random() * this.timeSlots.length)];
    const timezone = this.timeZones[Math.floor(Math.random() * this.timeZones.length)];

    return {
      id: scheduleId,
      medicationId,
      time,
      timezone,
      dosage: Math.floor(Math.random() * 3) + 1,
      enabled: enabled !== undefined ? enabled : Math.random() > 0.2, // 80% chance of being enabled
      reminderEnabled: Math.random() > 0.3, // 70% chance of reminders being enabled
      notificationId: enabled !== false ? `notif-${scheduleId}` : undefined,
    };
  }

  private static generateRealisticDosage(type: MedicationType): number {
    switch (type) {
      case 'preventative':
        return [25, 50, 100, 150, 200][Math.floor(Math.random() * 5)];
      case 'rescue':
        return [50, 100, 200][Math.floor(Math.random() * 3)];
      default:
        return [10, 25, 50, 100][Math.floor(Math.random() * 4)];
    }
  }

  private static generateDosageUnit(type: MedicationType): string {
    const units = type === 'preventative' ? ['mg', 'mcg'] : ['mg', 'ml', 'tablet'];
    return units[Math.floor(Math.random() * units.length)];
  }
}

/**
 * Generate comprehensive test dataset with various scenarios
 */
export function generateComprehensiveTestData(options: TestDataGeneratorOptions = {}): {
  medications: Medication[];
  schedules: MedicationSchedule[];
  edgeCases: EdgeCaseScenario[];
  metadata: {
    totalMedications: number;
    totalSchedules: number;
    edgeCaseCount: number;
    generationTime: number;
  };
} {
  const startTime = Date.now();
  const {
    medicationCount = 10,
    scheduleCountPerMedication = 2,
    includeEdgeCases = true,
    includeInvalidData = false,
    timeZoneVariation = true,
  } = options;

  const medications: Medication[] = [];
  const schedules: MedicationSchedule[] = [];
  const edgeCases: EdgeCaseScenario[] = [];

  // Generate medications with realistic distribution
  const typeDistribution: MedicationType[] = [
    ...Array(Math.floor(medicationCount * 0.6)).fill('preventative'),
    ...Array(Math.floor(medicationCount * 0.3)).fill('rescue'),
    ...Array(Math.ceil(medicationCount * 0.1)).fill('other'),
  ];

  for (let i = 0; i < medicationCount; i++) {
    const type = typeDistribution[i] || 'preventative';
    const medication = RealisticDataFactory.generateMedication(
      `med-test-${i.toString().padStart(3, '0')}`,
      type
    );
    medications.push(medication);

    // Generate schedules for this medication
    const scheduleCount = type === 'rescue' ? 
      Math.floor(scheduleCountPerMedication / 2) : // Rescue meds have fewer schedules
      scheduleCountPerMedication + Math.floor(Math.random() * 2); // Slight variation

    for (let j = 0; j < scheduleCount; j++) {
      const schedule = RealisticDataFactory.generateSchedule(
        medication.id,
        `sched-test-${i.toString().padStart(3, '0')}-${j}`,
        undefined,
        type !== 'rescue' || Math.random() > 0.5 // Rescue meds less likely to have enabled schedules
      );

      // Add timezone variation if requested
      if (timeZoneVariation && Math.random() > 0.7) {
        const timeZones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
        schedule.timezone = timeZones[Math.floor(Math.random() * timeZones.length)];
      }

      schedules.push(schedule);
    }
  }

  // Generate edge cases if requested
  if (includeEdgeCases) {
    edgeCases.push(...generateEdgeCases(includeInvalidData));
  }

  const endTime = Date.now();
  
  const result = {
    medications,
    schedules,
    edgeCases,
    metadata: {
      totalMedications: medications.length,
      totalSchedules: schedules.length,
      edgeCaseCount: edgeCases.length,
      generationTime: endTime - startTime,
    },
  };

  logger.debug('[DataGeneration] Comprehensive test data generated', result.metadata);
  return result;
}

/**
 * Generate edge case scenarios for boundary testing
 */
export function generateEdgeCases(includeInvalid: boolean = false): EdgeCaseScenario[] {
  const edgeCases: EdgeCaseScenario[] = [
    // Boundary value edge cases
    {
      type: 'boundary_value',
      description: 'Time at midnight (00:00)',
      data: { time: '00:00' },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'boundary_value',
      description: 'Time at end of day (23:59)',
      data: { time: '23:59' },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'boundary_value',
      description: 'Maximum dosage value',
      data: { dosage: Number.MAX_SAFE_INTEGER },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'boundary_value',
      description: 'Minimum dosage value',
      data: { dosage: 0.001 },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'boundary_value',
      description: 'Very long medication name',
      data: { name: 'A'.repeat(255) },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'boundary_value',
      description: 'Single character medication name',
      data: { name: 'A' },
      expectedBehavior: 'handle_gracefully',
    },

    // Timezone edge cases
    {
      type: 'timezone_edge',
      description: 'Timezone transition (DST)',
      data: { 
        timezone: 'America/New_York',
        time: '02:30', // During DST transition
      },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'timezone_edge',
      description: 'UTC timezone',
      data: { timezone: 'UTC' },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'timezone_edge',
      description: 'Offset timezone format',
      data: { timezone: '+05:30' },
      expectedBehavior: 'handle_gracefully',
    },

    // Extreme value edge cases
    {
      type: 'extreme_value',
      description: 'Very old creation date',
      data: { createdAt: new Date('1900-01-01').getTime() },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'extreme_value',
      description: 'Future creation date',
      data: { createdAt: new Date('2050-01-01').getTime() },
      expectedBehavior: 'handle_gracefully',
    },
    {
      type: 'extreme_value',
      description: 'Negative timestamp',
      data: { createdAt: -1 },
      expectedBehavior: 'handle_gracefully',
    },
  ];

  if (includeInvalid) {
    edgeCases.push(
      // Invalid format edge cases
      {
        type: 'invalid_format',
        description: 'Invalid time format (25:00)',
        data: { time: '25:00' },
        expectedBehavior: 'reject',
      },
      {
        type: 'invalid_format',
        description: 'Invalid time format (12:70)',
        data: { time: '12:70' },
        expectedBehavior: 'reject',
      },
      {
        type: 'invalid_format',
        description: 'Invalid medication ID format',
        data: { id: 'invalid-id-format' },
        expectedBehavior: 'reject',
      },
      {
        type: 'invalid_format',
        description: 'Empty medication name',
        data: { name: '' },
        expectedBehavior: 'reject',
      },

      // Null value edge cases
      {
        type: 'null_value',
        description: 'Null medication ID',
        data: { id: null },
        expectedBehavior: 'reject',
      },
      {
        type: 'null_value',
        description: 'Undefined schedule time',
        data: { time: undefined },
        expectedBehavior: 'reject',
      },
      {
        type: 'null_value',
        description: 'Null timezone',
        data: { timezone: null },
        expectedBehavior: 'auto_correct',
      }
    );
  }

  return edgeCases;
}

/**
 * Generate large dataset for stress testing
 */
export function generateStressTestData(
  complexity: 'low' | 'medium' | 'high' | 'extreme' = 'medium'
): StressTestDataSet {
  const complexityConfigs = {
    low: { medications: 50, schedulesPerMed: 2, variations: false },
    medium: { medications: 200, schedulesPerMed: 3, variations: true },
    high: { medications: 1000, schedulesPerMed: 5, variations: true },
    extreme: { medications: 5000, schedulesPerMed: 8, variations: true },
  };

  const config = complexityConfigs[complexity];
  const startTime = Date.now();

  const { medications, schedules } = generateComprehensiveTestData({
    medicationCount: config.medications,
    scheduleCountPerMedication: config.schedulesPerMed,
    includeEdgeCases: false, // Skip edge cases for stress testing
    timeZoneVariation: config.variations,
  });

  // Add complexity variations for higher stress levels
  if (complexity === 'high' || complexity === 'extreme') {
    // Add medications with many schedules
    for (let i = 0; i < Math.floor(config.medications * 0.1); i++) {
      const complexMed = RealisticDataFactory.generateMedication(
        `med-complex-${i}`,
        'preventative'
      );
      medications.push(complexMed);

      // Add many schedules for this medication
      for (let j = 0; j < 15; j++) {
        schedules.push(RealisticDataFactory.generateSchedule(
          complexMed.id,
          `sched-complex-${i}-${j}`
        ));
      }
    }
  }

  if (complexity === 'extreme') {
    // Add medications with overlapping schedules
    for (let i = 0; i < Math.floor(config.medications * 0.05); i++) {
      const overlapMed = RealisticDataFactory.generateMedication(
        `med-overlap-${i}`,
        'preventative'
      );
      medications.push(overlapMed);

      // Add schedules at same times to test conflict handling
      const conflictTimes = ['08:00', '08:00', '08:01', '12:00', '12:00'];
      conflictTimes.forEach((time, j) => {
        schedules.push(RealisticDataFactory.generateSchedule(
          overlapMed.id,
          `sched-overlap-${i}-${j}`,
          time
        ));
      });
    }
  }

  const totalOperations = medications.length + schedules.length;
  
  // Estimate memory usage (rough calculation)
  const avgMedicationSize = 200; // bytes
  const avgScheduleSize = 150; // bytes
  const estimatedMemoryUsage = (medications.length * avgMedicationSize) + 
                               (schedules.length * avgScheduleSize);

  const generationTime = Date.now() - startTime;

  logger.debug('[DataGeneration] Stress test dataset generated', {
    complexity,
    medications: medications.length,
    schedules: schedules.length,
    totalOperations,
    estimatedMemoryUsage,
    generationTime,
  });

  return {
    medications,
    schedules,
    totalOperations,
    estimatedMemoryUsage,
    complexity,
  };
}

/**
 * Generate time-based test scenarios
 */
export function generateTimeBasedScenarios(): {
  scenarios: Array<{
    name: string;
    description: string;
    medications: Medication[];
    schedules: MedicationSchedule[];
    expectedConflicts: number;
    testFocus: string;
  }>;
} {
  const scenarios = [
    // Same-time conflict scenario
    {
      name: 'same_time_conflict',
      description: 'Multiple medications scheduled at exactly the same time',
      medications: [
        RealisticDataFactory.generateMedication('med-conflict-1', 'preventative'),
        RealisticDataFactory.generateMedication('med-conflict-2', 'preventative'),
        RealisticDataFactory.generateMedication('med-conflict-3', 'preventative'),
      ],
      schedules: [] as MedicationSchedule[],
      expectedConflicts: 3,
      testFocus: 'notification_grouping',
    },

    // Rush hour scenario
    {
      name: 'morning_rush',
      description: 'High concentration of medications in morning hours',
      medications: Array.from({ length: 8 }, (_, i) => 
        RealisticDataFactory.generateMedication(`med-morning-${i}`, 'preventative')
      ),
      schedules: [] as MedicationSchedule[],
      expectedConflicts: 0,
      testFocus: 'peak_load_handling',
    },

    // Midnight boundary scenario
    {
      name: 'midnight_boundary',
      description: 'Schedules around midnight to test day transitions',
      medications: [
        RealisticDataFactory.generateMedication('med-midnight-1', 'preventative'),
        RealisticDataFactory.generateMedication('med-midnight-2', 'preventative'),
      ],
      schedules: [] as MedicationSchedule[],
      expectedConflicts: 0,
      testFocus: 'day_transition',
    },

    // Timezone conflict scenario
    {
      name: 'timezone_conflicts',
      description: 'Same time in different timezones',
      medications: [
        RealisticDataFactory.generateMedication('med-tz-1', 'preventative'),
        RealisticDataFactory.generateMedication('med-tz-2', 'preventative'),
      ],
      schedules: [] as MedicationSchedule[],
      expectedConflicts: 1,
      testFocus: 'timezone_handling',
    },
  ];

  // Generate schedules for each scenario
  scenarios[0].schedules = [
    RealisticDataFactory.generateSchedule('med-conflict-1', 'sched-conflict-1', '08:00'),
    RealisticDataFactory.generateSchedule('med-conflict-2', 'sched-conflict-2', '08:00'),
    RealisticDataFactory.generateSchedule('med-conflict-3', 'sched-conflict-3', '08:00'),
  ];

  scenarios[1].schedules = scenarios[1].medications.map((med, i) => 
    RealisticDataFactory.generateSchedule(
      med.id, 
      `sched-morning-${i}`, 
      `0${7 + Math.floor(i/2)}:${(i % 2) * 30}`.slice(-5) // 07:00, 07:30, 08:00, etc.
    )
  );

  scenarios[2].schedules = [
    RealisticDataFactory.generateSchedule('med-midnight-1', 'sched-midnight-1', '23:59'),
    RealisticDataFactory.generateSchedule('med-midnight-2', 'sched-midnight-2', '00:01'),
  ];

  scenarios[3].schedules = [
    { ...RealisticDataFactory.generateSchedule('med-tz-1', 'sched-tz-1', '08:00'), timezone: 'America/New_York' },
    { ...RealisticDataFactory.generateSchedule('med-tz-2', 'sched-tz-2', '08:00'), timezone: 'America/Los_Angeles' },
  ];

  logger.debug('[DataGeneration] Time-based scenarios generated', {
    scenarioCount: scenarios.length,
    totalMedications: scenarios.reduce((sum, s) => sum + s.medications.length, 0),
    totalSchedules: scenarios.reduce((sum, s) => sum + s.schedules.length, 0),
  });

  return { scenarios };
}

/**
 * Generate invalid data for error handling tests
 */
export function generateInvalidDataScenarios(): {
  invalidMedications: Array<{ data: Partial<Medication>; expectedError: string }>;
  invalidSchedules: Array<{ data: Partial<MedicationSchedule>; expectedError: string }>;
} {
  const invalidMedications = [
    {
      data: { id: '', name: 'Valid Name', type: 'preventative' as MedicationType },
      expectedError: 'Invalid medication ID',
    },
    {
      data: { id: 'med-123', name: '', type: 'preventative' as MedicationType },
      expectedError: 'Invalid medication name',
    },
    {
      data: { id: 'med-123', name: 'Valid Name', type: 'invalid_type' as MedicationType },
      expectedError: 'Invalid medication type',
    },
    {
      data: { id: 'med-123', name: 'Valid Name', type: 'preventative' as MedicationType, dosageAmount: -1 },
      expectedError: 'Invalid dosage amount',
    },
  ];

  const invalidSchedules = [
    {
      data: { id: 'sched-123', medicationId: '', time: '08:00' },
      expectedError: 'Invalid medication ID reference',
    },
    {
      data: { id: 'sched-123', medicationId: 'med-123', time: '25:00' },
      expectedError: 'Invalid time format',
    },
    {
      data: { id: 'sched-123', medicationId: 'med-123', time: '08:70' },
      expectedError: 'Invalid time format',
    },
    {
      data: { id: 'sched-123', medicationId: 'med-123', time: '08:00', timezone: 'Invalid/Timezone' },
      expectedError: 'Invalid timezone',
    },
    {
      data: { id: 'sched-123', medicationId: 'med-123', time: '08:00', dosage: -1 },
      expectedError: 'Invalid dosage',
    },
  ];

  return {
    invalidMedications,
    invalidSchedules,
  };
}

/**
 * Generate realistic medication interaction scenarios
 */
export function generateMedicationInteractionScenarios(): {
  scenarios: Array<{
    name: string;
    description: string;
    medications: Medication[];
    schedules: MedicationSchedule[];
    interactions: Array<{
      type: 'timing_conflict' | 'dosage_concern' | 'drug_interaction';
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }>;
} {
  return {
    scenarios: [
      {
        name: 'triptans_interaction',
        description: 'Multiple triptan medications with timing restrictions',
        medications: [
          RealisticDataFactory.generateMedication('med-sumatriptan', 'rescue', 'Sumatriptan'),
          RealisticDataFactory.generateMedication('med-rizatriptan', 'rescue', 'Rizatriptan'),
        ],
        schedules: [
          RealisticDataFactory.generateSchedule('med-sumatriptan', 'sched-sumatriptan', '08:00'),
          RealisticDataFactory.generateSchedule('med-rizatriptan', 'sched-rizatriptan', '10:00'),
        ],
        interactions: [
          {
            type: 'timing_conflict',
            description: 'Triptans should not be taken within 24 hours of each other',
            severity: 'high',
          },
          {
            type: 'drug_interaction',
            description: 'Multiple triptans increase serotonin syndrome risk',
            severity: 'medium',
          },
        ],
      },
      {
        name: 'preventative_overload',
        description: 'Multiple preventative medications at similar times',
        medications: [
          RealisticDataFactory.generateMedication('med-topiramate', 'preventative', 'Topiramate'),
          RealisticDataFactory.generateMedication('med-propranolol', 'preventative', 'Propranolol'),
          RealisticDataFactory.generateMedication('med-amitriptyline', 'preventative', 'Amitriptyline'),
        ],
        schedules: [
          RealisticDataFactory.generateSchedule('med-topiramate', 'sched-topiramate-morning', '08:00'),
          RealisticDataFactory.generateSchedule('med-topiramate', 'sched-topiramate-evening', '20:00'),
          RealisticDataFactory.generateSchedule('med-propranolol', 'sched-propranolol-morning', '08:30'),
          RealisticDataFactory.generateSchedule('med-propranolol', 'sched-propranolol-evening', '20:30'),
          RealisticDataFactory.generateSchedule('med-amitriptyline', 'sched-amitriptyline', '22:00'),
        ],
        interactions: [
          {
            type: 'timing_conflict',
            description: 'High pill burden in morning and evening',
            severity: 'medium',
          },
          {
            type: 'dosage_concern',
            description: 'Multiple medications may require staggered timing',
            severity: 'low',
          },
        ],
      },
    ],
  };
}

/**
 * Utility for creating custom test data generators
 */
export class CustomDataGenerator {
  private medications: Medication[] = [];
  private schedules: MedicationSchedule[] = [];

  addMedication(medication: Partial<Medication>): this {
    const fullMedication = {
      id: medication.id || `med-custom-${this.medications.length}`,
      name: medication.name || `Custom Med ${this.medications.length}`,
      type: medication.type || 'preventative' as MedicationType,
      dosageAmount: medication.dosageAmount || 50,
      dosageUnit: medication.dosageUnit || 'mg',
      defaultQuantity: medication.defaultQuantity || 1,
      active: medication.active !== undefined ? medication.active : true,
      createdAt: medication.createdAt || Date.now(),
      updatedAt: medication.updatedAt || Date.now(),
    };
    
    this.medications.push(fullMedication);
    return this;
  }

  addSchedule(schedule: Partial<MedicationSchedule>): this {
    if (!schedule.medicationId && this.medications.length === 0) {
      throw new Error('No medications available for schedule. Add medication first.');
    }

    const fullSchedule = {
      id: schedule.id || `sched-custom-${this.schedules.length}`,
      medicationId: schedule.medicationId || this.medications[this.medications.length - 1].id,
      time: schedule.time || '08:00',
      timezone: schedule.timezone || 'America/Los_Angeles',
      dosage: schedule.dosage || 1,
      enabled: schedule.enabled !== undefined ? schedule.enabled : true,
      reminderEnabled: schedule.reminderEnabled !== undefined ? schedule.reminderEnabled : true,
      notificationId: schedule.notificationId,
    };

    this.schedules.push(fullSchedule);
    return this;
  }

  addBulkMedications(count: number, type?: MedicationType): this {
    for (let i = 0; i < count; i++) {
      this.addMedication({
        type: type || (['preventative', 'rescue', 'other'][i % 3] as MedicationType),
      });
    }
    return this;
  }

  addBulkSchedules(count: number, timePattern?: 'distributed' | 'clustered' | 'random'): this {
    if (this.medications.length === 0) {
      throw new Error('No medications available for schedules. Add medications first.');
    }

    const pattern = timePattern || 'random';
    
    for (let i = 0; i < count; i++) {
      let time: string;
      
      switch (pattern) {
        case 'distributed':
          // Evenly distribute across day
          const hour = Math.floor((24 * i) / count);
          time = `${hour.toString().padStart(2, '0')}:00`;
          break;
        case 'clustered':
          // Cluster around common times
          const clusters = ['08:00', '12:00', '20:00'];
          time = clusters[i % clusters.length];
          break;
        case 'random':
        default:
          time = ['08:00', '12:00', '20:00'][Math.floor(Math.random() * 3)];
          break;
      }

      const medicationId = this.medications[i % this.medications.length].id;
      this.addSchedule({ medicationId, time });
    }
    
    return this;
  }

  build(): { medications: Medication[]; schedules: MedicationSchedule[] } {
    const result = {
      medications: [...this.medications],
      schedules: [...this.schedules],
    };

    logger.debug('[DataGeneration] Custom dataset built', {
      medications: result.medications.length,
      schedules: result.schedules.length,
    });

    return result;
  }

  reset(): this {
    this.medications = [];
    this.schedules = [];
    return this;
  }
}