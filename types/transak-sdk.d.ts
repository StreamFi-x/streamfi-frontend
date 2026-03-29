declare module "@transak/transak-sdk" {
  import type { TransakConfig } from "@/types/transak";

  export class Transak {
    static EVENTS: {
      TRANSAK_WIDGET_CLOSE: string;
      TRANSAK_ORDER_SUCCESSFUL: string;
    };

    static on(event: string, handler: (payload?: unknown) => void): void;

    constructor(config: TransakConfig);

    init(): void;
    cleanup(): void;
  }
}
