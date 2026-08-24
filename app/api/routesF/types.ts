export interface MerchLink {
  label: string;
  url: string;
}

export interface CreatorMerchData {
  merch_links: MerchLink[];
}

export interface PutMerchLinksBody {
  creator_id: string;
  merch_links: any;
}

export type GoalHistory = any;
export type BanRecord = any;
export type ModerationLog = any;
export type GoalRateRequest = any;
export type CSVImportRequest = any;
export type LogModerationRequest = any;
export type GetModerationLogsRequest = any;
export type BanExportRequest = any;
export type BirthdayConfig = any;
export type ColorBlindPreference = any;
export type FollowRelationship = any;
export type VerificationRequest = any;
