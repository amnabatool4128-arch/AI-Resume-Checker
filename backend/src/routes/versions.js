import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import Resume from "../models/resumes.js";
import ResumeVersion from "../models/resumeVersion.js";
import Analysis from "../models/analysis.js";

const router = express.Router();

// Every versions route requires authentication
router.use(requireAuth);

// ----------------------------------------
// Get all resume versions
// ----------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    // Get all user's resumes
    const resumes = await Resume.find({
      user: req.user._id,
    })
      .select("_id title")
      .sort({
        updatedAt: -1,
      })
      .lean();

    const resumeIds = resumes.map((resume) => resume._id);

    // Get all versions and analyses in parallel
    const [versions, analyses] = await Promise.all([
      ResumeVersion.find({
        resume: { $in: resumeIds },
      })
        .select(
          "_id resume versionNumber label sourceType parentVersionId createdAt updatedAt",
        )
        .sort({
          createdAt: -1,
        })
        .lean(),

      Analysis.find({
        user: req.user._id,
      })
        .select("_id resume version atsScore createdAt")
        .lean(),
    ]);

    // ----------------------------------------
    // Resume lookup map
    // ----------------------------------------

    const resumeMap = new Map(
      resumes.map((resume) => [resume._id.toString(), resume]),
    );

    // ----------------------------------------
    // Score lookup map
    // ----------------------------------------

    const scoreMap = new Map();

    for (const analysis of analyses) {
      scoreMap.set(analysis.version.toString(), {
        score: analysis.atsScore,
        analysisId: analysis._id,
      });
    }

    // ----------------------------------------
    // Shape versions into rows
    // ----------------------------------------

    const rows = versions.map((version) => {
      const resume = resumeMap.get(version.resume.toString());

      const scoreInfo = scoreMap.get(version._id.toString());

      return {
        id: version._id,

        resumeId: version.resume,

        resumeTitle: resume?.title || "Untitled Resume",

        versionNumber: version.versionNumber,

        label: version.label,

        sourceType: version.sourceType,

        score: scoreInfo?.score ?? null,

        analysisId: scoreInfo?.analysisId ?? null,

        parentVersionId: version.parentVersionId,

        createdAt: version.createdAt,

        updatedAt: version.updatedAt,
      };
    });

    // ----------------------------------------
    // Totals
    // ----------------------------------------

    const totalVersions = rows.length;

    const uploads = rows.filter(
      (version) => version.sourceType === "upload",
    ).length;

    const rewrites = rows.filter(
      (version) => version.sourceType === "rewrite",
    ).length;

    // ----------------------------------------
    // Response
    // ----------------------------------------

    res.json({
      versions: rows,

      totals: {
        totalVersions,
        uploads,
        rewrites,
      },
    });
  }),
);

export default router;
