/**
 * Testdata Management Utilities
 *
 * Handles testdata file operations including ZIP extraction.
 */

import JSZip from "jszip";
import {
  uploadTestcaseFile,
  deleteTestcase,
  listTestcases,
} from "./s3.server";
import { updateProblem } from "./db/problems.server";

/**
 * Extracted testcase from ZIP
 */
interface ExtractedTestcase {
  number: number;
  input: Buffer;
  output: Buffer;
}

/**
 * Validation result for testcase extraction
 */
interface ExtractionResult {
  success: boolean;
  testcases: ExtractedTestcase[];
  errors: string[];
  warnings: string[];
}

/**
 * Extract and validate testcases from a ZIP file
 *
 * Expected ZIP structure:
 * - {n}.in and {n}.out files at root or in a single subdirectory
 * - Files must be paired (both .in and .out)
 * - Numbers should be sequential starting from 1
 */
export async function extractTestcasesFromZip(
  zipBuffer: Buffer
): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Find all .in and .out files
  const inputFiles = new Map<number, JSZip.JSZipObject>();
  const outputFiles = new Map<number, JSZip.JSZipObject>();

  // Check for common patterns
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    // Get filename (handle files in subdirectories)
    const filename = path.split("/").pop()!;

    // Match patterns like: 1.in, 01.in, input1.txt, etc.
    const inMatch = filename.match(/^(?:input)?(\d+)\.(?:in|txt)$/i);
    const outMatch = filename.match(/^(?:output)?(\d+)\.(?:out|ans|txt)$/i);

    // Also support standard format: just numbers
    const simpleMatch = filename.match(/^(\d+)\.(in|out)$/);

    if (simpleMatch) {
      const num = parseInt(simpleMatch[1], 10);
      const type = simpleMatch[2];
      if (type === "in") {
        inputFiles.set(num, file);
      } else {
        outputFiles.set(num, file);
      }
    } else if (inMatch) {
      const num = parseInt(inMatch[1], 10);
      inputFiles.set(num, file);
    } else if (outMatch) {
      const num = parseInt(outMatch[1], 10);
      outputFiles.set(num, file);
    }
  }

  // Validate pairing
  const allNumbers = new Set([...inputFiles.keys(), ...outputFiles.keys()]);
  const paired: number[] = [];

  for (const num of allNumbers) {
    const hasInput = inputFiles.has(num);
    const hasOutput = outputFiles.has(num);

    if (hasInput && hasOutput) {
      paired.push(num);
    } else if (hasInput) {
      errors.push(`Testcase ${num}: Missing output file`);
    } else {
      errors.push(`Testcase ${num}: Missing input file`);
    }
  }

  if (paired.length === 0) {
    errors.push("No valid testcase pairs found in ZIP");
    return { success: false, testcases: [], errors, warnings };
  }

  // Sort and check for gaps
  paired.sort((a, b) => a - b);

  if (paired[0] !== 1) {
    warnings.push(`Testcases start at ${paired[0]} instead of 1`);
  }

  for (let i = 1; i < paired.length; i++) {
    if (paired[i] !== paired[i - 1] + 1) {
      warnings.push(`Gap in testcase numbering: ${paired[i - 1]} to ${paired[i]}`);
    }
  }

  // Extract content
  const testcases: ExtractedTestcase[] = [];

  for (const num of paired) {
    const inputFile = inputFiles.get(num)!;
    const outputFile = outputFiles.get(num)!;

    const [inputContent, outputContent] = await Promise.all([
      inputFile.async("nodebuffer"),
      outputFile.async("nodebuffer"),
    ]);

    testcases.push({
      number: num,
      input: inputContent,
      output: outputContent,
    });
  }

  return {
    success: errors.length === 0,
    testcases,
    errors,
    warnings,
  };
}

/**
 * Upload testcases from a ZIP file to S3
 */
