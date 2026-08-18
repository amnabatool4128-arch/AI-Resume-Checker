import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    currentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    latestVersionNumber: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Fast lookup of user's resumes
resumeSchema.index({ user: 1 });

// Sort user's resumes by most recently updated
resumeSchema.index({ user: 1, updatedAt: -1 });

const Resume = mongoose.model("Resume", resumeSchema);

export default Resume;
