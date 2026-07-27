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