export async function uploadTestcasesFromZip(
  problemName: string,
  zipBuffer: Buffer,
  options: {
    replace?: boolean; // Delete existing testcases first
    renumber?: boolean; // Renumber testcases starting from 1
  } = {}
): Promise<{
  success: boolean;
  uploaded: number;
  errors: string[];
  warnings: string[];
}> {
  const extraction = await extractTestcasesFromZip(zipBuffer);

  if (!extraction.success) {
    return {
      success: false,
      uploaded: 0,
      errors: extraction.errors,
      warnings: extraction.warnings,
    };
  }

  const errors: string[] = [];
  const warnings = [...extraction.warnings];

  // Delete existing testcases if replacing
  if (options.replace) {
    try {
      const existing = await listTestcases(problemName);
      await Promise.all(
        existing.map((tc) => deleteTestcase(problemName, tc.number))
      );
    } catch (error) {
      warnings.push(
        `Warning: Could not delete existing testcases: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Renumber if requested
  let testcases = extraction.testcases;
  if (options.renumber) {
    testcases = testcases.map((tc, index) => ({
      ...tc,
      number: index + 1,
    }));
  }

  // Upload testcases
  let uploaded = 0;
  for (const tc of testcases) {
    try {
      await Promise.all([
        uploadTestcaseFile(problemName, tc.number, "in", tc.input),
        uploadTestcaseFile(problemName, tc.number, "out", tc.output),
      ]);
      uploaded++;
    } catch (error) {
      errors.push(
        `Failed to upload testcase ${tc.number}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Update problem's testcaseCount
  if (uploaded > 0) {
    try {
      const maxNumber = Math.max(...testcases.map((tc) => tc.number));
      await updateProblem(problemName, { testcaseCount: maxNumber });
    } catch (error) {
      warnings.push(
        `Warning: Could not update testcaseCount: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return {
    success: errors.length === 0,
    uploaded,
    errors,
    warnings,
  };
}

/**
 * Upload individual testcase files
 */
export async function uploadSingleTestcase(
  problemName: string,
  number: number,
  inputContent: Buffer,
  outputContent: Buffer
): Promise<void> {
  await Promise.all([
    uploadTestcaseFile(problemName, number, "in", inputContent),
    uploadTestcaseFile(problemName, number, "out", outputContent),
  ]);
}

/**
 * Delete and renumber testcases (for reordering)
 */
export async function renumberTestcases(
  problemName: string,
  newOrder: number[]
): Promise<void> {
  // Get existing testcases
  const existing = await listTestcases(problemName);
  const existingNumbers = new Set(existing.map((tc) => tc.number));

  // Validate new order contains only existing testcases
  for (const num of newOrder) {
    if (!existingNumbers.has(num)) {
      throw new Error(`Testcase ${num} does not exist`);
    }
  }

  // This is a complex operation that would need to:
  // 1. Download all testcases
  // 2. Delete all testcases
  // 3. Re-upload in new order with new numbers
  // For now, this is a placeholder for future implementation
  throw new Error("Renumbering not yet implemented");
}

/**
 * Validate that testcases exist for a problem
 */
export async function validateTestcases(
  problemName: string,
  expectedCount: number
): Promise<{
  valid: boolean;
  actualCount: number;
  missingInputs: number[];
  missingOutputs: number[];
}> {
  const testcases = await listTestcases(problemName);

  const missingInputs: number[] = [];
  const missingOutputs: number[] = [];

  // Check each expected testcase
  for (let i = 1; i <= expectedCount; i++) {
    const tc = testcases.find((t) => t.number === i);
    if (!tc) {
      missingInputs.push(i);
      missingOutputs.push(i);
    } else {
      if (!tc.hasInput) missingInputs.push(i);
      if (!tc.hasOutput) missingOutputs.push(i);
    }
  }

  const actualCount = testcases.filter(
    (tc) => tc.hasInput && tc.hasOutput
  ).length;

  return {
    valid: missingInputs.length === 0 && missingOutputs.length === 0,
    actualCount,
    missingInputs,
    missingOutputs,
  };
}
