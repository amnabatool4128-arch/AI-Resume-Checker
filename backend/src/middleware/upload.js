import multer from "multer";
import { ApiError } from "../utils/apiError.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(ApiError.badRequest("Only PDF files are allowed"), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

export const uploadPdf = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return next(ApiError.badRequest("PDF exceeds 5 MB limit"));
        }

        return next(ApiError.badRequest(error.message));
      }

      return next(error);
    }

    if (!req.file) {
      return next(ApiError.badRequest("PDF file is required"));
    }

    next();
  });
};
