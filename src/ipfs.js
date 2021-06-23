const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const pinataSDK = require("@pinata/sdk");

const { FILE_STORE, IPFS_KEY, IPFS_PWD } = require("./config");

module.exports = {
  pinJsonString: async (data) => {
    const pinata = pinataSDK(IPFS_KEY, IPFS_PWD);
    const result = await pinata.pinJSONToIPFS(data);
    return result.IpfsHash;
  },
  pinFile: async (path) => {
    const pinata = pinataSDK(IPFS_KEY, IPFS_PWD);
    const result = await pinata.pinFromFS(path);
    fs.rmSync(path);
    return { cid: result.IpfsHash, size: result.PinSize };
  },
  pinFileBatch: async (paths) => {
    const tmpPath = path.join(FILE_STORE, crypto.randomUUID());
    fs.mkdirSync(tmpPath);
    paths.forEach((filePath) => {
      const parsedPath = path.parse(filePath);
      if (parsedPath.dir !== FILE_STORE) {
        return;
      }

      fs.renameSync(filePath, path.join(tmpPath, parsedPath.name));
    });

    const pinata = pinataSDK(IPFS_KEY, IPFS_PWD);
    const result = await pinata.pinFromFS(tmpPath);
    fs.rmSync(tmpPath, { recursive: true });
    return { cid: result.IpfsHash, size: result.PinSize };
  },
};
