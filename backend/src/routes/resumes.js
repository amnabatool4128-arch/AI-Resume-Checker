import express from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { uploadPdf } from "../middleware/upload.js";
import { analyzeLimiter } from "../middleware/rateLimit.js";

import Resume from "../models/resumes.js";
import ResumeVersion from "../models/resumeVersion.js";
import Analysis from "../models/analysis.js";

import { extractText } from "../services/pdfService.js";
import { parseResume } from "../services/structuredParser.js";
import { analyzeResume } from "../services/gemini.js";
import { diffText, summarizeDiff } from "../services/diffService.js";

import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

// Every resume route requires authentication
router.use(requireAuth);

// ----------------------------------------
// Validation schemas
// ----------------------------------------

const objectIdSchema = z
  .string()
  .refine((value) => mongoose.isValidObjectId(value), {
    message: "Invalid ID",
  });

const idParamSchema = z.object({
  id: objectIdSchema,
});

const analyzeBodySchema = z.object({
  versionId: objectIdSchema.optional(),
  targetRole: z.string().trim().optional(),
});

const rewriteBodySchema = z.object({
  analysisId: objectIdSchema,
  rewriteIds: z.array(objectIdSchema).optional().default([]),
  label: z.string().trim().max(100).optional(),
});

// ----------------------------------------
// Helpers
// ----------------------------------------

const loadOwnedResume = async (resumeId, userId) => {
  const resume = await Resume.findOne({
    _id: resumeId,
    user: userId,
  });

  if (!resume) {
    throw ApiError.notFound("Resume not found");
  }

  return resume;
};

const loadOwnedVersion = async (versionId, userId) => {
  const version = await ResumeVersion.findById(versionId);

  if (!version) {
    throw ApiError.notFound("Resume version not found");
  }

  await loadOwnedResume(version.resume, userId);

  return version;
};

const applyRewritesToText = (rawText, rewrites) => {
  let text = rawText;

  for (const rewrite of rewrites) {
    if (!rewrite.originalText || !rewrite.rewrittenText) {
      continue;
    }

    if (text.includes(rewrite.originalText)) {
      text = text.replace(rewrite.originalText, rewrite.rewrittenText);
    }
  }

  return text;
};

const patchParsedSections = (parsedSections, rewrites) => {
  const patched = JSON.parse(JSON.stringify(parsedSections || {}));

  for (const rewrite of rewrites) {
    const original = rewrite.originalText;
    const rewritten = rewrite.rewrittenText;

    // Experience bullets
    for (const experience of patched.experience || []) {
      experience.bullets = (experience.bullets || []).map((bullet) =>
        bullet === original ? rewritten : bullet,
      );
    }

    // Projects descriptions
    for (const project of patched.projects || []) {
      if (project.description === original) {
        project.description = rewritten;
      }
    }

    // Summary
    if (patched.summary === original) {
      patched.summary = rewritten;
    }
  }

  return patched;
};

const isParsedSectionsEmpty = (parsed) => {
  if (!parsed) return true;

  const hasIdentity =
    Boolean(parsed.basics?.name) || Boolean(parsed.basics?.title);

  const hasBody =
    Boolean(parsed.summary) ||
    (parsed.experience?.length || 0) > 0 ||
    (parsed.education?.length || 0) > 0 ||
    (parsed.skills?.length || 0) > 0 ||
    (parsed.projects?.length || 0) > 0;

  return !hasIdentity && !hasBody;
};

// ----------------------------------------
// Upload resume
// ----------------------------------------

router.post(
  "/",
  uploadPdf,
  asyncHandler(async (req, res) => {
    const title =
      req.body.title?.trim() ||
      req.file.originalname.replace(/\.pdf$/i, "") ||
      "Untitled Resume";

    // Extract text from PDF
    const { text, meta } = await extractText(req.file.buffer);

    // Parse resume text using Gemini
    const parsedSections = await parseResume(text);

    // Create resume container
    const resume = await Resume.create({
      user: req.user._id,
      title,
      latestVersionNumber: 1,
    });

    // Create first version
    const version = await ResumeVersion.create({
      resume: resume._id,
      versionNumber: 1,
      label: "V1",
      rawText: text,
      parsedSections,
      sourceType: "upload",
      parentVersionId: null,
      latestAnalysisId: null,
    });

    // Point resume to current version
    resume.currentVersionId = version._id;

    await resume.save();

    res.status(201).json({
      resume,
      version,
      meta,
    });
  }),
);

