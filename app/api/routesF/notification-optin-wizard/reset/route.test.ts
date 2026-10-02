import { POST as advancePOST } from '../advance/route';
import { POST as resetPOST } from './route';

function advanceRequest(body: unknown) {
  return new Request('http://localhost/api/routesF/notification-optin-wizard/advance', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function resetRequest(body: unknown) {
  return new Request('http://localhost/api/routesF/notification-optin-wizard/reset', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Notification Opt-in Wizard reset', () => {
  it('should return 400 when viewer_id is missing', async () => {
    const res = await resetPOST(resetRequest({}));
    expect(res.status).toBe(400);
  });

  it('should restart a wizard that had progressed partway through', async () => {
    const viewer_id = 'viewer_reset_1';
    await advancePOST(advanceRequest({ viewer_id, step: 'channels', choice: 'email' }));
    await advancePOST(advanceRequest({ viewer_id, step: 'frequency', choice: 'weekly' }));

    const res = await resetPOST(resetRequest({ viewer_id }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ step: 'channels', choices: {}, completed: false });
  });

  it('should restart a fully completed wizard', async () => {
    const viewer_id = 'viewer_reset_2';
    await advancePOST(advanceRequest({ viewer_id, step: 'channels' }));
    await advancePOST(advanceRequest({ viewer_id, step: 'frequency' }));
    await advancePOST(advanceRequest({ viewer_id, step: 'categories' }));
    await advancePOST(advanceRequest({ viewer_id, step: 'review' }));

    const res = await resetPOST(resetRequest({ viewer_id }));
    const data = await res.json();
    expect(data.completed).toBe(false);
    expect(data.step).toBe('channels');

    const advanceAgain = await advancePOST(advanceRequest({ viewer_id, step: 'channels', choice: 'sms' }));
    expect(advanceAgain.status).toBe(200);
  });
});
