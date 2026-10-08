// "Updated today, 10:25 AM" for a board made today in the org's zone,
// otherwise "Updated Fri 9 Oct, 10:25 AM". Computed in the browser
// (UpdatedLabel), because the page is cached for up to an hour and
// "today" moves on without it.
import { formatBoardDay, formatBoardTime, isSameOrgDay } from "@/lib/format";

export function updatedLabel(
  createdAt: Date,
  now: Date,
  timeZone: string,
): string {
  const time = formatBoardTime(createdAt, timeZone);
  return isSameOrgDay(createdAt, now, timeZone)
    ? `Updated today, ${time}`
    : `Updated ${formatBoardDay(createdAt, now, timeZone)}, ${time}`;
}