// ----------------------------------------
// List user's resumes
// ----------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({
      user: req.user._id,
    }).sort({
      updatedAt: -1,
    });

    res.json({
      resumes,
    });
  }),
);

// ----------------------------------------
// Get one resume with all versions
// ----------------------------------------

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const resume = await loadOwnedResume(id, req.user._id);

    const versions = await ResumeVersion.find({
      resume: resume._id,
    })
      .select("-rawText")
      .sort({
        versionNumber: -1,
      });

    res.json({
      resume,
      versions,
    });
  }),
);

// ----------------------------------------
// Get one full version
// ----------------------------------------

router.get(
  "/:id/versions/:versionId",
  asyncHandler(async (req, res) => {
    const { id, versionId } = z
      .object({
        id: objectIdSchema,
        versionId: objectIdSchema,
      })
      .parse(req.params);

    const resume = await loadOwnedResume(id, req.user._id);

    const version = await ResumeVersion.findOne({
      _id: versionId,
      resume: resume._id,
    });

    if (!version) {
      throw ApiError.notFound("Resume version not found");
    }

    res.json({
      version,
    });
  }),
);

// ----------------------------------------
// Get analysis for a specific version
// ----------------------------------------

router.get(
  "/:id/versions/:versionId/analysis",
  asyncHandler(async (req, res) => {
    const { id, versionId } = z
      .object({
        id: objectIdSchema,
        versionId: objectIdSchema,
      })
      .parse(req.params);

    const resume = await loadOwnedResume(id, req.user._id);

    const version = await ResumeVersion.findOne({
      _id: versionId,
      resume: resume._id,
    });

    if (!version) {
      throw ApiError.notFound("Resume version not found");
    }

    const analysis = await Analysis.findOne({
      user: req.user._id,
      resume: resume._id,
      version: version._id,
    }).sort({
      createdAt: -1,
    });

    if (!analysis) {
      throw ApiError.notFound("No analysis for this version");
    }

    res.json({
      analysis,
    });
  }),
);

// ----------------------------------------
// Analyze resume
// ----------------------------------------

router.post(
  "/:id/analyze",
  analyzeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const { versionId, targetRole } = analyzeBodySchema.parse(req.body);

    const resume = await loadOwnedResume(id, req.user._id);

    const selectedVersionId = versionId || resume.currentVersionId;

    if (!selectedVersionId) {
      throw ApiError.badRequest("Resume has no current version");
    }

    const version = await loadOwnedVersion(selectedVersionId, req.user._id);

    const result = await analyzeResume(version.rawText, targetRole);

    const analysis = await Analysis.create({
      user: req.user._id,
      resume: resume._id,
      version: version._id,

      atsScore: result.analysis.atsScore,

      scoreBreakdown: result.analysis.scoreBreakdown,

      issues: result.analysis.issues,

      strengths: result.analysis.strengths,

      bulletRewrites: result.analysis.bulletRewrites,

      keywordsPresent: result.analysis.keywordsPresent,

      keywordsMissing: result.analysis.keywordsMissing,

      summaryVerdict: result.analysis.summaryVerdict,

      modelName: result.modelName,

      promptTokens: result.usage?.promptTokens || 0,

      responseTokens: result.usage?.responseTokens || 0,
    });

    version.latestAnalysisId = analysis._id;

    await version.save();

    res.status(201).json({
      analysis,
    });
  }),
);

// ----------------------------------------
// Get all analyses for a resume
// ----------------------------------------

router.get(
  "/:id/analyses",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const resume = await loadOwnedResume(id, req.user._id);

    const analyses = await Analysis.find({
      user: req.user._id,
      resume: resume._id,
    }).sort({
      createdAt: -1,
    });

    res.json({
      analyses,
    });
  }),
);

