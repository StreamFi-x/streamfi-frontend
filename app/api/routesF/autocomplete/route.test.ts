import { GET } from './route';

describe('Autocomplete Route', () => {
  it('prioritizes prefix matches over substring matches', async () => {
    // Both 'CryptoWhale' and 'CrypticGamer' and 'Crypto Trading' and 'crypto' start with 'crypt'
    // 'BitcoinMaxi' doesn't have 'crypt'. Wait, let's search for 'cryp'
    const req = new Request('http://localhost:3000/api/routesF/autocomplete?q=cryp&limit=5');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.suggestions.length).toBeGreaterThan(0);
    // Highest score among prefix matches should be first
    expect(data.suggestions[0].label).toBe('CryptoWhale'); // score 100
  });

  it('substring matches come after prefix matches', async () => {
    // Add a corpus item dynamically or just rely on existing
    // query: 'chat'
    // 'Just Chatting' (category) -> substring match
    // 'chat' (tag) -> prefix match
    const req = new Request('http://localhost:3000/api/routesF/autocomplete?q=chat&limit=5');
    const res = await GET(req);
    const data = await res.json();
    
    expect(data.suggestions.length).toBe(2);
    // 'chat' is a prefix match (starts with 'chat'), so it should be first, even though 'Just Chatting' has higher score
    expect(data.suggestions[0].label).toBe('chat');
    expect(data.suggestions[1].label).toBe('Just Chatting');
  });

  it('respects limit', async () => {
    const req = new Request('http://localhost:3000/api/routesF/autocomplete?q=c&limit=2');
    const res = await GET(req);
    const data = await res.json();
    
    expect(data.suggestions.length).toBe(2);
  });
});
