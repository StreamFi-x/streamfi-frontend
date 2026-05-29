declare module "@transak/transak-sdk" {
  export class Transak {
    static EVENTS: Record<string, string>;
    static on(event: string, callback: (payload: unknown) => void): void;
    constructor(config: unknown);
    init(): void;
    cleanup(): void;
  }
}
