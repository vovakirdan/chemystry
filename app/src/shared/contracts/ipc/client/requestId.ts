let clientRequestSequence = 0;

export function nextClientRequestId(): string {
  clientRequestSequence += 1;
  return `req-client-${Date.now().toString(36)}-${clientRequestSequence.toString(36)}`;
}
