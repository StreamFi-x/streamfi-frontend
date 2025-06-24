/**
 * app/test-stream/page.tsx
 * 
 * Test page for Livepeer streaming functionality
 * Use this page to test all your backend APIs and streaming features
 */

import StreamTestComponent from '@/components/StreamTestComponent';

export default function TestStreamPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <StreamTestComponent />
    </div>
  );
}