import Redis from "ioredis";
import logger from "../logger.js";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

// Use full Upstash URL instead of host/port
const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  logger.info("✅ Connected to Redis");
});

redis.on("error", (err) => {
  logger.error("❌ Redis connection error:", err.message);
  console.log("Redis connection error:", err);
});

export default redis;
