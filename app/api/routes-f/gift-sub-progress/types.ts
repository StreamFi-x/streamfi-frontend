export interface GiftSubProgress {
  gifts_received: number;
  current_milestone: number | null;
  next_milestone: number | null;
  percent_to_next: number;
}
