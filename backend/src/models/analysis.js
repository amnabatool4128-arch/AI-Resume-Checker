
import mongoose from "mongoose";

// ----------------------------------------
// Issue schema
// ----------------------------------------

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: true,
    },

    explanation: {
      type: String,
      required: true,
    },

    fix: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  },
);

// ----------------------------------------
// Strength schema
// ----------------------------------------

const strengthSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    evidence: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  },
);

// ----------------------------------------
// Bullet rewrite schema
// ----------------------------------------

const bulletRewriteSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      required: true,
    },

    originalText: {
      type: String,
      required: true,
    },

    rewrittenText: {
      type: String,
      required: true,
    },

    rationale: {
      type: String,
      required: true,
    },
  },
  {
    _id: true,
  },
);

// ----------------------------------------
// Score breakdown schema
// ----------------------------------------

const scoreBreakdownSchema = new mongoose.Schema(
  {
    keywords: {
      type: Number,
      min: 0,
      max: 25,
      required: true,
    },

    formatting: {
      type: Number,
      min: 0,
      max: 25,
      required: true,
    },

    impact: {
      type: Number,
      min: 0,
      max: 25,
      required: true,
    },

    clarity: {
      type: Number,
      min: 0,
      max: 25,
      required: true,
    },
  },
  {
    _id: false,
  },
);

// ----------------------------------------
// Main analysis schema
// ----------------------------------------

const analysisSchema = new mongoose.Schema(
  {
    // User who owns this analysis
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Resume being analyzed
    resume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true,
    },

    // Specific resume version that was analyzed
    version: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumeVersion",
      required: true,
      index: true,
    },

    // Overall ATS score
    atsScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },

    // Score breakdown
    scoreBreakdown: {
      type: scoreBreakdownSchema,
      required: true,
    },

    // Resume issues
    issues: {
      type: [issueSchema],
      default: [],
    },

    // Resume strengths
    strengths: {
      type: [strengthSchema],
      default: [],
    },

    // Suggested bullet rewrites
    bulletRewrites: {
      type: [bulletRewriteSchema],
      default: [],
    },

    // Keywords already present in resume
    keywordsPresent: {
      type: [String],
      default: [],
    },

    // Keywords missing from resume
    keywordsMissing: {
      type: [String],
      default: [],
    },

    // Overall AI verdict
    summaryVerdict: {
      type: String,
      default: "",
    },

    // Gemini model used
    modelName: {
      type: String,
      required: true,
    },

    // Token usage
    promptTokens: {
      type: Number,
      default: 0,
    },

    responseTokens: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// ----------------------------------------
// Indexes
// ----------------------------------------

analysisSchema.index({
  user: 1,
  createdAt: -1,
});

analysisSchema.index({
  resume: 1,
  version: 1,
});

const Analysis = mongoose.model("Analysis", analysisSchema);

export default Analysis;

