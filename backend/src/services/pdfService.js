import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { ApiError } from "../utils/apiError.js";

export const extractText = async (buffer) => {
  try {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw ApiError.badRequest("Invalid PDF buffer");
    }

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: pages, totalPages } = await extractPdfText(pdf, {
      mergePages: true,
    });

    const text = pages?.trim() || "";

    if (text.length < 50) {
      throw ApiError.badRequest(
        "Could not extract enough text from this PDF. It may be scanned or image-only. OCR is not supported yet.",
      );
    }

    return {
      text,
      meta: {
        pages: totalPages || 0,
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw ApiError.badRequest(
      `Failed to extract text from PDF: ${error.message}`,
    );
  }
};
