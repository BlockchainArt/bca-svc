# Blockchain.art IPFS & Kusama Service

This is an Express web service that provides IPFS & Kusama capabilities for the Blockchain.art (BCA) application. Use
`npm i && npm start` to install project dependencies and launch a live-reloading development server.

## Environment Variables

This project depends on the following environment variables:

- `BCA_SVC_NAME`: Service name (default: `Blockchain.art IPFS & Kusama Service`)
- `BCA_SVC_PORT`: Port on which to run the service (default: `6221`)
- `BCA_IPFS_KEY`: Pinata API key
- `BCA_IPFS_PWD`: Pinata API secret
- `BCA_KSM_URL`: URL for the Kusama WebSocket API (default: `ws://127.0.0.1:9944`)
- `BCA_KSM_KEY`: Private key to use for blockchain interactions (default: `//Alice`)
- `BCA_FILE_STORE`: Temporary [location for files uploaded](https://www.npmjs.com/package/multer#multeropts) via
  [`POST /file` endpoint](#post-file) (default: `/tmp/bca-files`)

You can use a [`.env` file](https://www.npmjs.com/package/dotenv) to override the default values.

## Endpoints

The services exposes the following endpoints:

### `POST /file`

Pin a file to the IPFS server. This endpoint can be used any time a file needs to be uploaded.

Parameters:

- `file`: the file to pin to the IPFS server (form-encoded)

Returns:

- `id`: IPFS CID, file will be available at `https://bca-ipfs.blockchain.art/ipfs/<id>` (string)
- `size`: file size (integer)

Returns example:

```json
{
  "id": "QmPZdcc9dT85hdx6E2uMxULMwwHDHrJR2ayMUHUamaXo1N",
  "size": 16936
}
```

### `POST /file-batch`

Pin a batch of files to the IPFS server. This endpoint can be used any time a batch of files needs to be uploaded.

Parameters:

- `file`: the file to pin to the IPFS server (form-encoded, can repeat)

Returns:

- `id`: IPFS CID, file will be available at `https://bca-ipfs.blockchain.art/ipfs/<id>` (string)
- `size`: file size (integer)

Returns example:

```json
{
  "id": "QmPZdcc9dT85hdx6E2uMxULMwwHDHrJR2ayMUHUamaXo1N",
  "size": 16936
}
```

### `POST /artwork`

Pin artwork metadata to the IPFS server & create an on-chain asset class for minting prints. This endpoint should be
used after an artist has signed an artwork agreement with a gallery. The CID in the URL parameter is returned by the
[`POST /file` endpoint](#post-file).

Parameters:

- `galleryId`: the ID of the gallery representing the artist (integer)
- `artistId`: the ID of the artist that created the artwork (integer)
- `description`: long-form description of the artwork (string)
- `year`: year the artwork was created (integer)
- `numAp`: the number of APs available (integer)
- `url`: IPFS URL of the original artwork (string)
  - regex: ipfs://ipfs/&lt;cid&gt;
- `name`: artwork name (alphanumeric string)
- `artist`: artist name (alphanumeric string)
- `max`: max number of total (prints + APs) certificates (integer)
- `symbol`: artwork symbol (string)
- `type`: artwork type (MIME type)

Example:

```json
{
  "galleryId": 0,
  "artistId": 0,
  "description": "The one and only Mona Lisa.",
  "year": "1503",
  "numAp": 1,
  "url": "ipfs://ipfs/Qmay5TKfaZESGSN7eK5644Di4CmFCWEpgBg88KoUxkQxfe",
  "name": "Mona Lisa",
  "artist": "Leondardo Da Vinci",
  "max": 4,
  "symbol": "LSA",
  "type": "image/jpeg"
}
```

Returns:

- `id`: artwork ID (string)
- `blockHash`: hash of block where artwork asset class was defined (hex string)

Returns example:

```json
{
  "id": "0106010301060103-LSA",
  "blockHash": "0x4ca8431516f17aedb0f030688b9d1236bf225c0d063fc6cbf9d017452a1a25ce"
}
```

### `POST /certificate`

Pin print/certificate metadata to the IPFS server & create an on-chain certificate. This endpoint should be used after a
collector has purchased a digital print.

Parameters:

- `galleryId`: the ID of the gallery representing the artist & collector (integer)
- `artistId`: the ID of the artist that created the artwork (integer)
- `collectorId`: the ID of the collector that is purchasing the digital print (integer)
- `collection`: the ID of the artwork (asset class) ID, returned by [`POST /artwork` endpoint](#post-artwork) (string)
- `num`: print number, including APs (integer)
- `ap`: optional, default false (boolean)

Example:

```json
{
  "galleryId": 0,
  "artistId": 0,
  "collectorId": 1,
  "collection": "0106010301060103-LSA",
  "num": 1
}
```

Returns:

- `id`: certificate ID (string)
- `mintedBlock`: hash of block where certificate was minted (hex string)
- `sentBlock`: hash of block where certificate was sent to buyer (hex string)

Returns example:

```json
{
  "id": "12-0106010301060103-LSA-0106010301060103_LSA_0000000000000001-0000000000000001",
  "mintedBlock": "0xf60a79f7e6b6ad4062eec59fc1397177f6ba9c444da1f1987646e125846a129e",
  "sentBlock": "0xf02fbba16a41b2a962bae7ebafea6d56e77a1b4929d4c036d5359198f7f0233e"
}
```

### `POST /transfer`

Provides resale (collector-to-collector sale) capabilities. This endpoint can be used any time the owner of an existing
certificate would like to transfer ownership of the certificate to another user.

Parameters:

- `galleryId`: the ID of the gallery representing the collectors (integer)
- `ownerId`: the ID of the certificate's current owner (integer)
- `destId`: the ID of the account that will become the new owner of the certificate (integer)
- `certificateId`: the ID of the certificate to transfer (string)

Example:

```json
{
  "galleryId": 0,
  "ownerId": 1,
  "destId": 2,
  "certificateId": "12-0106010301060103-LSA-0106010301060103_LSA_0000000000000001-0000000000000001"
}
```

Returns:

- `blockHash`: hash of block where certificate was sent to new owner (hex string)

Returns example:

```json
{
  "blockHash": "0x6938595bb355d4b15f332e140d201c3f61212d5cfc2474de60328f5645d0cb6d"
}
```
