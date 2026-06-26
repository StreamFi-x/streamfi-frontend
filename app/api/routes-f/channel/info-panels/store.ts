import type { InfoPanel } from "./types";

let panelIdCounter = 1;

const panels: InfoPanel[] = [];

export function getPanelsByCreator(creatorId: string): InfoPanel[] {
  return panels
    .filter(p => p.creator_id === creatorId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function createPanel(
  creatorId: string,
  title: string,
  bodyMarkdown: string,
  imageUrl?: string
): InfoPanel {
  const existing = panels.filter(p => p.creator_id === creatorId);
  const now = new Date().toISOString();
  const panel: InfoPanel = {
    panel_id: `pnl_${String(panelIdCounter++).padStart(6, "0")}`,
    creator_id: creatorId,
    title,
    body_markdown: bodyMarkdown,
    image_url: imageUrl ?? null,
    sort_order: existing.length,
    created_at: now,
    updated_at: now,
  };
  panels.push(panel);
  return panel;
}

export function findPanel(panelId: string): InfoPanel | undefined {
  return panels.find(p => p.panel_id === panelId);
}

export function updatePanel(
  panelId: string,
  updates: { title?: string; body_markdown?: string; image_url?: string | null }
): InfoPanel | null {
  const panel = findPanel(panelId);
  if (!panel) {
    return null;
  }

  if (updates.title !== undefined) {
    panel.title = updates.title;
  }
  if (updates.body_markdown !== undefined) {
    panel.body_markdown = updates.body_markdown;
  }
  if (updates.image_url !== undefined) {
    panel.image_url = updates.image_url;
  }
  panel.updated_at = new Date().toISOString();
  return panel;
}

export function deletePanel(panelId: string): boolean {
  const idx = panels.findIndex(p => p.panel_id === panelId);
  if (idx === -1) {
    return false;
  }

  const creatorId = panels[idx].creator_id;
  panels.splice(idx, 1);

  const creatorPanels = panels
    .filter(p => p.creator_id === creatorId)
    .sort((a, b) => a.sort_order - b.sort_order);
  creatorPanels.forEach((p, i) => {
    p.sort_order = i;
  });

  return true;
}

export function reorderPanels(creatorId: string, order: string[]): void {
  const creatorPanels = panels.filter(p => p.creator_id === creatorId);
  if (creatorPanels.length === 0) {
    throw new Error("No panels found for creator");
  }

  const panelMap = new Map(creatorPanels.map(p => [p.panel_id, p]));
  const reordered: InfoPanel[] = [];

  for (const panelId of order) {
    const panel = panelMap.get(panelId);
    if (!panel) {
      throw new Error(`panel_id '${panelId}' not found`);
    }
    reordered.push(panel);
  }

  if (reordered.length !== creatorPanels.length) {
    throw new Error("Reorder list does not contain all panels");
  }

  reordered.forEach((panel, index) => {
    panel.sort_order = index;
    panel.updated_at = new Date().toISOString();
  });
}

export function clearAllPanels(): void {
  panels.length = 0;
  panelIdCounter = 1;
}
