import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { isJSDocVariadicType } from "typescript";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const { Buffer } = require('node:buffer');
const path = require('node:path');

const MAX_UPLOAD_SIZE = 10 << 20; // 10 MB bitshift operation

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here
  const formData = await req.formData();
  const file = formData.get("thumbnail");

  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail must be a file");
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Thumbnail file is too large");
  }

  const mediaType = file.type;
  if (mediaType !== 'image/jpeg' && mediaType !== 'image/png') {
    throw new BadRequestError("Thumbnail must be a JPEG or PNG image");
  }

  const buffer = await file.arrayBuffer();
  const nodeBuffer = Buffer.from(buffer); // Convert ArrayBuffer to Node.js Buffer

  const videoMetadata = getVideo(cfg.db, videoId);

  if (videoMetadata?.userID !== userID) {
    throw new UserForbiddenError("Not authorized to upload thumbnail for this video");
  }

  //`/assets/${videoId}.${mediaType}`;
  const root = path.join(cfg.assetsRoot, videoId) + `.${mediaType.split('/')[1]}`;
  const thumbnailURL = `http://localhost:${cfg.port}/${root}`;
  videoMetadata.thumbnailURL = thumbnailURL;
  await Bun.write(root, nodeBuffer);

  updateVideo(cfg.db, videoMetadata)
  return respondWithJSON(200, videoMetadata);
}
