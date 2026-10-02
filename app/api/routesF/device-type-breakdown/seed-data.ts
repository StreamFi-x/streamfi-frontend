export interface DeviceViewer {
  id: string;
  stream_id: string;
  user_agent: string;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'tv';
}

export const seedDeviceViewers: DeviceViewer[] = [
  {
    id: 'viewer_1',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    device_type: 'desktop',
  },
  {
    id: 'viewer_2',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    device_type: 'mobile',
  },
  {
    id: 'viewer_3',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    device_type: 'tablet',
  },
  {
    id: 'viewer_4',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (Linux; U; Android 10; en-us) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    device_type: 'mobile',
  },
  {
    id: 'viewer_5',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    device_type: 'desktop',
  },
  {
    id: 'viewer_6',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    device_type: 'mobile',
  },
  {
    id: 'viewer_7',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    device_type: 'tv',
  },
  {
    id: 'viewer_8',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    device_type: 'desktop',
  },
  {
    id: 'viewer_9',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Mobile/15E148 Safari/604.1',
    device_type: 'mobile',
  },
  {
    id: 'viewer_10',
    stream_id: 'stream_001',
    user_agent: 'Mozilla/5.0 (iPad; CPU OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Mobile/15E148 Safari/604.1',
    device_type: 'tablet',
  },
];
