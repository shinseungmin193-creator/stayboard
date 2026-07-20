export type ActionResult<T = undefined> =
  | { success: true; data?: T; message?: string }
  | { success: false; message: string; fieldErrors?: Record<string, string[]> };

export const INITIAL_ACTION_RESULT: ActionResult = { success: true };
