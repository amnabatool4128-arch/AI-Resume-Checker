import mongoose from "mongoose";

const { Schema } = mongoose;

// Link: LinkedIn, GitHub, portfolio, etc.
const linkSchema = new Schema(
  {
    label: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

// Resume header/basic information
const basicsSchema = new Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    links: {
      type: [linkSchema],
      default: [],
    },
  },
  { _id: false },
);

// Work experience
const experienceItemSchema = new Schema(
  {
    company: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    period: {
      type: String,
      default: "",
      trim: true,
    },
    bullets: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

// Education
const educationItemSchema = new Schema(
  {
    degree: {
      type: String,
      default: "",
      trim: true,
    },
    school: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    period: {
      type: String,
      default: "",
      trim: true,
    },
    details: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

// Projects
const projectItemSchema = new Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    techTags: {
      type: [String],
      default: [],
    },
    links: {
      type: [linkSchema],
      default: [],
    },
  },
  { _id: false },
);

// Certifications
const certificationItemSchema = new Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },
    issuer: {
      type: String,
      default: "",
      trim: true,
    },
    year: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

// Complete parsed resume structure
const parsedSectionsSchema = new Schema(
  {
    basics: {
      type: basicsSchema,
      default: () => ({}),
    },

    summary: {
      type: String,
      default: "",
    },

    experience: {
      type: [experienceItemSchema],
      default: [],
    },

    education: {
      type: [educationItemSchema],
      default: [],
    },

    skills: {
      type: [String],
      default: [],
    },

    projects: {
      type: [projectItemSchema],
      default: [],
    },

    certifications: {
      type: [certificationItemSchema],
      default: [],
    },

    languages: {
      type: [String],
      default: [],
    },

    interests: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

// Main Resume Version schema
const resumeVersionSchema = new Schema(
  {
    resume: {
      type: Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true,
    },

    versionNumber: {
      type: Number,
      required: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    rawText: {
      type: String,
      default: "",
    },

    parsedSections: {
      type: parsedSectionsSchema,
      default: () => ({}),
    },

    sourceType: {
      type: String,
      enum: ["upload", "rewrite"],
      required: true,
    },

    parentVersionId: {
      type: Schema.Types.ObjectId,
      ref: "ResumeVersion",
      default: null,
    },

    latestAnalysisId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Same resume cannot have two versions with the same number
resumeVersionSchema.index({ resume: 1, versionNumber: 1 }, { unique: true });

const ResumeVersion = mongoose.model("ResumeVersion", resumeVersionSchema);

export default ResumeVersion;
