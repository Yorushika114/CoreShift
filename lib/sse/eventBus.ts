const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

export const eventBus = {
  addClient(ctrl: ReadableStreamDefaultController<Uint8Array>) {
    clients.add(ctrl);
  },
  removeClient(ctrl: ReadableStreamDefaultController<Uint8Array>) {
    clients.delete(ctrl);
  },
  broadcast(type: string) {
    const msg = encoder.encode(`data: ${type}\n\n`);
    for (const ctrl of [...clients]) {
      try {
        ctrl.enqueue(msg);
      } catch {
        clients.delete(ctrl);
      }
    }
  },
};
