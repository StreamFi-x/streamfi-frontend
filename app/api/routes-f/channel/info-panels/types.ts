export interface InfoPanel {
  panel_id: string;
  creator_id: string;
  title: string;
  body_markdown: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PostPanelBody {
  creator_id: string;
  title: string;
  body_markdown: string;
  image_url?: string;
}

export interface PatchPanelBody {
  title?: string;
  body_markdown?: string;
  image_url?: string | null;
}

export interface ReorderPanelsBody {
  creator_id: string;
  order: string[];
}

export interface GetPanelsResponse {
  panels: InfoPanel[];
}
