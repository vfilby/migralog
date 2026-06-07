import Foundation
import GRDB

/// Encodes a local SQLite row into the opaque JSON `payload` carried by a
/// `SyncRecord`, and decodes it back into column values. Generic over all synced
/// tables — there is no per-table struct — which keeps the payload decoupled from
/// both the CloudKit schema and the app's domain models, so the local schema can
/// evolve freely (see spec/ios/icloud-sync.md).
///
/// HIPAA: the payload contains health data. Callers must never log it.
enum SyncPayloadCodec {

    enum CodecError: Error, Equatable {
        /// A column held a BLOB. No synced table is expected to contain one, so this
        /// signals an unexpected schema rather than a value to silently drop.
        case unsupportedBlob(column: String)
        /// The payload string was not valid UTF-8 / JSON.
        case malformedPayload
    }

    /// A single column value, preserving SQLite's storage class so a round-trip is
    /// lossless for text, integers, and null. (A whole-number REAL may decode back as
    /// an integer; that is harmless because SQLite column affinity coerces on apply.)
    enum Value: Equatable, Codable {
        case text(String)
        case int(Int64)
        case double(Double)
        case null

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if container.decodeNil() {
                self = .null
            } else if let intValue = try? container.decode(Int64.self) {
                self = .int(intValue)
            } else if let doubleValue = try? container.decode(Double.self) {
                self = .double(doubleValue)
            } else {
                self = .text(try container.decode(String.self))
            }
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .text(let value): try container.encode(value)
            case .int(let value): try container.encode(value)
            case .double(let value): try container.encode(value)
            case .null: try container.encodeNil()
            }
        }
    }

    /// Build the `payload` JSON string for a row, excluding the table's device-local
    /// columns. Keys are sorted for deterministic, diff-friendly output.
    static func encodePayload(row: Row, table: SyncableTable) throws -> String {
        var values: [String: Value] = [:]
        for (column, dbValue) in row where !table.deviceLocalColumns.contains(column) {
            values[column] = try value(from: dbValue, column: column)
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(values)
        return String(decoding: data, as: UTF8.self)
    }

    /// Decode a `payload` JSON string back into column values, keyed by column name.
    static func decodePayload(_ payload: String) throws -> [String: Value] {
        guard let data = payload.data(using: .utf8) else {
            throw CodecError.malformedPayload
        }
        do {
            return try JSONDecoder().decode([String: Value].self, from: data)
        } catch {
            throw CodecError.malformedPayload
        }
    }

    private static func value(from dbValue: DatabaseValue, column: String) throws -> Value {
        switch dbValue.storage {
        case .null:
            return .null
        case .int64(let intValue):
            return .int(intValue)
        case .double(let doubleValue):
            return .double(doubleValue)
        case .string(let stringValue):
            return .text(stringValue)
        case .blob:
            throw CodecError.unsupportedBlob(column: column)
        }
    }
}
