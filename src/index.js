const cors = require("cors");
const express = require("express");
const { body, validationResult } = require("express-validator");
const { multihash } = require("is-ipfs");
const morgan = require("morgan");
const multer = require("multer");

const Chain = require("./chain");
const { pinJsonString, pinFile, pinFileBatch } = require("./ipfs");

const { FILE_STORE, SVC_NAME, SVC_PORT, UI_URL } = require("./config");

main().catch(console.error);

async function main() {
  const app = express();
  app.use(cors({ origin: UI_URL }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("tiny"));

  const files = multer({ dest: FILE_STORE });

  const chain = await new Chain().initialized;

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
      return true;
    }

    const errArr = errors.array();
    console.error(errArr);
    res.status(400).json({ errors: errArr });
    return false;
  };

  app.post("/file", files.single("file"), async (req, res) => {
    if (!req.file || !req.file.path) {
      res.status(400).json({ errors: "File not found." });
      return;
    }

    try {
      const { path, cid, size } = await pinFile(req.file.path);
      res.json({ path, id: cid, size });
    } catch (err) {
      console.error(err);
      res.status(500).json({ errors: `${err}` });
    }
  });

  app.post("/file-batch", files.array("file"), async (req, res) => {
    if (!Array.isArray(req.files) || req.files.length < 1 || !req.files.some((file) => typeof file.path === "string")) {
      res.status(400).json({ errors: "File batch not found." });
      return;
    }

    const filePaths = req.files.map((file) => {
      if (typeof file.path !== "string") {
        return;
      }

      return file.path;
    });

    try {
      const { path, cid, size } = await pinFileBatch(filePaths);
      res.json({ path, id: cid, size });
    } catch (err) {
      console.error(err);
      res.status(500).json({ errors: `${err}` });
    }
  });

  app.post(
    "/artwork",
    body("galleryId").isInt(),
    body("artistId").isInt(),
    body("description").isString(),
    body("year").isInt(),
    body("numAp").isInt(),
    body("url").custom(isValidIpfsUrl),
    body("name").isString(),
    body("max").isInt(),
    body("symbol").isString().toUpperCase(),
    body("type").isMimeType(),
    async (req, res) => {
      if (!validateRequest(req, res)) {
        return;
      }

      const { galleryId, artistId, description, year, numAp, url, name, max, symbol, type } = req.body;

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

      const metadataCid = await pinJsonString(metadata);
      const artwork = { name, max, symbol, metadataUrl: `ipfs://ipfs/${metadataCid}`, url, type };

      try {
        const { id, blockHash } = await chain.addArtwork(galleryId, artistId, artwork);
        res.json({ id, blockHash });
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
    async (req, res) => {
      if (!validateRequest(req, res)) {
        return;
      }

      const { galleryId, artistId, collectorId, collection, num, ap } = req.body;
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

      const metadataCid = await pinJsonString(metadata);
      const certificate = { collection, num, ap, metadataUrl: `ipfs://ipfs/${metadataCid}` };

      try {
        const { id, mintedBlock, sentBlock } = await chain.createCertificate(
          galleryId,
          artistId,
          collectorId,
          certificate
        );
        res.json({ id, mintedBlock, sentBlock });
      } catch (err) {
        console.error(err);
        res.status(500).json({ errors: `${err}` });
      }
    }
  );

  app.post(
    "/transfer",
    body("galleryId").isInt(),
    body("ownerId").isInt(),
    body("destId").isInt(),
    body("certificateId").isString(),
    async (req, res) => {
      if (!validateRequest(req, res)) {
        return;
      }

      const { galleryId, ownerId, destId, certificateId } = req.body;

      try {
        const { blockHash } = await chain.sendCertificate(galleryId, ownerId, destId, certificateId);
        res.json({ blockHash });
      } catch (err) {
        console.error(err);
        res.status(500).json({ errors: `${err}` });
      }
    }
  );

  app.listen(SVC_PORT, () => {
    console.log(` >>> ✅ ${SVC_NAME} is running on port ${SVC_PORT}...`);
  });
}
