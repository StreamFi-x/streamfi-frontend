import { GET } from './route';

function getRequest(query: string) {
  return new Request(`http://localhost/api/routesF/notification-optin-wizard?${query}`);
}

describe('Notification Opt-in Wizard GET', () => {
  it('should return 400 when viewer_id is missing', async () => {
    const res = await GET(getRequest(''));
    expect(res.status).toBe(400);
  });

  it('should return the initial state for a fresh viewer', async () => {
    const res = await GET(getRequest('viewer_id=viewer_fresh_1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ step: 'channels', choices: {}, completed: false });
  });
});
