import "server-only";

import { resolveDevelopmentAccessContext } from "../domain/development-access-policy";

export { resolveDevelopmentAccessContext } from "../domain/development-access-policy";

export async function getDevelopmentAccessContext() {
  return resolveDevelopmentAccessContext(process.env);
}
