import { diffWords, diffLines } from "diff";

// ----------------------------------------
// Diff text
// ----------------------------------------

export const diffText = (oldText, newText, mode = "word") => {
  const oldValue = oldText || "";
  const newValue = newText || "";

  const changes =
    mode === "line"
      ? diffLines(oldValue, newValue)
      : diffWords(oldValue, newValue);

  return changes.map((part) => ({
    value: part.value,
    added: Boolean(part.added),
    removed: Boolean(part.removed),
  }));
};

// ----------------------------------------
// Summarize diff
// ----------------------------------------

export const summarizeDiff = (parts) => {
  let addedChars = 0;
  let removedChars = 0;

  for (const part of parts) {
    if (part.added) {
      addedChars += part.value.length;
    }

    if (part.removed) {
      removedChars += part.value.length;
    }
  }

  return {
    addedChars,
    removedChars,
  };
};
