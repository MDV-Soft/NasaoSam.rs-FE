import { resolveApiUrl } from './api-url';

describe('resolveApiUrl', () => {
  const API = 'http://localhost:8080/api';

  it('puts the address of the backend in front of a path that the backend gave (photoUrl)', () => {
    expect(resolveApiUrl('/api/lost-reports/7/matches/12/photo', API)).toBe(
      'http://localhost:8080/api/lost-reports/7/matches/12/photo',
    );
  });

  it('does not repeat "/api" and keeps the numbers of the report and the match', () => {
    const url = resolveApiUrl('/api/lost-reports/7/matches/12/photo', API);

    expect(url.match(/\/api\//g)?.length).toBe(1);
    expect(url).toContain('/7/matches/12/');
  });

  it('leaves a full address as it is', () => {
    expect(resolveApiUrl('https://api.nasaosam.rs/api/x', API)).toBe(
      'https://api.nasaosam.rs/api/x',
    );
  });

  it('leaves the path as it is when the api is reached through a proxy (apiUrl is a path)', () => {
    expect(resolveApiUrl('/api/lost-reports/7/matches/12/photo', '/api')).toBe(
      '/api/lost-reports/7/matches/12/photo',
    );
  });

  it('uses the apiUrl of the environment by default', () => {
    expect(resolveApiUrl('/api/x')).toMatch(/^http:\/\/localhost:8080\/api\/x$/);
  });
});
