require("dotenv").config();

module.exports = {
  APP_NAME: process.env.BCA_APP_NAME || "Blockchain.art IPFS & Kusama Service",
  SVC_PORT: process.env.BCA_SVC_PORT ? parseInt(process.env.BCA_KSM_SVC_PORT) : 6221,
  IPFS_URL: process.env.BCA_IPFS_URL || "http://localhost:5001",
  KSM_URL: process.env.BCA_KSM_URL || "ws://127.0.0.1:9944",
  KSM_KEY: process.env.BCA_KSM_KEY || "//Alice",
  FILE_STORE: process.env.BCA_FILE_STORE || "/tmp/bca-files",
};
