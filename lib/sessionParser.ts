import { randomUUID } from "node:crypto";
import type {
  ExtractedFrame,
  ClickEvent,
  ScrollEvent,
  FormEvent,
  ErrorEvent,
  ViewportInfo,
} from "./issueRegistry";

/**
 * Session Parser
 * Multi-format ingestion for session data from various analytics tools
 *
 * Supported formats:
 * - Hotjar exports (JSON)
 * - Microsoft Clarity exports (JSON)
 * - LogRocket exports (JSON)
 * - FullStory exports (JSON)
 * - Raw JSON from custom instrumentation
 * - MP4 recordings (metadata only in MVP)
 * - MHTML snapshots (basic parsing in MVP)
 */

export interface ParsedSession {
  sessionId: string;
  source: string;
  timestamp: string;
  viewport: ViewportInfo;
  frames: ExtractedFrame[];
  clicks: ClickEvent[];
  scrolls: ScrollEvent[];
  forms: FormEvent[];
  errors: ErrorEvent[];
  metadata: {
    userAgent?: string;
    url?: string;
    referrer?: string;
    duration: number;
    pageCount: number;
  };
}

// Hotjar format parser
interface HotjarEvent {
  time: number;
  type: "click" | "scroll" | "move" | "resize" | "form";
  data?: {
    x?: number;
    y?: number;
    element?: string;
    text?: string;
    scrollY?: number;
    deltaY?: number;
  };
}

interface HotjarSession {
  id: string;
  created: string;
  user_agent?: string;
  url?: string;
  referrer?: string;
  viewport?: { width: number; height: number };
  events: HotjarEvent[];
}

/**
 * Parse Hotjar session export
 */
export function parseHotjarSession(data: HotjarSession): ParsedSession {
  const frames: ExtractedFrame[] = [];
  const clicks: ClickEvent[] = [];
  const scrolls: ScrollEvent[] = [];

  for (const event of data.events) {
    const timestampSec = Math.floor(event.time / 1000);

    switch (event.type) {
      case "click":
        clicks.push({
          timestampSec,
          x: event.data?.x ?? 0,
          y: event.data?.y ?? 0,
          element: event.data?.element,
          targetText: event.data?.text,
        });
        break;
      case "scroll":
        scrolls.push({
          timestampSec,
          scrollY: event.data?.scrollY ?? 0,
          deltaY: event.data?.deltaY ?? 0,
          velocity: Math.abs(event.data?.deltaY ?? 0),
        });
        break;
      case "resize":
        frames.push({
          timestampSec,
          frameRef: `viewport-${data.viewport?.width}x${data.viewport?.height}`,
          viewport: data.viewport,
        });
        break;
    }
  }

  const duration =
    data.events.length > 0
      ? data.events[data.events.length - 1].time - data.events[0].time
      : 0;

  return {
    sessionId: data.id,
    source: "hotjar",
    timestamp: data.created,
    viewport: {
      width: data.viewport?.width ?? 1920,
      height: data.viewport?.height ?? 1080,
      deviceType: inferDeviceType(data.viewport?.width ?? 1920),
    },
    frames,
    clicks,
    scrolls,
    forms: [],
    errors: [],
    metadata: {
      userAgent: data.user_agent,
      url: data.url,
      referrer: data.referrer,
      duration,
      pageCount: 1,
    },
  };
}

// Microsoft Clarity format parser
interface ClarityEvent {
  time: number;
  type: number; // Clarity uses numeric event types
  data?: Record<string, unknown>;
}

interface ClaritySession {
  sessionId: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
  viewport?: { width: number; height: number };
  events: ClarityEvent[];
}

// Clarity event type mappings
const CLARITY_EVENT_TYPES: Record<number, string> = {
  0: "discover",
  1: "scroll",
  2: "click",
  3: "resize",
  4: "input",
  5: "visibility",
};

/**
 * Parse Microsoft Clarity session export
 */
