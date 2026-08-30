export type PrivyUserEventType =
  | "user.created"
  | "user.updated"
  | "user.linked_account.created"
  | "user.wallet.created";

export interface PrivyLinkedAccount {
  type: string;
  address?: string;
  email?: string;
  chain_type?: string;
}

export interface PrivyUserEventData {
  id: string; // did:privy:xxx
  linked_accounts?: PrivyLinkedAccount[];
  wallet?: {
    address: string;
    chain_type?: string;
  };
  email?: {
    address: string;
  };
}

export interface PrivyWebhookEvent {
  type: PrivyUserEventType | string;
  user: PrivyUserEventData;
}

export interface PrivyWebhookResponse {
  received: true;
  event: string;
}
