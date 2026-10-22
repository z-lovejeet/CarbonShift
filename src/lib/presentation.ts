import { londonTime } from "@/domain/time";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });
export const grams = (mg: number) => number.format(mg / 1000);
export const kwh = (wh: number) => (wh / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
export function londonLabel(utc: string): string {
  const value = londonTime(utc);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }).format(new Date(utc));
  return `${date}, ${value.time} ${value.offset === "+01:00" ? "BST" : "GMT"} (UTC${value.offset})`;
}
export function shortLondon(utc: string): string {
  const local = londonTime(utc);
  return `${local.time} ${local.offset === "+01:00" ? "BST" : "GMT"}`;
}