export function parseClaritySession(data: ClaritySession): ParsedSession {
  const frames: ExtractedFrame[] = [];
  const clicks: ClickEvent[] = [];
  const scrolls: ScrollEvent[] = [];
  const forms: FormEvent[] = [];

  for (const event of data.events) {
    const timestampSec = Math.floor(event.time / 1000);
    const eventType = CLARITY_EVENT_TYPES[event.type];

    switch (eventType) {
      case "click":
        clicks.push({
          timestampSec,
          x: (event.data?.x as number) ?? 0,
          y: (event.data?.y as number) ?? 0,
          element: event.data?.target as string,
        });
        break;
      case "scroll":
        scrolls.push({
          timestampSec,
          scrollY: (event.data?.y as number) ?? 0,
          deltaY: (event.data?.delta as number) ?? 0,
          velocity: Math.abs((event.data?.delta as number) ?? 0),
        });
        break;
      case "input":
        forms.push({
          timestampSec,
          fieldName: (event.data?.target as string) ?? "unknown",
          action: "change",
          value: event.data?.value as string,
        });
        break;
      case "resize":
        frames.push({
          timestampSec,
          frameRef: `viewport-${data.viewport?.width}x${data.viewport?.height}`,
          viewport: data.viewport,
        });
        break;
    }
  }

  const duration =
    data.events.length > 0
      ? data.events[data.events.length - 1].time - data.events[0].time
      : 0;

  return {
    sessionId: data.sessionId,
    source: "clarity",
    timestamp: data.timestamp,
    viewport: {
      width: data.viewport?.width ?? 1920,
      height: data.viewport?.height ?? 1080,
      deviceType: inferDeviceType(data.viewport?.width ?? 1920),
    },
    frames,
    clicks,
    scrolls,
    forms,
    errors: [],
    metadata: {
      userAgent: data.userAgent,
      url: data.url,
      duration,
      pageCount: 1,
    },
  };
}

// LogRocket format parser
interface LogRocketEvent {
  timestamp: number;
  type: string;
  data?: Record<string, unknown>;
}

interface LogRocketSession {
  sessionURL: string;
  userId?: string;
  startTime: string;
  endTime: string;
  events: LogRocketEvent[];
}

/**
 * Parse LogRocket session export
 */
export function parseLogRocketSession(data: LogRocketSession): ParsedSession {
  const frames: ExtractedFrame[] = [];
  const clicks: ClickEvent[] = [];
  const scrolls: ScrollEvent[] = [];
  const errors: ErrorEvent[] = [];

  for (const event of data.events) {
    const timestampSec = Math.floor(event.timestamp / 1000);

    switch (event.type) {
      case "click":
        clicks.push({
          timestampSec,
          x: (event.data?.x as number) ?? 0,
          y: (event.data?.y as number) ?? 0,
          element: event.data?.selector as string,
        });
        break;
      case "scroll":
        scrolls.push({
          timestampSec,
          scrollY: (event.data?.scrollY as number) ?? 0,
          deltaY: (event.data?.deltaY as number) ?? 0,
          velocity: Math.abs((event.data?.deltaY as number) ?? 0),
        });
        break;
      case "error":
        errors.push({
          timestampSec,
          message: (event.data?.message as string) ?? "Unknown error",
          type: "client",
        });
        break;
      case "navigation":
        frames.push({
          timestampSec,
          frameRef: (event.data?.url as string) ?? "unknown",
        });
        break;
    }
  }

  const startTimestamp = new Date(data.startTime).getTime();
  const endTimestamp = new Date(data.endTime).getTime();
  const duration = endTimestamp - startTimestamp;

  return {
    sessionId: randomUUID(), // LogRocket doesn't expose session IDs in exports
    source: "logrocket",
    timestamp: data.startTime,
    viewport: {
      width: 1920, // Would need to extract from events
      height: 1080,
      deviceType: "desktop",
    },
    frames,
    clicks,
    scrolls,
    forms: [],
    errors,
    metadata: {
      url: data.sessionURL,
      duration,
      pageCount: frames.length,
    },
  };
}

// FullStory format parser
interface FullStoryEvent {
  timestamp: number;
  eventType: string;
  data?: Record<string, unknown>;
}

interface FullStorySession {
  sessionId: string;
  createdTime: string;
  userAgent?: string;
  pageUrl?: string;
  viewport?: { width: number; height: number };
  events: FullStoryEvent[];
}

/**
 * Parse FullStory session export
 */
