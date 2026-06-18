import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();

const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,

  baseURL: "https://api.groq.com/openai/v1",
});

export const genrateUnitTest = async (
  selectedText: string,
  fileContext: string,
) => {
  try {
    const response = await grok.chat.completions.create({
      model: "llama-3.3-70b-versatile",

      response_format: {
        type: "json_object",
      },

      messages: [
        {
          role: "system",
          content:
            "You are an expert software engineer. Generate high quality unit tests.",
        },

        {
          role: "user",
          content: `
You are an expert software engineer and unit test generator.

Your task is to analyze the provided source code and generate high-quality unit tests.

Follow these rules strictly:

## Code Analysis

1. First identify the programming language of the provided code.
2. Identify the framework/testing ecosystem if possible:
   - JavaScript/TypeScript → Jest, Vitest, Mocha
   - Python → pytest/unittest
   - Java → JUnit
   - C# → NUnit/xUnit
   - Go → testing package
   - etc.
3. Analyze the selected code before generating tests.

## Important Validation Rules


- Generate tests ONLY for functions, classes, methods, or modules that actually exist in the provided code.
- Never invent missing functions, variables, classes, imports, or business logic.
- Never rewrite the user's code.
- Never assume behavior that is not visible from the code.
- If the code is incomplete, invalid, or not testable:
  - Explain the issue briefly.
  - Do not generate fake tests.

## Input Validation Rules:

- Do not assume the function throws errors unless the source code explicitly contains validation logic.
- Do not test invalid inputs expecting errors unless the implementation handles or rejects them.
- Respect JavaScript type coercion behavior.
- Generate tests based on actual implementation behavior, not idealized behavior.

## Before generating tests, mentally execute the code and verify expected outputs.

Do not generate tests based on what the function SHOULD do.
Generate tests based on what the implementation ACTUALLY does.

For dynamically typed languages like JavaScript:
- Consider implicit type coercion.
- Consider string concatenation.
- Consider null/undefined behavior.
- Do not assume TypeError unless code throws it.

## Before writing each test:
1. Evaluate the actual code behavior.
2. Determine the real output.
3. Verify the expected value matches the implementation.

Never write an assertion based on assumptions or common practices.
The assertion must match the runtime behavior of the provided code.

## Test Generation Rules

Generate tests covering:

1. Normal success cases
2. Edge cases
3. Boundary values
4. Invalid inputs
5. Null/undefined handling
6. Error handling
7. Async behavior (if applicable)
8. External dependencies mocking
9. API calls mocking
10. Database/service mocking if detected

## Before returning tests, perform a self-review.

Check every expect() statement:

- Would this assertion actually pass?
- Does the expected output match real runtime behavior?
- Did you assume validation/error handling that does not exist?
- For JavaScript:
  - consider type coercion
  - consider null behavior
  - consider undefined behavior
  - consider string concatenation

Remove any test case that is based on assumptions instead of implementation behavior.

## Code Quality

Generated tests should:

- Follow standard testing conventions
- Have meaningful test names
- Avoid unnecessary mocks
- Be maintainable
- Match the style of the original code
- Use the correct imports
- Use the detected language/framework

## Output Format

## Output Format

Return ONLY valid JSON.

Do not use markdown.
Do not wrap JSON in stringliterals

Return exactly this structure:

{
  "language": "",
  "framework": "",
  "analysis": "",
  "tests": ""
}

Rules:
- "tests" should contain only the generated test code.
- If tests cannot be generated, keep tests empty and explain why in "analysis".

## Context

Selected code:

${selectedText}


Full file context:

${fileContext}
`,
        },
      ],
    });
    let content = response.choices[0].message.content;
    if (!content) {
      return null;
    }

    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsedResponse = JSON.parse(content);
    console.log(parsedResponse);

    return parsedResponse;
  } catch (error) {
    console.error("somthing went wrong", error);
  }
};
