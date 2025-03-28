export type NotificationSetting = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: React.FC<{ size: number }>; // Adjust based on your icon component
};