export function parseFullStorySession(data: FullStorySession): ParsedSession {
  const frames: ExtractedFrame[] = [];
  const clicks: ClickEvent[] = [];
  const scrolls: ScrollEvent[] = [];
  const forms: FormEvent[] = [];
  const errors: ErrorEvent[] = [];

  for (const event of data.events) {
    const timestampSec = Math.floor(event.timestamp / 1000);

    switch (event.eventType) {
      case "click":
        clicks.push({
          timestampSec,
          x: (event.data?.clickX as number) ?? 0,
          y: (event.data?.clickY as number) ?? 0,
          element: event.data?.targetSelector as string,
        });
        break;
      case "scroll":
        scrolls.push({
          timestampSec,
          scrollY: (event.data?.scrollY as number) ?? 0,
          deltaY: (event.data?.delta as number) ?? 0,
          velocity: Math.abs((event.data?.delta as number) ?? 0),
        });
        break;
      case "input":
        forms.push({
          timestampSec,
          fieldName: (event.data?.fieldName as string) ?? "unknown",
          action: "change",
          value: event.data?.value as string,
        });
        break;
      case "error":
        errors.push({
          timestampSec,
          message: (event.data?.message as string) ?? "Unknown error",
          type: (event.data?.errorType as ErrorEvent["type"]) ?? "client",
        });
        break;
      case "navigate":
        frames.push({
          timestampSec,
          frameRef: (event.data?.url as string) ?? "unknown",
        });
        break;
    }
  }

  const duration =
    data.events.length > 0
      ? data.events[data.events.length - 1].timestamp -
        data.events[0].timestamp
      : 0;

  return {
    sessionId: data.sessionId,
    source: "fullstory",
    timestamp: data.createdTime,
    viewport: {
      width: data.viewport?.width ?? 1920,
      height: data.viewport?.height ?? 1080,
      deviceType: inferDeviceType(data.viewport?.width ?? 1920),
    },
    frames,
    clicks,
    scrolls,
    forms,
    errors,
    metadata: {
      userAgent: data.userAgent,
      url: data.pageUrl,
      duration,
      pageCount: frames.length,
    },
  };
}

// Generic/custom JSON parser
interface GenericSession {
  sessionId?: string;
  timestamp?: string;
  viewport?: { width: number; height: number };
  events?: Array<{
    time?: number;
    type?: string;
    x?: number;
    y?: number;
    data?: Record<string, unknown>;
  }>;
}

/**
 * Parse generic/custom JSON format
 */
export function parseGenericSession(data: GenericSession): ParsedSession {
  const frames: ExtractedFrame[] = [];
  const clicks: ClickEvent[] = [];
  const scrolls: ScrollEvent[] = [];

  const events = data.events ?? [];
  for (const event of events) {
    const timestampSec = Math.floor((event.time ?? Date.now()) / 1000);

    if (event.type === "click" && event.x !== undefined && event.y !== undefined) {
      clicks.push({
        timestampSec,
        x: event.x,
        y: event.y,
      });
    } else if (event.type === "scroll") {
      scrolls.push({
        timestampSec,
        scrollY: (event.data?.scrollY as number) ?? 0,
        deltaY: (event.data?.deltaY as number) ?? 0,
        velocity: Math.abs((event.data?.deltaY as number) ?? 0),
      });
    } else if (event.type === "frame") {
      frames.push({
        timestampSec,
        frameRef: (event.data?.url as string) ?? "unknown",
      });
    }
  }

  return {
    sessionId: data.sessionId ?? randomUUID(),
    source: "generic",
    timestamp: data.timestamp ?? new Date().toISOString(),
    viewport: {
      width: data.viewport?.width ?? 1920,
      height: data.viewport?.height ?? 1080,
      deviceType: inferDeviceType(data.viewport?.width ?? 1920),
    },
    frames,
    clicks,
    scrolls,
    forms: [],
    errors: [],
    metadata: {
      duration: events.length > 0 ? (events[events.length - 1].time ?? 0) - (events[0].time ?? 0) : 0,
      pageCount: frames.length,
    },
  };
}

/**
 * Infer device type from viewport width
 */
function inferDeviceType(width: number): ViewportInfo["deviceType"] {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Auto-detect format and parse session
 */
export function parseSession(
  data: unknown,
  format?: "hotjar" | "clarity" | "logrocket" | "fullstory" | "generic" | "auto"
): ParsedSession {
  // If format is specified, use it directly
  if (format && format !== "auto") {
    switch (format) {
      case "hotjar":
        return parseHotjarSession(data as HotjarSession);
      case "clarity":
        return parseClaritySession(data as ClaritySession);
      case "logrocket":
        return parseLogRocketSession(data as LogRocketSession);
      case "fullstory":
        return parseFullStorySession(data as FullStorySession);
      case "generic":
        return parseGenericSession(data as GenericSession);
    }
  }

  // Auto-detect format
  const d = data as Record<string, unknown>;

  if (d.events && Array.isArray(d.events)) {
    // Check for Hotjar
    if (d.id && d.user_agent) {
      return parseHotjarSession(data as HotjarSession);
    }
    // Check for Clarity
    if (d.sessionId && d.timestamp) {
      return parseClaritySession(data as ClaritySession);
    }
    // Check for LogRocket
    if (d.sessionURL) {
      return parseLogRocketSession(data as LogRocketSession);
    }
    // Check for FullStory
    if (d.createdTime) {
      return parseFullStorySession(data as FullStorySession);
    }
  }

  // Default to generic
  return parseGenericSession(data as GenericSession);
}

/**
 * Parse multiple sessions from bulk export
 */
export function parseBulkSessions(
  data: unknown[]
): ParsedSession[] {
  return data.map((session) => parseSession(session, "auto"));
}
