/**
 * server side livepeer integration
 * this handles stream creation, management, and health monitoring
 * makes use of the livepeer sdk which interfaces with the Livepeer API
 */

import { Livepeer } from 'livepeer';
import { getSrc, getIngest } from '@livepeer/react/external';

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY!,
});


export async function createLivepeerStream(streamData: {
  name: string;
  record?: boolean;
}) {
  try {
    const response = await livepeer.stream.create({
      name: streamData.name,
      record: streamData.record ?? true,
      multistream: {
        targets: [], 
      },
    });
    
    return response.stream;
  } catch (error) {
    console.error('Livepeer stream creation error:', error);
    throw new Error('Failed to create Livepeer stream');
  }
}

// this is for getting viewer playback source
export async function getPlaybackSource(playbackId: string) {
  try {
    const response = await livepeer.playback.get(playbackId);
    return getSrc(response.playbackInfo);
  } catch (error) {
    console.error('Livepeer playback error:', error);
    throw new Error('Failed to get playback source');
  }
}


export async function getIngestUrl(streamKey: string) {
  try {
    return getIngest(streamKey);
  } catch (error) {
    console.error('Livepeer ingest error:', error);
    throw new Error('Failed to get ingest URL');
  }
}

export async function getStreamMetrics(streamId: string) {
  try {
    const response = await livepeer.stream.get(streamId);
    return response.stream;
  } catch (error) {
    console.error('Livepeer metrics error:', error);
    throw new Error('Failed to get stream metrics');
  }
}

// Delete/deactivate stream
export async function deleteLivepeerStream(streamId: string) {
  try {
    await livepeer.stream.delete(streamId);
    return true;
  } catch (error) {
    console.error('Livepeer stream deletion error:', error);
    throw new Error('Failed to delete Livepeer stream');
  }
}

// Update stream configuration
export async function updateLivepeerStream(streamId: string, updateData: {
  name?: string;
  record?: boolean;
}) {
  try {
    const response = await livepeer.stream.update(streamId, updateData);
    return response;
  } catch (error) {
    console.error('Livepeer stream update error:', error);
    throw new Error('Failed to update Livepeer stream');
  }
}

// Get stream health/status
export async function getStreamHealth(streamId: string) {
  try {
    const response = await livepeer.stream.get(streamId);
    return {
      isActive: response.stream?.isActive || false,
      lastSeen: response.stream?.lastSeen,
      ingestRate: response.stream?.ingestRate,
      outgoingRate: response.stream?.outgoingRate,
    };
  } catch (error) {
    console.error('Livepeer stream health error:', error);
    throw new Error('Failed to get stream health');
  }
}