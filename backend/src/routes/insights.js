import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import Resume from "../models/resumes.js";
import Analysis from "../models/analysis.js";

const router = express.Router();

// Every insights route requires authentication
router.use(requireAuth);

// ----------------------------------------
// Helper: Top frequent items
// ----------------------------------------

const getTopItems = (items, getKey, limit) => {
  const counts = new Map();
  const samples = new Map();

  for (const item of items) {
    const key = getKey(item);

    if (!key) continue;

    counts.set(key, (counts.get(key) || 0) + 1);

    if (!samples.has(key)) {
      samples.set(key, item);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      count,
      sample: samples.get(key),
    }));
};

// ----------------------------------------
// Get Resume Insights
// ----------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    // Get user's resumes
    const resumes = await Resume.find({
      user: req.user._id,
    }).sort({
      updatedAt: -1,
    });

    // Get all analyses of the user
    const analyses = await Analysis.find({
      user: req.user._id,
    })
      .sort({
        createdAt: 1,
      })
      .lean();

    // No analyses yet
    if (analyses.length === 0) {
      return res.json({
        empty: true,
        averageScore: 0,
        bestScore: null,
        scoreTrend: [],
        topIssues: [],
        topMissingKeywords: [],
        topPresentKeywords: [],
        resumePerformance: [],
      });
    }

    // ----------------------------------------
    // Average ATS score
    // ----------------------------------------

    const totalScore = analyses.reduce(
      (sum, analysis) => sum + analysis.atsScore,
      0,
    );

    const averageScore = Math.round(totalScore / analyses.length);

    // ----------------------------------------
    // Best score
    // ----------------------------------------

    const bestAnalysis = analyses.reduce((best, current) => {
      if (!best || current.atsScore > best.atsScore) {
        return current;
      }

      return best;
    }, null);

    const bestResume = bestAnalysis
      ? resumes.find(
          (resume) => resume._id.toString() === bestAnalysis.resume.toString(),
        )
      : null;

    const bestScore = bestAnalysis
      ? {
          score: bestAnalysis.atsScore,
          analysisId: bestAnalysis._id,
          resumeId: bestAnalysis.resume,
          resumeTitle: bestResume?.title || "Untitled Resume",
        }
      : null;

    // ----------------------------------------
    // Chronological score trend
    // ----------------------------------------

    const scoreTrend = analyses.map((analysis) => {
      const resume = resumes.find(
        (resume) => resume._id.toString() === analysis.resume.toString(),
      );

      return {
        date: analysis.createdAt,
        score: analysis.atsScore,
        resumeId: analysis.resume,
        resumeTitle: resume?.title || "Untitled Resume",
      };
    });

    // ----------------------------------------
    // Top recurring issues
    // ----------------------------------------

    const allIssues = analyses.flatMap((analysis) => analysis.issues || []);

    const topIssues = getTopItems(allIssues, (issue) => issue.title, 6);

    // ----------------------------------------
    // Top missing keywords
    // ----------------------------------------

    const allMissingKeywords = analyses.flatMap(
      (analysis) => analysis.keywordsMissing || [],
    );

    const topMissingKeywords = getTopItems(
      allMissingKeywords,
      (keyword) => keyword,
      12,
    );

    // ----------------------------------------
    // Top present keywords
    // ----------------------------------------

    const allPresentKeywords = analyses.flatMap(
      (analysis) => analysis.keywordsPresent || [],
    );

    const topPresentKeywords = getTopItems(
      allPresentKeywords,
      (keyword) => keyword,
      12,
    );

    // ----------------------------------------
    // Per-resume performance
    // ----------------------------------------

    const resumePerformance = resumes.map((resume) => {
      const resumeAnalyses = analyses.filter(
        (analysis) => analysis.resume.toString() === resume._id.toString(),
      );

      if (resumeAnalyses.length === 0) {
        return {
          resumeId: resume._id,
          title: resume.title,
          latestScore: null,
          bestScore: null,
          improvementDelta: null,
        };
      }

      const latestAnalysis = resumeAnalyses[resumeAnalyses.length - 1];

      const firstAnalysis = resumeAnalyses[0];

      const bestResumeAnalysis = resumeAnalyses.reduce((best, current) =>
        current.atsScore > best.atsScore ? current : best,
      );

      return {
        resumeId: resume._id,
        title: resume.title,

        latestScore: latestAnalysis.atsScore,

        bestScore: bestResumeAnalysis.atsScore,

        improvementDelta: latestAnalysis.atsScore - firstAnalysis.atsScore,
      };
    });

    // ----------------------------------------
    // Response
    // ----------------------------------------

    res.json({
      empty: false,

      averageScore,

      bestScore,

      scoreTrend,

      topIssues,

      topMissingKeywords,

      topPresentKeywords,

      resumePerformance,
    });
  }),
);

export default router;
