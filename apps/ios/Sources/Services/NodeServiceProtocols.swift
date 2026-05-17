import CoreLocation
import Foundation
import AstroclawKit
import UIKit

typealias AstroclawCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias AstroclawCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: AstroclawCameraSnapParams) async throws -> AstroclawCameraSnapResult
    func clip(params: AstroclawCameraClipParams) async throws -> AstroclawCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: AstroclawLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: AstroclawLocationGetParams,
        desiredAccuracy: AstroclawLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: AstroclawLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> AstroclawDeviceStatusPayload
    func info() -> AstroclawDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: AstroclawPhotosLatestParams) async throws -> AstroclawPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: AstroclawContactsSearchParams) async throws -> AstroclawContactsSearchPayload
    func add(params: AstroclawContactsAddParams) async throws -> AstroclawContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: AstroclawCalendarEventsParams) async throws -> AstroclawCalendarEventsPayload
    func add(params: AstroclawCalendarAddParams) async throws -> AstroclawCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: AstroclawRemindersListParams) async throws -> AstroclawRemindersListPayload
    func add(params: AstroclawRemindersAddParams) async throws -> AstroclawRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: AstroclawMotionActivityParams) async throws -> AstroclawMotionActivityPayload
    func pedometer(params: AstroclawPedometerParams) async throws -> AstroclawPedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: AstroclawWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: AstroclawWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: AstroclawWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: AstroclawWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: AstroclawWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: AstroclawWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
