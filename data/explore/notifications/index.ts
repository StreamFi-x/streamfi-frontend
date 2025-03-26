import { Bell, Mail, MessageSquare, Heart, UserPlus, AtSign } from 'lucide-react';
import { NotificationSetting } from '@/types/explore/notificationSetting';

export const notificationSettings: NotificationSetting[] = [
  { 
    id: 'push_notifications', 
    label: 'Push Notifications', 
    description: 'Receive notifications on your device',
    enabled: true,
    icon: Bell,
  },
  { 
    id: 'email_notifications', 
    label: 'Email Notifications', 
    description: 'Receive notifications via email',
    enabled: true,
    icon: Mail,
  },
  { 
    id: 'new_messages', 
    label: 'New Messages', 
    description: 'Get notified when you receive new messages',
    enabled: true,
    icon: MessageSquare,
  },
  { 
    id: 'new_likes', 
    label: 'Likes & Reactions', 
    description: 'Get notified when someone likes your content',
    enabled: true,
    icon: Heart,
  },
  { 
    id: 'new_followers', 
    label: 'New Followers', 
    description: 'Get notified when someone follows you',
    enabled: true,
    icon: UserPlus,
  },
  { 
    id: 'mentions', 
    label: 'Mentions', 
    description: 'Get notified when someone mentions you',
    enabled: true,
    icon: AtSign,
  }
];