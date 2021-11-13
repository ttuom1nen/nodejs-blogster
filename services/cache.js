const mongoose = require("mongoose");
const redis = require("redis");
const util = require("util");

const redisUrl = "redis://127.0.0.1:6379";
const redisClient = redis.createClient(redisUrl);
redisClient.get = util.promisify(redisClient.get);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function () {
  this.useCache = true;
  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );

  // See if we have a value for "key" in redis
  const cacheValue = await redisClient.get(key);

  // If we do, return it
  if (cacheValue) {
    console.log("Cache hit");
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
      ? doc.map((d) => this.model(d))
      : new this.model(doc);
  }

  // If not, issue query and store the result in redis
  console.log("Cache miss");
  const result = await exec.apply(this, arguments);

  redisClient.set(key, JSON.stringify(result));

  return result;
};
