import "server-only";
import { parseWebEnvironment } from "@/config/environment";

export function getWebEnvironment() {
  return parseWebEnvironment(process.env);
}
