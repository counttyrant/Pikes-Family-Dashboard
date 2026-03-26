import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

/**
 * Proxies requests to an Immich server to avoid browser CORS issues.
 *
 * GET /api/immich-proxy?server=https://immich.example.com&path=/api/albums&apiKey=xxx
 *
 * The function fetches the given path from the Immich server with the API key
 * and returns the JSON response.
 */
app.http('immichProxy', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'immich-proxy',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const server = req.query.get('server')?.replace(/\/+$/, '');
      const path = req.query.get('path');
      const apiKey = req.query.get('apiKey');

      if (!server || !path || !apiKey) {
        return { status: 400, jsonBody: { error: 'server, path, and apiKey are required' } };
      }

      // Only allow /api/ paths to prevent open proxy abuse
      if (!path.startsWith('/api/')) {
        return { status: 400, jsonBody: { error: 'path must start with /api/' } };
      }

      const url = `${server}${path}`;
      context.log(`Immich proxy: ${url}`);

      const response = await fetch(url, {
        headers: { 'x-api-key': apiKey },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          status: response.status,
          jsonBody: { error: `Immich returned ${response.status}: ${text.slice(0, 500)}` },
        };
      }

      const data = await response.json();
      return {
        jsonBody: data,
        headers: { 'Cache-Control': 'no-cache' },
      };
    } catch (error: any) {
      context.error('Immich proxy error:', error);
      return {
        status: 502,
        jsonBody: { error: `Failed to reach Immich server: ${error.message}` },
      };
    }
  },
});
