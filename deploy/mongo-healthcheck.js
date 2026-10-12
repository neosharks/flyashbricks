// Healthcheck for the mongo container (docker-compose.prod.yml).
//
// Healthy once this node is the replica set's primary. On the very first
// start it also initiates the single-node set. Credentials come from the
// container's environment rather than the command line, so they never show
// up in a process listing.
const user = encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME);
const password = encodeURIComponent(process.env.MONGO_INITDB_ROOT_PASSWORD);
const admin = connect(`mongodb://${user}:${password}@127.0.0.1:27017/admin?directConnection=true`);

let status = null;
try {
  status = admin.adminCommand({ replSetGetStatus: 1 });
} catch {
  admin.adminCommand({
    replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] },
  });
}
quit(status?.myState === 1 ? 0 : 1);
