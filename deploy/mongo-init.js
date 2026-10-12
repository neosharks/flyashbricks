// Runs once, on first start with an empty data volume. Creates the
// least-privilege user the app connects as: read/write on its own database,
// no ability to drop it or touch any other.
const dbName = process.env.MONGODB_DB_NAME || 'flyash';
db.getSiblingDB('admin').createUser({
  user: process.env.MONGO_APP_USER,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: dbName }],
});
