const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { u8aToHex } = require("@polkadot/util");
const { encodeDerivedAddress } = require("@polkadot/util-crypto");

const { KSM_URL, KSM_KEY } = require("./config");

module.exports = {
  addArtwork: async (galleryId, artistId, artwork) => {
    const { symbol, name, max, metadataUrl, url, type } = artwork;

    const keyring = new Keyring({ type: "sr25519", ss58Format: 2 });
    const key = keyring.createFromUri(KSM_KEY);
    const galleryAddress = encodeDerivedAddress(key.address, galleryId, 2);
    const artistAddress = encodeDerivedAddress(galleryAddress, artistId, 2);
    const artistAddressHex = u8aToHex(artistAddress);
    const collectionId = `${artistAddressHex.slice(2, 10)}${artistAddressHex.slice(-8)}-${symbol}`;

    const rmrk = `RMRK::MINT::1.0.0::${encodeURIComponent(
      JSON.stringify({
        name,
        max,
        issuer: artistAddress,
        symbol,
        id: collectionId,
        metadata: metadataUrl,
        data: {
          protocol: "ipfs",
          data: url,
          type,
        },
      })
    )}`;

    const api = await ApiPromise.create({ provider: new WsProvider(KSM_URL) });
    const remarkCall = api.tx.system.remark(rmrk);
    const asArtistCall = api.tx.utility.asDerivative(artistId, remarkCall);
    const asGalleryCall = api.tx.utility.asDerivative(galleryId, asArtistCall);

    return new Promise(async (resolve, reject) => {
      const unsub = await asGalleryCall.signAndSend(key, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isFinalized) {
          unsub();
          resolve({ id: collectionId, blockHash: status.asFinalized });
        }
      });
    });
  },
  createCertificate: async (galleryId, artistId, collectorId, certificate) => {
    const { collection, num, ap, metadataUrl } = certificate;
    const sn = num.toString().padStart(16, "0");
    const name = `${collection}_${sn}`.replaceAll("-", "_");

    const mintRmrk = `RMRK::MINTNFT::1.0.0::${encodeURIComponent(
      JSON.stringify({
        collection,
        name,
        instance: name,
        transferable: 1,
        sn,
        metadata: metadataUrl,
      })
    )}`;

    const keyring = new Keyring({ type: "sr25519", ss58Format: 2 });
    const key = keyring.createFromUri(KSM_KEY);
    const galleryAddress = encodeDerivedAddress(key.address, galleryId, 2);

    const api = await ApiPromise.create({ provider: new WsProvider(KSM_URL) });
    const mintCall = api.tx.system.remark(mintRmrk);
    const asArtistMint = api.tx.utility.asDerivative(artistId, mintCall);
    const asGalleryMint = api.tx.utility.asDerivative(galleryId, asArtistMint);

    const { mintedBlockHash, mintedBlockNumber } = await new Promise(async (resolve, reject) => {
      const unsub = await asGalleryMint.signAndSend(key, async ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isFinalized) {
          unsub();
          const blockNumber = (await api.rpc.chain.getBlock(status.asFinalized)).block.header.number.toNumber();
          resolve({
            mintedBlockHash: status.asFinalized,
            mintedBlockNumber: blockNumber,
          });
        }
      });
    });

    const certificateId = `${mintedBlockNumber}-${collection}-${name}-${sn}`;
    const collectorAddress = encodeDerivedAddress(galleryAddress, collectorId, 2);
    const sendRmrk = `RMRK::SEND::1.0.0::${certificateId}::${collectorAddress}`;

    const sendCall = api.tx.system.remark(sendRmrk);
    const asArtistSend = api.tx.utility.asDerivative(artistId, sendCall);
    const asGallerySend = api.tx.utility.asDerivative(galleryId, asArtistSend);
    return new Promise(async (resolve, reject) => {
      const unsub = await asGallerySend.signAndSend(key, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isFinalized) {
          unsub();
          resolve({ id: certificateId, mintedBlockHash, sentBlock: status.asFinalized });
        }
      });
    });
  },
  sendCertificate: async (galleryId, ownerId, destId, certificateId) => {
    const keyring = new Keyring({ type: "sr25519", ss58Format: 2 });
    const key = keyring.createFromUri(KSM_KEY);
    const galleryAddress = encodeDerivedAddress(key.address, galleryId, 2);
    const collectorAddress = encodeDerivedAddress(galleryAddress, destId, 2);

    const sendRmrk = `RMRK::SEND::1.0.0::${certificateId}::${collectorAddress}`;

    const api = await ApiPromise.create({ provider: new WsProvider(KSM_URL) });
    const sendCall = api.tx.system.remark(sendRmrk);
    const asOwnerSend = api.tx.utility.asDerivative(ownerId, sendCall);
    const asGallerySend = api.tx.utility.asDerivative(galleryId, asOwnerSend);
    return new Promise(async (resolve, reject) => {
      const unsub = await asGallerySend.signAndSend(key, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isFinalized) {
          unsub();
          resolve({ blockHash: status.asFinalized });
        }
      });
    });
  },
};
