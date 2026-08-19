import { PDFParse } from "pdf-parse";
import { ApiError } from "../utils/apiError.js";

export const extractText = async (buffer) => {
  try {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw ApiError.badRequest("Invalid PDF buffer");
    }

    const parser = new PDFParse({
      data: buffer,
    });

    const result = await parser.getText();

    const text = result.text?.trim() || "";

    await parser.destroy();

    if (text.length < 50) {
      throw ApiError.badRequest(
        "Could not extract enough text from this PDF. It may be scanned or image-only. OCR is not supported yet.",
      );
    }

    return {
      text,
      meta: {
        pages: result.total || 0,
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
