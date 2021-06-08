const express = require("express");
const { body, validationResult } = require("express-validator");
const { multihash } = require("is-ipfs");
const morgan = require("morgan");

const { addArtwork, createCertificate } = require("./chain");
const { pinJsonString } = require("./ipfs");

const { APP_NAME, SVC_PORT } = require("./config");

main().catch(console.error);

async function main() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("tiny"));

  const isValidIpfsUrl = (url) => {
    const match = /ipfs:\/\/ipfs\/(.*)/.exec(url);
    if (!match || match.length < 2) {
      return false;
    }

    if (!multihash(match[1])) {
      return false;
    }

    return true;
  };

  const validateRequest = (req, res) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return false;
    }

    const errArr = errors.array();
    console.error(errArr);
    res.status(400).json({ errors: errArr });
    return true;
  };

  app.post(
    "/artwork-metadata",
    body("description").isString(),
    body("year").isInt(),
    body("numAp").isInt(),
    body("url").custom(isValidIpfsUrl),
    async (req, res) => {
      if (validateRequest(req, res)) {
        return;
      }

      const { description, year, numAp, url } = req.body;

      const metadata = {
        description,
        attributes: [
          {
            trait_type: "Year",
            value: year,
          },
          {
            trait_type: "APs",
            value: numAp,
          },
        ],
        image: url,
      };

      try {
        const cid = await pinJsonString(metadata);
        res.json({ id: cid });
      } catch (err) {
        console.error(err);
        res.status(500).json({ errors: `${err}` });
      }
    }
  );

  app.post(
    "/artwork",
    body("galleryId").isInt(),
    body("artistId").isInt(),
    body("name").isString(),
    body("max").isInt(),
    body("symbol").isString().toUpperCase(),
    body("metadataUrl").custom(isValidIpfsUrl),
    body("url").custom(isValidIpfsUrl),
    body("type").isMimeType(),
    async (req, res) => {
      if (validateRequest(req, res)) {
        return;
      }

      const { galleryId, artistId, name, max, symbol, metadataUrl, url, type } = req.body;
      const artwork = { name, max, symbol, metadataUrl, url, type };

      try {
        const { id, blockHash } = await addArtwork(galleryId, artistId, artwork);
        res.json({ id, blockHash });
      } catch (err) {
        console.error(err);
        res.status(500).json({ errors: `${err}` });
      }
    }
  );

  app.post(
    "/certificate-metadata",
    body("collection").isString(),
    body("num").isInt(),
    body("ap").toBoolean(),
    async (req, res) => {
      if (validateRequest(req, res)) {
        return;
      }

      const { collection, num, ap } = req.body;
      const name = `${collection}_${num.toString().padStart(16, "0")}`.replaceAll("-", "_");

      const metadata = {
        name,
        attributes: [
          {
            trait_type: "Number",
            value: num,
          },
          {
            trait_type: "AP",
            value: ap,
          },
        ],
      };

      try {
        const cid = await pinJsonString(metadata);
        res.json({ id: cid });
      } catch (err) {
        console.error(err);
        res.status(500).json({ errors: `${err}` });
      }
    }
  );

  app.post(
    "/certificate",
    body("galleryId").isInt(),
    body("artistId").isInt(),
    body("collectorId").isInt(),
    body("collection").isString(),
    body("num").isInt(),
    body("ap").toBoolean(),
    body("metadataUrl").custom(isValidIpfsUrl),
    async (req, res) => {
      if (validateRequest(req, res)) {
        return;
      }

      const { galleryId, artistId, collectorId, collection, num, ap, metadataUrl } = req.body;
      const certificate = { collection, num, ap, metadataUrl };

      try {
        const { id, mintedBlock, sentBlock } = await createCertificate(galleryId, artistId, collectorId, certificate);
        res.json({ id, mintedBlock, sentBlock });
      } catch (err) {
        console.error(err);
        res.status(500).json({ errors: `${err}` });
      }
    }
  );

  app.listen(SVC_PORT, () => {
    console.log(` >>> ✅ ${APP_NAME} is running on port ${SVC_PORT}...`);
  });
}
