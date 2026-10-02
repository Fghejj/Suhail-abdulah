// Compatibility entry point for imports using the lowercase service path.
// The implementation lives in ScreenControlService.ts to keep one source of truth.
export { ScreenControlService, screenControlService } from "./ScreenControlService";
export type { ConnectionType, ControlResult, PowerStatus, ScreenDevice, ScreenType } from "./ScreenControlService";
