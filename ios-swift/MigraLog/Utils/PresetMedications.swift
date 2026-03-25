import Foundation

struct PresetMedication: Identifiable {
    let id = UUID().uuidString
    let name: String
    let type: MedicationType
    let dosageAmount: Double
    let dosageUnit: String
    let category: MedicationCategory?
    let scheduleFrequency: ScheduleFrequency?
}

enum PresetMedications {
    static let all: [PresetMedication] = [
        // Triptans
        PresetMedication(name: "Sumatriptan", type: .rescue, dosageAmount: 50, dosageUnit: "mg", category: .triptan, scheduleFrequency: nil),
        PresetMedication(name: "Rizatriptan", type: .rescue, dosageAmount: 10, dosageUnit: "mg", category: .triptan, scheduleFrequency: nil),
        PresetMedication(name: "Zolmitriptan", type: .rescue, dosageAmount: 2.5, dosageUnit: "mg", category: .triptan, scheduleFrequency: nil),
        PresetMedication(name: "Eletriptan", type: .rescue, dosageAmount: 40, dosageUnit: "mg", category: .triptan, scheduleFrequency: nil),

        // NSAIDs
        PresetMedication(name: "Ibuprofen", type: .rescue, dosageAmount: 400, dosageUnit: "mg", category: .nsaid, scheduleFrequency: nil),
        PresetMedication(name: "Naproxen", type: .rescue, dosageAmount: 500, dosageUnit: "mg", category: .nsaid, scheduleFrequency: nil),
        PresetMedication(name: "Aspirin", type: .rescue, dosageAmount: 500, dosageUnit: "mg", category: .nsaid, scheduleFrequency: nil),

        // OTC
        PresetMedication(name: "Acetaminophen", type: .rescue, dosageAmount: 500, dosageUnit: "mg", category: .otc, scheduleFrequency: nil),
        PresetMedication(name: "Excedrin Migraine", type: .rescue, dosageAmount: 1, dosageUnit: "tablets", category: .otc, scheduleFrequency: nil),

        // CGRP
        PresetMedication(name: "Ubrelvy (ubrogepant)", type: .rescue, dosageAmount: 50, dosageUnit: "mg", category: .cgrp, scheduleFrequency: nil),
        PresetMedication(name: "Nurtec (rimegepant)", type: .rescue, dosageAmount: 75, dosageUnit: "mg", category: .cgrp, scheduleFrequency: nil),
        PresetMedication(name: "Aimovig (erenumab)", type: .preventative, dosageAmount: 70, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .monthly),
        PresetMedication(name: "Ajovy (fremanezumab)", type: .preventative, dosageAmount: 225, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .monthly),
        PresetMedication(name: "Emgality (galcanezumab)", type: .preventative, dosageAmount: 120, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .monthly),
        PresetMedication(name: "Vyepti (eptinezumab)", type: .preventative, dosageAmount: 100, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .quarterly),

        // Preventive
        PresetMedication(name: "Topiramate", type: .preventative, dosageAmount: 50, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Propranolol", type: .preventative, dosageAmount: 80, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Amitriptyline", type: .preventative, dosageAmount: 25, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Venlafaxine", type: .preventative, dosageAmount: 75, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Valproate", type: .preventative, dosageAmount: 500, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),

        // Supplements
        PresetMedication(name: "Magnesium", type: .preventative, dosageAmount: 400, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
        PresetMedication(name: "Riboflavin (B2)", type: .preventative, dosageAmount: 400, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
        PresetMedication(name: "CoQ10", type: .preventative, dosageAmount: 100, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
    ]

    static func search(_ query: String) -> [PresetMedication] {
        guard !query.isEmpty else { return all }
        let lowered = query.lowercased()
        return all.filter { $0.name.lowercased().contains(lowered) }
    }

    static func getByName(_ name: String) -> PresetMedication? {
        all.first { $0.name.lowercased() == name.lowercased() }
    }

    static func categoryDisplayName(_ category: MedicationCategory) -> String {
        category.displayName
    }
}
