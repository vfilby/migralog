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
        PresetMedication(name: "Naratriptan", type: .rescue, dosageAmount: 2.5, dosageUnit: "mg", category: .triptan, scheduleFrequency: nil),
        PresetMedication(name: "Frovatriptan", type: .rescue, dosageAmount: 2.5, dosageUnit: "mg", category: .triptan, scheduleFrequency: nil),
        PresetMedication(name: "Almotriptan", type: .rescue, dosageAmount: 12.5, dosageUnit: "mg", category: .triptan, scheduleFrequency: nil),

        // Ditan (acute — 5-HT1F agonist; no dedicated category)
        PresetMedication(name: "Reyvow (lasmiditan)", type: .rescue, dosageAmount: 100, dosageUnit: "mg", category: .other, scheduleFrequency: nil),

        // NSAIDs
        PresetMedication(name: "Ibuprofen", type: .rescue, dosageAmount: 400, dosageUnit: "mg", category: .nsaid, scheduleFrequency: nil),
        PresetMedication(name: "Naproxen", type: .rescue, dosageAmount: 500, dosageUnit: "mg", category: .nsaid, scheduleFrequency: nil),
        PresetMedication(name: "Aspirin", type: .rescue, dosageAmount: 500, dosageUnit: "mg", category: .nsaid, scheduleFrequency: nil),
        PresetMedication(name: "Diclofenac", type: .rescue, dosageAmount: 50, dosageUnit: "mg", category: .nsaid, scheduleFrequency: nil),

        // OTC
        PresetMedication(name: "Acetaminophen", type: .rescue, dosageAmount: 500, dosageUnit: "mg", category: .otc, scheduleFrequency: nil),
        PresetMedication(name: "Excedrin Migraine", type: .rescue, dosageAmount: 1, dosageUnit: "tablets", category: .otc, scheduleFrequency: nil),

        // CGRP
        PresetMedication(name: "Ubrelvy (ubrogepant)", type: .rescue, dosageAmount: 50, dosageUnit: "mg", category: .cgrp, scheduleFrequency: nil),
        PresetMedication(name: "Nurtec (rimegepant)", type: .rescue, dosageAmount: 75, dosageUnit: "mg", category: .cgrp, scheduleFrequency: nil),
        PresetMedication(name: "Qulipta (atogepant)", type: .preventative, dosageAmount: 60, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .daily),
        PresetMedication(name: "Aimovig (erenumab)", type: .preventative, dosageAmount: 70, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .monthly),
        PresetMedication(name: "Ajovy (fremanezumab)", type: .preventative, dosageAmount: 225, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .monthly),
        PresetMedication(name: "Emgality (galcanezumab)", type: .preventative, dosageAmount: 120, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .monthly),
        PresetMedication(name: "Vyepti (eptinezumab)", type: .preventative, dosageAmount: 100, dosageUnit: "mg", category: .cgrp, scheduleFrequency: .quarterly),

        // Botox (chronic-migraine preventive; ~every 12 weeks)
        PresetMedication(name: "Botox (onabotulinumtoxinA)", type: .preventative, dosageAmount: 155, dosageUnit: "units", category: .preventive, scheduleFrequency: .quarterly),

        // Preventive
        PresetMedication(name: "Topiramate", type: .preventative, dosageAmount: 50, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Propranolol", type: .preventative, dosageAmount: 80, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Metoprolol", type: .preventative, dosageAmount: 50, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Amitriptyline", type: .preventative, dosageAmount: 25, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Nortriptyline", type: .preventative, dosageAmount: 25, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Venlafaxine", type: .preventative, dosageAmount: 75, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Valproate", type: .preventative, dosageAmount: 500, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Gabapentin", type: .preventative, dosageAmount: 300, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),
        PresetMedication(name: "Candesartan", type: .preventative, dosageAmount: 8, dosageUnit: "mg", category: .preventive, scheduleFrequency: .daily),

        // Supplements
        PresetMedication(name: "Magnesium", type: .preventative, dosageAmount: 400, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
        PresetMedication(name: "Riboflavin (B2)", type: .preventative, dosageAmount: 400, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
        PresetMedication(name: "CoQ10", type: .preventative, dosageAmount: 100, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
        PresetMedication(name: "Melatonin", type: .preventative, dosageAmount: 3, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
        PresetMedication(name: "Feverfew", type: .preventative, dosageAmount: 100, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
        PresetMedication(name: "Butterbur", type: .preventative, dosageAmount: 75, dosageUnit: "mg", category: .supplement, scheduleFrequency: .daily),
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
