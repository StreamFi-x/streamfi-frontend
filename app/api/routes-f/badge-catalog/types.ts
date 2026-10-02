export interface BadgeDefinition {
  badge_id: string;
  name: string;
  image_url: string;
  unlock_rule: string;
}

export interface BadgeCatalogResponse {
  creator_id: string;
  badges: BadgeDefinition[];
}
