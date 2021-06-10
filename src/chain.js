const { ApiPromise, WsProvider } = require("@polkadot/api");
const { Keyring } = require("@polkadot/keyring");
const { u8aToHex } = require("@polkadot/util");
const { encodeDerivedAddress } = require("@polkadot/util-crypto");

const { KSM_URL, KSM_KEY } = require("./config");
const KSM_SS58_FMT = 2;

class Chain {
  #key;
  #api;
  #apiPromise;

  constructor() {
    this.#apiPromise = ApiPromise.create({ provider: new WsProvider(KSM_URL) });
  }

  get initialized() {
    return this.#apiPromise.then((api) => {
      this.#api = api;
      this.#key = new Keyring({ type: "sr25519", ss58Format: KSM_SS58_FMT }).createFromUri(KSM_KEY);
      return this;
    });
  }

  async addArtwork(galleryId, artistId, artwork) {
    const { symbol, name, max, metadataUrl, url, type } = artwork;

    const galleryAddress = encodeDerivedAddress(this.#key.address, galleryId, KSM_SS58_FMT);
    const artistAddress = encodeDerivedAddress(galleryAddress, artistId, KSM_SS58_FMT);
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

    const remarkCall = this.#api.tx.system.remark(rmrk);
    const asArtistCall = this.#api.tx.utility.asDerivative(artistId, remarkCall);
    const asGalleryCall = this.#api.tx.utility.asDerivative(galleryId, asArtistCall);

    return new Promise(async (resolve, reject) => {
      const unsub = await asGalleryCall.signAndSend(this.#key, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = this.#api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isInBlock) {
          unsub();
          resolve({ id: collectionId, blockHash: status.asInBlock });
        }
      });
    });
  }

  async createCertificate(galleryId, artistId, collectorId, certificate) {
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

    const galleryAddress = encodeDerivedAddress(this.#key.address, galleryId, KSM_SS58_FMT);

    const mintCall = this.#api.tx.system.remark(mintRmrk);
    const asArtistMint = this.#api.tx.utility.asDerivative(artistId, mintCall);
    const asGalleryMint = this.#api.tx.utility.asDerivative(galleryId, asArtistMint);

    const { mintedBlockHash, mintedBlockNumber } = await new Promise(async (resolve, reject) => {
      const unsub = await asGalleryMint.signAndSend(this.#key, async ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = this.#api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isInBlock) {
          unsub();
          const blockHash = status.asInBlock;
          const blockNumber = (await this.#api.rpc.chain.getBlock(blockHash)).block.header.number.toNumber();
          resolve({
            mintedBlockHash: blockHash,
            mintedBlockNumber: blockNumber,
          });
        }
      });
    });

    const certificateId = `${mintedBlockNumber}-${collection}-${name}-${sn}`;
    const collectorAddress = encodeDerivedAddress(galleryAddress, collectorId, KSM_SS58_FMT);
    const sendRmrk = `RMRK::SEND::1.0.0::${certificateId}::${collectorAddress}`;

    const sendCall = this.#api.tx.system.remark(sendRmrk);
    const asArtistSend = this.#api.tx.utility.asDerivative(artistId, sendCall);
    const asGallerySend = this.#api.tx.utility.asDerivative(galleryId, asArtistSend);
    return new Promise(async (resolve, reject) => {
      const unsub = await asGallerySend.signAndSend(this.#key, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = this.#api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isInBlock) {
          unsub();
          resolve({ id: certificateId, mintedBlockHash, sentBlock: status.asInBlock });
        }
      });
    });
  }

  async sendCertificate(galleryId, ownerId, destId, certificateId) {
    const galleryAddress = encodeDerivedAddress(this.#key.address, galleryId, KSM_SS58_FMT);
    const collectorAddress = encodeDerivedAddress(galleryAddress, destId, KSM_SS58_FMT);

    const sendRmrk = `RMRK::SEND::1.0.0::${certificateId}::${collectorAddress}`;

    const sendCall = this.#api.tx.system.remark(sendRmrk);
    const asOwnerSend = this.#api.tx.utility.asDerivative(ownerId, sendCall);
    const asGallerySend = this.#api.tx.utility.asDerivative(galleryId, asOwnerSend);
    return new Promise(async (resolve, reject) => {
      const unsub = await asGallerySend.signAndSend(this.#key, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          unsub();
          if (dispatchError.isModule) {
            const decoded = this.#api.registry.findMetaError(dispatchError.asModule);
            const { documentation, name, section } = decoded;

            reject(`${section}.${name}: ${documentation.join(" ")}`);
          } else {
            reject(dispatchError.toString());
          }
        }

        if (status.isInBlock) {
          unsub();
          resolve({ blockHash: status.asInBlock });
        }
      });
    });
  }
}

module.exports = Chain;
