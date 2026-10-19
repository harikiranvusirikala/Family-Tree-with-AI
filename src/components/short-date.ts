/** "19 Oct 2026". Formatted on the server, in UTC, so the browser shows exactly what was rendered. */
export const shortDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
