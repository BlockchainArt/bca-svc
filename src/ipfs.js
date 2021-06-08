const { create } = require("ipfs-http-client");

const { IPFS_URL } = require("./config");

nativeFetch = require("node-fetch");

module.exports = {
  pinJsonString: async (data) => {
    const client = create(IPFS_URL);
    const add = await client.add(JSON.stringify(data));
    const cid = add.cid.toString();
    await client.pin.add(cid);
    return cid;
  },
};
