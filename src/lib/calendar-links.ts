/**
 * Calendar Link Generation Utilities
 * Generates links/content for Google Calendar, Outlook Web, and ICS files
 */

export interface MeetingDetails {
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
}

/**
 * Format date to Google Calendar format (YYYYMMDDTHHmmssZ)
 */
function formatDateForGoogle(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Format date to Outlook format (ISO 8601)
 */
function formatDateForOutlook(date: Date): string {
  return date.toISOString();
}

/**
 * Format date for ICS file (YYYYMMDDTHHmmssZ)
 */
function formatDateForICS(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Generate a UUID v4 for ICS event
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Escape special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generate Google Calendar link
 * @param meeting - Meeting details
 * @returns Google Calendar URL
 */
export function generateGoogleCalendarLink(meeting: MeetingDetails): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${formatDateForGoogle(meeting.startTime)}/${formatDateForGoogle(meeting.endTime)}`,
    details: meeting.description,
    location: meeting.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook Web Calendar link
 * @param meeting - Meeting details
 * @returns Outlook Web Calendar URL
 */
export function generateOutlookWebLink(meeting: MeetingDetails): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: meeting.title,
    startdt: formatDateForOutlook(meeting.startTime),
    enddt: formatDateForOutlook(meeting.endTime),
    body: meeting.description,
    location: meeting.location,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Generate ICS file content
 * @param meeting - Meeting details
 * @returns ICS file content as string
 */
export function generateICSContent(meeting: MeetingDetails): string {
  const uid = generateUUID();
  const now = new Date();

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Just Wills//Meeting Invitation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}@justwills.ae`,
    `DTSTAMP:${formatDateForICS(now)}`,
    `DTSTART:${formatDateForICS(meeting.startTime)}`,
    `DTEND:${formatDateForICS(meeting.endTime)}`,
    `SUMMARY:${escapeICS(meeting.title)}`,
    `DESCRIPTION:${escapeICS(meeting.description)}`,
    `LOCATION:${escapeICS(meeting.location)}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Convert ICS content to base64 for email attachment
 * @param icsContent - ICS file content
 * @returns Base64 encoded string
 */
export function icsToBase64(icsContent: string): string {
  return Buffer.from(icsContent, "utf-8").toString("base64");
}
