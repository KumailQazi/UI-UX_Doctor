export interface SessionData {
  userContext?: {
    viewport?: {
      width?: number;
      height?: number;
    };
  };
  events?: Array<{
    eventType?: string;
    timestampSec?: number;
    x?: number;
    y?: number;
    result?: string;
    target?: string;
  }>;
}
