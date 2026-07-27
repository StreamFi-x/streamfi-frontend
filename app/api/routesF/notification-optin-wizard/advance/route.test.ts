import { POST } from './route';

function postRequest(body: unknown) {
  return new Request('http://localhost/api/routesF/notification-optin-wizard/advance', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Notification Opt-in Wizard advance', () => {
  it('should return 400 when viewer_id is missing', async () => {
    const res = await POST(postRequest({ step: 'channels' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when step is missing', async () => {
    const res = await POST(postRequest({ viewer_id: 'viewer_a' }));
    expect(res.status).toBe(400);
  });

  it('should reject advancing with the wrong step', async () => {
    const res = await POST(postRequest({ viewer_id: 'viewer_b', step: 'frequency' }));
    expect(res.status).toBe(409);
  });

  it('should walk a viewer through the full wizard to completion', async () => {
    const viewer_id = 'viewer_c';

    const step1 = await POST(postRequest({ viewer_id, step: 'channels', choice: 'push' }));
    const data1 = await step1.json();
    expect(data1.step).toBe('frequency');
    expect(data1.choices.channels).toBe('push');
    expect(data1.completed).toBe(false);

    const step2 = await POST(postRequest({ viewer_id, step: 'frequency', choice: 'daily' }));
    const data2 = await step2.json();
    expect(data2.step).toBe('categories');

    const step3 = await POST(postRequest({ viewer_id, step: 'categories', choice: 'sports' }));
    const data3 = await step3.json();
    expect(data3.step).toBe('review');

    const step4 = await POST(postRequest({ viewer_id, step: 'review', choice: 'confirm' }));
    const data4 = await step4.json();
    expect(data4.step).toBeNull();
    expect(data4.completed).toBe(true);
    expect(data4.choices).toEqual({
      channels: 'push',
      frequency: 'daily',
      categories: 'sports',
      review: 'confirm',
    });
  });

  it('should reject advancing an already completed wizard', async () => {
    const viewer_id = 'viewer_d';
    await POST(postRequest({ viewer_id, step: 'channels' }));
    await POST(postRequest({ viewer_id, step: 'frequency' }));
    await POST(postRequest({ viewer_id, step: 'categories' }));
    await POST(postRequest({ viewer_id, step: 'review' }));

    const res = await POST(postRequest({ viewer_id, step: 'channels' }));
    expect(res.status).toBe(409);
  });

  it('should allow advancing a step without providing a choice', async () => {
    const res = await POST(postRequest({ viewer_id: 'viewer_e', step: 'channels' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.choices.channels).toBeUndefined();
  });
});
