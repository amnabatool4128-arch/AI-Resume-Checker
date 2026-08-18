import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import Resume from "../models/resumes.js";
import ResumeVersion from "../models/resumeVersion.js";
import Analysis from "../models/analysis.js";

const router = express.Router();

// Every dashboard route requires authentication
router.use(requireAuth);

// ----------------------------------------
// Dashboard
// ----------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // ----------------------------------------
    // 1. Get user's resumes
    // ----------------------------------------

    const resumes = await Resume.find({
      user: userId,
    })
      .sort({
        updatedAt: -1,
      })
      .lean();

    const resumeIds = resumes.map((resume) => resume._id);

    // ----------------------------------------
    // 2. Get versions and analyses
    // ----------------------------------------

    const [versions, analyses] = await Promise.all([
      ResumeVersion.find({
        resume: { $in: resumeIds },
      })
        .sort({
          createdAt: 1,
        })
        .lean(),

      Analysis.find({
        user: userId,
      })
        .sort({
          createdAt: 1,
        })
        .lean(),
    ]);

    // ----------------------------------------
    // 3. Basic totals
    // ----------------------------------------

    const totalVersions = versions.length;
    const totalAnalyses = analyses.length;

    // ----------------------------------------
    // 4. Latest resume
    // ----------------------------------------

    const latestResume = resumes[0] || null;

    let latestResumeVersions = [];

    if (latestResume) {
      latestResumeVersions = versions
        .filter(
          (version) =>
            version.resume.toString() === latestResume._id.toString(),
        )
        .sort((a, b) => a.versionNumber - b.versionNumber);
    }

    // ----------------------------------------
    // 5. Score lookup for versions
    // ----------------------------------------

    const analysisByVersion = new Map();

    for (const analysis of analyses) {
      analysisByVersion.set(analysis.version.toString(), analysis);
    }

    // ----------------------------------------
    // 6. Score evolution chart
    // ----------------------------------------

    const scoreSeries = latestResumeVersions
      .map((version) => {
        const analysis = analysisByVersion.get(version._id.toString());

        if (!analysis) {
          return null;
        }

        return {
          versionId: version._id,
          versionNumber: version.versionNumber,
          label: version.label,
          score: analysis.atsScore,
          createdAt: version.createdAt,
        };
      })
      .filter(Boolean);

    // ----------------------------------------
    // 7. Latest three versions
    // ----------------------------------------

    const lastThreeVersions = [...latestResumeVersions]
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .slice(0, 3);

    const versionStack = lastThreeVersions.map((version) => {
      const analysis = analysisByVersion.get(version._id.toString());

      const currentScore = analysis?.atsScore ?? null;

      const previousVersion = latestResumeVersions.find(
        (item) => item.versionNumber === version.versionNumber - 1,
      );

      const previousAnalysis = previousVersion
        ? analysisByVersion.get(previousVersion._id.toString())
        : null;

      const previousScore = previousAnalysis?.atsScore ?? null;

      const delta =
        currentScore !== null && previousScore !== null
          ? currentScore - previousScore
          : null;

      return {
        id: version._id,
        versionNumber: version.versionNumber,
        label: version.label,
        score: currentScore,
        delta,
        sourceType: version.sourceType,
        createdAt: version.createdAt,
      };
    });

    // ----------------------------------------
    // 8. Latest analysis
    // ----------------------------------------

    const latestAnalysis = analyses[analyses.length - 1] || null;

    const previousAnalysis =
      analyses.length > 1 ? analyses[analyses.length - 2] : null;

    // ATS score delta
    const atsScore = latestAnalysis?.atsScore ?? null;

    const atsScoreDelta =
      latestAnalysis && previousAnalysis
        ? latestAnalysis.atsScore - previousAnalysis.atsScore
        : null;

    // Issues count
    const issuesCount = latestAnalysis?.issues?.length ?? 0;

    // Keywords matched
    const keywordsMatched = latestAnalysis?.keywordsPresent?.length ?? 0;

    // ----------------------------------------
    // 9. Sparkline helper
    // ----------------------------------------

    const makeSparkline = (values) => {
      const cleaned = values
        .filter((value) => typeof value === "number")
        .slice(-10);

      if (cleaned.length === 0) {
        return Array(10).fill(0);
      }

      if (cleaned.length >= 10) {
        return cleaned;
      }

      const padding = Array(10 - cleaned.length).fill(cleaned[0]);

      return [...padding, ...cleaned];
    };

    // ----------------------------------------
    // 10. KPI sparklines
    // ----------------------------------------

    const scoreValues = analyses.map((analysis) => analysis.atsScore);

    const versionValues = versions.map((version) => version.versionNumber);

    const issueValues = analyses.map(
      (analysis) => analysis.issues?.length ?? 0,
    );

    const keywordValues = analyses.map(
      (analysis) => analysis.keywordsPresent?.length ?? 0,
    );

    const kpis = {
      atsScore: {
        value: atsScore,
        delta: atsScoreDelta,
        sparkline: makeSparkline(scoreValues),
      },

      totalVersions: {
        value: totalVersions,
        delta: null,
        sparkline: makeSparkline(versionValues),
      },

      issues: {
        value: issuesCount,
        delta: null,
        sparkline: makeSparkline(issueValues),
      },

      keywordsMatched: {
        value: keywordsMatched,
        delta: null,
        sparkline: makeSparkline(keywordValues),
      },
    };

    // ----------------------------------------
    // 11. Activity feed
    // ----------------------------------------

    const versionActivities = versions.map((version) => ({
      type: version.sourceType === "upload" ? "upload" : "rewrite",
      id: version._id,
      resumeId: version.resume,
      versionId: version._id,
      label: version.label,
      versionNumber: version.versionNumber,
      timestamp: version.createdAt,
    }));

    const analysisActivities = analyses.map((analysis) => ({
      type: "analysis",
      id: analysis._id,
      resumeId: analysis.resume,
      versionId: analysis.version,
      score: analysis.atsScore,
      timestamp: analysis.createdAt,
    }));

    const activity = [...versionActivities, ...analysisActivities]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 8);

    // ----------------------------------------
    // 12. Response
    // ----------------------------------------

    res.json({
      summary: {
        totalResumes: resumes.length,
        totalVersions,
        totalAnalyses,
      },

      latestResume: latestResume
        ? {
            id: latestResume._id,
            title: latestResume.title,
            currentVersionId: latestResume.currentVersionId,
            latestVersionNumber: latestResume.latestVersionNumber,
            updatedAt: latestResume.updatedAt,
          }
        : null,

      kpis,

      scoreSeries,

      versionStack,

      activity,
    });
  }),
);

export default router;