// ----------------------------------------
// Rewrite resume
// ----------------------------------------

router.post(
  "/:id/rewrite",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const { analysisId, rewriteIds, label } = rewriteBodySchema.parse(req.body);

    const resume = await loadOwnedResume(id, req.user._id);

    const analysis = await Analysis.findOne({
      _id: analysisId,
      resume: resume._id,
      user: req.user._id,
    });

    if (!analysis) {
      throw ApiError.notFound("Analysis not found");
    }

    const baseVersion = await ResumeVersion.findOne({
      _id: analysis.version,
      resume: resume._id,
    });

    if (!baseVersion) {
      throw ApiError.notFound("Analysis version not found");
    }

    const allRewrites = analysis.bulletRewrites || [];

    const selectedRewrites =
      rewriteIds.length > 0
        ? allRewrites.filter((rewrite) =>
            rewriteIds.includes(rewrite._id.toString()),
          )
        : allRewrites;

    if (selectedRewrites.length === 0) {
      throw ApiError.badRequest("No rewrites selected");
    }

    // Apply rewrites to raw text
    const rewrittenText = applyRewritesToText(
      baseVersion.rawText,
      selectedRewrites,
    );

    // Safety fallback
    const patchedSections = patchParsedSections(
      baseVersion.parsedSections,
      selectedRewrites,
    );

    let parsedSections;

    try {
      parsedSections = await parseResume(rewrittenText);
    } catch (error) {
      console.error("Rewrite parsing failed, using fallback:", error);

      parsedSections = patchedSections;
    }

    if (isParsedSectionsEmpty(parsedSections)) {
      parsedSections = patchedSections;
    }

    // Create next version
    const nextVersionNumber = resume.latestVersionNumber + 1;

    const newVersion = await ResumeVersion.create({
      resume: resume._id,

      versionNumber: nextVersionNumber,

      label: label || `V${nextVersionNumber}`,

      rawText: rewrittenText,

      parsedSections,

      sourceType: "rewrite",

      parentVersionId: baseVersion._id,

      latestAnalysisId: null,
    });

    // Update current version
    resume.currentVersionId = newVersion._id;

    resume.latestVersionNumber = nextVersionNumber;

    await resume.save();

    res.status(201).json({
      version: newVersion,
      appliedRewrites: selectedRewrites.length,
    });
  }),
);

// ----------------------------------------
// Diff two versions
// ----------------------------------------

router.get(
  "/:id/diff",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const { from, to, mode } = z
      .object({
        from: objectIdSchema,
        to: objectIdSchema,
        mode: z.enum(["word", "line"]).default("word"),
      })
      .parse(req.query);

    const resume = await loadOwnedResume(id, req.user._id);

    const [fromVersion, toVersion] = await Promise.all([
      ResumeVersion.findOne({
        _id: from,
        resume: resume._id,
      }),

      ResumeVersion.findOne({
        _id: to,
        resume: resume._id,
      }),
    ]);

    if (!fromVersion) {
      throw ApiError.notFound("From version not found");
    }

    if (!toVersion) {
      throw ApiError.notFound("To version not found");
    }

    const parts = diffText(fromVersion.rawText, toVersion.rawText, mode);

    const summary = summarizeDiff(parts);

    res.json({
      from: {
        id: fromVersion._id,
        versionNumber: fromVersion.versionNumber,
        label: fromVersion.label,
      },

      to: {
        id: toVersion._id,
        versionNumber: toVersion.versionNumber,
        label: toVersion.label,
      },

      mode,

      parts,

      summary,
    });
  }),
);

// ----------------------------------------
// Delete resume
// ----------------------------------------

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const resume = await loadOwnedResume(id, req.user._id);

    await ResumeVersion.deleteMany({
      resume: resume._id,
    });

    await Analysis.deleteMany({
      resume: resume._id,
      user: req.user._id,
    });

    await Resume.deleteOne({
      _id: resume._id,
    });

    res.json({
      message: "Resume deleted successfully",
    });
  }),
);

export default router;
