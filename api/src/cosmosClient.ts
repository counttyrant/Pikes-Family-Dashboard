import { CosmosClient, Container } from '@azure/cosmos';

let client: CosmosClient | null = null;
let container: Container | null = null;

export function getContainer(): Container {
  if (container) return container;

  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('COSMOS_CONNECTION_STRING environment variable is not set');
  }

  const databaseName = process.env.COSMOS_DATABASE || 'PikesFamilyDashboard';
  const containerName = process.env.COSMOS_CONTAINER || 'dashboard-data';

  client = new CosmosClient(connectionString);
  const database = client.database(databaseName);
  container = database.container(containerName);

  return container;
}

export async function ensureDatabase(): Promise<void> {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) throw new Error('COSMOS_CONNECTION_STRING not set');

  const databaseName = process.env.COSMOS_DATABASE || 'PikesFamilyDashboard';
  const containerName = process.env.COSMOS_CONTAINER || 'dashboard-data';

  const tempClient = new CosmosClient(connectionString);

  const { database } = await tempClient.databases.createIfNotExists({
    id: databaseName,
  });

  await database.containers.createIfNotExists({
    id: containerName,
    partitionKey: { paths: ['/collection'] },
    defaultTtl: -1, // no expiry
  });
}
