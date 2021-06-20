const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { create, globSource } = require("ipfs-http-client");

const { FILE_STORE, IPFS_URL } = require("./config");

nativeFetch = require("node-fetch");

module.exports = {
  pinJsonString: async (data) => {
    const client = create(IPFS_URL);
    const add = await client.add(JSON.stringify(data));
    const cid = add.cid.toString();
    await client.pin.add(cid);
    return cid;
  },
  pinFile: async (path) => {
    const client = create(IPFS_URL);
    const add = await client.add(globSource(path));
    const cid = add.cid.toString();
    await client.pin.add(cid);
    return { path: add.path, cid, size: add.size };
  },
  pinFileBatch: async (paths) => {
    const tmpPath = path.join(FILE_STORE, crypto.randomUUID());
    fs.mkdirSync(tmpPath);
    paths.forEach((filePath) => {
      const parsedPath = path.parse(filePath);
      if (parsedPath.dir !== FILE_STORE) {
        return;
      }

      fs.copyFileSync(filePath, path.join(tmpPath, parsedPath.name));
    });

    const client = create(IPFS_URL);
    const add = await client.add(globSource(tmpPath, { recursive: true }));
    fs.rmSync(tmpPath, { recursive: true });
    const cid = add.cid.toString();
    await client.pin.add(cid);
    return { path: add.path, cid, size: add.size };
  },
};
