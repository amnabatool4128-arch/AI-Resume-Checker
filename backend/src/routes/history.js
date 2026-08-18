import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import Resume from "../models/resumes.js";
import ResumeVersion from "../models/resumeVersion.js";
import Analysis from "../models/analysis.js";

const router = express.Router();

// Every history route requires authentication
router.use(requireAuth);

// ----------------------------------------
// Get account history
// ----------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    // Fetch all required data in parallel
    const resumes = await Resume.find({
      user: req.user._id,
    })
      .select("_id title createdAt updatedAt")
      .lean();

    const resumeIds = resumes.map((resume) => resume._id);

    const [versions, analyses] = await Promise.all([
      ResumeVersion.find({
        resume: { $in: resumeIds },
      })
        .select("_id resume versionNumber label sourceType createdAt updatedAt")
        .lean(),

      Analysis.find({
        user: req.user._id,
      })
        .select("_id resume version atsScore createdAt")
        .lean(),
    ]);

    // ----------------------------------------
    // Resume lookup
    // ----------------------------------------

    const resumeMap = new Map(
      resumes.map((resume) => [resume._id.toString(), resume]),
    );

    // ----------------------------------------
    // Build upload events
    // ----------------------------------------

    const uploadEvents = resumes.map((resume) => ({
      type: "upload",
      title: `Uploaded ${resume.title}`,
      subtitle: "New resume uploaded",
      label: "Upload",
      at: resume.createdAt,
      resumeId: resume._id,
    }));

    // ----------------------------------------
    // Build rewrite events
    // ----------------------------------------

    const rewriteEvents = versions
      .filter((version) => version.sourceType === "rewrite")
      .map((version) => {
        const resume = resumeMap.get(version.resume.toString());

        return {
          type: "rewrite",
          title: `Created ${version.label}`,
          subtitle: resume?.title || "Resume",
          label: "Rewrite",
          at: version.createdAt,
          resumeId: version.resume,
          versionId: version._id,
        };
      });

    // ----------------------------------------
    // Build analysis events
    // ----------------------------------------

    const analysisEvents = analyses.map((analysis) => {
      const resume = resumeMap.get(analysis.resume.toString());

      return {
        type: "analyze",
        title: `Analyzed ${resume?.title || "Resume"}`,
        subtitle: `ATS Score: ${analysis.atsScore}`,
        label: "Analysis",
        at: analysis.createdAt,
        resumeId: analysis.resume,
        versionId: analysis.version,
        analysisId: analysis._id,
      };
    });

    // ----------------------------------------
    // Combine all events
    // ----------------------------------------

    const events = [...uploadEvents, ...rewriteEvents, ...analysisEvents].sort(
      (a, b) => new Date(b.at) - new Date(a.at),
    );

    // ----------------------------------------
    // Totals by event type
    // ----------------------------------------

    const totals = {
      all: events.length,
      uploads: uploadEvents.length,
      analyses: analysisEvents.length,
      rewrites: rewriteEvents.length,
    };

    // ----------------------------------------
    // Response
    // ----------------------------------------

    res.json({
      events,
      totals,
    });
  }),
);

export default router;
