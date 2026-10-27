interface OrderErrorLike {
  message?: string;
  responseBody?: { error?: { message?: string } };
}

/**
 * The server's own explanation of why an order could not be saved, falling back to the generic
 * fetch error ("Server responded with 500 ...") when the response carried none.
 */
export function getOrderErrorMessage(error: unknown): string | undefined {
  const err = error as OrderErrorLike | undefined;
  return err?.responseBody?.error?.message || err?.message;
}

/** Whether saving failed because the order was already renewed or revised once; the server allows one follow-up. */
export function isOrderAlreadyFollowedUpError(error: unknown): boolean {
  return /Order\.cannot\.have\.more\.than\.one|cannot have more than one/i.test(getOrderErrorMessage(error) ?? '');
}

/** Whether saving failed because the order was already revised, discontinued, expired or voided. */
export function isOrderAlreadyStoppedError(error: unknown): boolean {
  return /already stopped, expired or voided/i.test(getOrderErrorMessage(error) ?? '');
}
