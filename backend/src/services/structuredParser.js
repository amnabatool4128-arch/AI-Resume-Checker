import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { env } from "../config/env.js";

// Create Gemini client only when API key exists
const client = env.geminiApiKey
  ? new GoogleGenAI({
      apiKey: env.geminiApiKey,
    })
  : null;

  console.log("Gemini configured:", !!env.geminiApiKey);
  console.log("Gemini model:", env.geminiModel);

// ----------------------------------------
// Gemini structured output schema
// ----------------------------------------

const linkSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    url: { type: "string" },
  },
  required: ["label", "url"],
};

const responseSchema = {
  type: "object",
  properties: {
    basics: {
      type: "object",
      properties: {
        name: { type: "string" },
        title: { type: "string" },
        location: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        links: {
          type: "array",
          items: linkSchema,
        },
      },
      required: ["name", "title", "location", "email", "phone", "links"],
    },

    summary: {
      type: "string",
    },

    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          location: { type: "string" },
          period: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["company", "role", "location", "period", "bullets"],
      },
    },

    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string" },
          school: { type: "string" },
          location: { type: "string" },
          period: { type: "string" },
          details: { type: "string" },
        },
        required: ["degree", "school", "location", "period", "details"],
      },
    },

    skills: {
      type: "array",
      items: { type: "string" },
    },

    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          techTags: {
            type: "array",
            items: { type: "string" },
          },
          links: {
            type: "array",
            items: linkSchema,
          },
        },
        required: ["name", "description", "techTags", "links"],
      },
    },

    certifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          issuer: { type: "string" },
          year: { type: "string" },
        },
        required: ["name", "issuer", "year"],
      },
    },

    languages: {
      type: "array",
      items: { type: "string" },
    },

    interests: {
      type: "array",
      items: { type: "string" },
    },
  },

  required: [
    "basics",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "interests",
  ],
};

// ----------------------------------------
// Zod validation
// ----------------------------------------

const linkZodSchema = z.object({
  label: z.string().default(""),
  url: z.string().default(""),
});

const parsedResumeSchema = z.object({
  basics: z
    .object({
      name: z.string().default(""),
      title: z.string().default(""),
      location: z.string().default(""),
      email: z.string().default(""),
      phone: z.string().default(""),
      links: z.array(linkZodSchema).default([]),
    })
    .default({}),

  summary: z.string().default(""),

  experience: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  education: z
    .array(
      z.object({
        degree: z.string().default(""),
        school: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        details: z.string().default(""),
      }),
    )
    .default([]),

  skills: z.array(z.string()).default([]),

  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        techTags: z.array(z.string()).default([]),
        links: z.array(linkZodSchema).default([]),
      }),
    )
    .default([]),

  certifications: z
    .array(
      z.object({
        name: z.string().default(""),
        issuer: z.string().default(""),
        year: z.string().default(""),
      }),
    )
    .default([]),

  languages: z.array(z.string()).default([]),

  interests: z.array(z.string()).default([]),
});

// ----------------------------------------
// Prompt
// ----------------------------------------

const buildPrompt = (resumeText) => `
You are an expert resume parser.

Your job is to extract structured information from the resume text below.

Extract these sections:
- basics
- summary
- experience
- education
- skills
- projects
- certifications
- languages
- interests

Rules:
1. Be conservative.
2. Only extract information that actually exists in the resume.
3. Do not invent or hallucinate information.
4. Do not paraphrase the original content unnecessarily.
5. Preserve dates exactly as they appear.
6. Preserve company names, job titles, school names and project names.
7. Keep bullet points close to their original wording.
8. If a section is missing, return an empty value.
9. Return only the requested structured JSON.

--- RESUME TEXT START ---

${resumeText}

--- RESUME TEXT END ---
`;

// ----------------------------------------
// Empty fallback
// ----------------------------------------

const emptyResume = () => ({
  basics: {
    name: "",
    title: "",
    location: "",
    email: "",
    phone: "",
    links: [],
  },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  interests: [],
});

// ----------------------------------------
// Public parser
// ----------------------------------------

export const parseResume = async (resumeText) => {
  if (!client || !resumeText?.trim()) {
    return emptyResume();
  }

  const prompt = buildPrompt(resumeText);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: env.geminiModel,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const raw = response.text;

      if (!raw) {
        throw new Error("Gemini returned an empty response");
      }

      const parsed = JSON.parse(raw);

      const validated = parsedResumeSchema.parse(parsed);

      return validated;
    } catch (error) {
      console.error(`Resume parsing attempt ${attempt} failed:`, error);

      if (attempt === 2) {
        return emptyResume();
      }
    }
  }

  return emptyResume();
};
