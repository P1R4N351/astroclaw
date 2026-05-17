import Foundation

public enum AstroclawCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum AstroclawCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum AstroclawCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum AstroclawCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct AstroclawCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: AstroclawCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: AstroclawCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: AstroclawCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: AstroclawCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct AstroclawCameraClipParams: Codable, Sendable, Equatable {
    public var facing: AstroclawCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: AstroclawCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: AstroclawCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: AstroclawCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
