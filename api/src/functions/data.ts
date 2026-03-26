import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer, ensureDatabase } from '../cosmosClient';

const VALID_COLLECTIONS = [
  'settings',
  'familyMembers',
  'chores',
  'rewards',
  'stickerRecords',
  'shoppingItems',
  'notes',
  'countdownEvents',
  'localEvents',
  'widgetChores',
  'widgetTodos',
  'widgetNotes',
  'localStorage',
];

// GET /api/data?collection=settings
// GET /api/data?collection=settings&id=main
// POST /api/data { collection, id, ...data }
// PUT /api/data { collection, id, ...data }
// DELETE /api/data?collection=settings&id=main

app.http('data', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'data',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const collection = req.query.get('collection') || '';

      if (!collection || !VALID_COLLECTIONS.includes(collection)) {
        return { status: 400, jsonBody: { error: `Invalid collection: ${collection}` } };
      }

      const container = getContainer();

      switch (req.method) {
        case 'GET': {
          const id = req.query.get('id');
          if (id) {
            // Get single item
            try {
              const { resource } = await container.item(id, collection).read();
              if (!resource) return { status: 404, jsonBody: { error: 'Not found' } };
              return { jsonBody: resource };
            } catch (e: any) {
              if (e.code === 404) return { status: 404, jsonBody: { error: 'Not found' } };
              throw e;
            }
          } else {
            // Get all items in collection
            const { resources } = await container.items
              .query({
                query: 'SELECT * FROM c WHERE c.collection = @collection',
                parameters: [{ name: '@collection', value: collection }],
              })
              .fetchAll();
            return { jsonBody: resources };
          }
        }

        case 'POST':
        case 'PUT': {
          const body = (await req.json()) as Record<string, unknown>;
          if (!body.id) {
            body.id = crypto.randomUUID();
          }
          const doc = { ...body, collection, _lastModified: new Date().toISOString() };
          const { resource } = await container.items.upsert(doc);
          return { status: req.method === 'POST' ? 201 : 200, jsonBody: resource };
        }

        case 'DELETE': {
          const deleteId = req.query.get('id');
          if (!deleteId) {
            return { status: 400, jsonBody: { error: 'id is required for DELETE' } };
          }
          try {
            await container.item(deleteId, collection).delete();
            return { status: 204 };
          } catch (e: any) {
            if (e.code === 404) return { status: 204 }; // already gone
            throw e;
          }
        }

        default:
          return { status: 405, jsonBody: { error: 'Method not allowed' } };
      }
    } catch (error: any) {
      context.error('Data API error:', error);
      return {
        status: 500,
        jsonBody: { error: error.message || 'Internal server error' },
      };
    }
  },
});

// POST /api/data/init — creates database and container if they don't exist
app.http('dataInit', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'data/init',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      await ensureDatabase();
      return { jsonBody: { ok: true, message: 'Database and container ready' } };
    } catch (error: any) {
      context.error('Init error:', error);
      return { status: 500, jsonBody: { error: error.message } };
    }
  },
});
