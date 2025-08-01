import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as github from "@actions/github";
import {
  parseMultilineInput,
  parseAdditionalPermissions,
  parseGitHubContext,
} from "../../src/github/context";

describe("parseMultilineInput", () => {
  it("should parse a comma-separated string", () => {
    const input = `Bash(bun install),Bash(bun test:*),Bash(bun typecheck)`;
    const result = parseMultilineInput(input);
    expect(result).toEqual([
      "Bash(bun install)",
      "Bash(bun test:*)",
      "Bash(bun typecheck)",
    ]);
  });

  it("should parse multiline string", () => {
    const input = `Bash(bun install)
Bash(bun test:*)
Bash(bun typecheck)`;
    const result = parseMultilineInput(input);
    expect(result).toEqual([
      "Bash(bun install)",
      "Bash(bun test:*)",
      "Bash(bun typecheck)",
    ]);
  });

  it("should parse comma-separated multiline line", () => {
    const input = `Bash(bun install),Bash(bun test:*)
Bash(bun typecheck)`;
    const result = parseMultilineInput(input);
    expect(result).toEqual([
      "Bash(bun install)",
      "Bash(bun test:*)",
      "Bash(bun typecheck)",
    ]);
  });

  it("should ignore comments", () => {
    const input = `Bash(bun install),
Bash(bun test:*) # For testing
# For type checking
Bash(bun typecheck)
`;
    const result = parseMultilineInput(input);
    expect(result).toEqual([
      "Bash(bun install)",
      "Bash(bun test:*)",
      "Bash(bun typecheck)",
    ]);
  });

  it("should parse an empty string", () => {
    const input = "";
    const result = parseMultilineInput(input);
    expect(result).toEqual([]);
  });
});

describe("parseAdditionalPermissions", () => {
  it("should parse single permission", () => {
    const input = "actions: read";
    const result = parseAdditionalPermissions(input);
    expect(result.get("actions")).toBe("read");
    expect(result.size).toBe(1);
  });

  it("should parse multiple permissions", () => {
    const input = `actions: read
packages: write
contents: read`;
    const result = parseAdditionalPermissions(input);
    expect(result.get("actions")).toBe("read");
    expect(result.get("packages")).toBe("write");
    expect(result.get("contents")).toBe("read");
    expect(result.size).toBe(3);
  });

  it("should handle empty string", () => {
    const input = "";
    const result = parseAdditionalPermissions(input);
    expect(result.size).toBe(0);
  });

  it("should handle whitespace and empty lines", () => {
    const input = `
    actions: read

    packages: write
    `;
    const result = parseAdditionalPermissions(input);
    expect(result.get("actions")).toBe("read");
    expect(result.get("packages")).toBe("write");
    expect(result.size).toBe(2);
  });

  it("should ignore lines without colon separator", () => {
    const input = `actions: read
invalid line
packages: write`;
    const result = parseAdditionalPermissions(input);
    expect(result.get("actions")).toBe("read");
    expect(result.get("packages")).toBe("write");
    expect(result.size).toBe(2);
  });

  it("should trim whitespace around keys and values", () => {
    const input = "  actions  :  read  ";
    const result = parseAdditionalPermissions(input);
    expect(result.get("actions")).toBe("read");
    expect(result.size).toBe(1);
  });
});

describe("parseGitHubContext - workflow_dispatch", () => {
  const originalEnv = process.env;
  const originalContext = github.context;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment and context
    process.env = originalEnv;
    Object.assign(github.context, originalContext);
  });

  it("should parse issue number from ISSUE_DATA environment variable", () => {
    // Setup environment
    process.env.GITHUB_RUN_ID = "12345";
    process.env.ISSUE_DATA = JSON.stringify({
      number: 1186,
      title: "Test Issue",
      body: "Test body",
      branchName: "claude/issue-1186",
    });

    // Mock GitHub context for workflow_dispatch
    Object.assign(github.context, {
      eventName: "workflow_dispatch",
      payload: {
        inputs: {},
        ref: "refs/heads/main",
        repository: {
          name: "test-repo",
          full_name: "owner/test-repo",
          owner: {
            login: "owner",
          },
        },
        sender: {
          login: "testuser",
        },
      },
      repo: {
        owner: "owner",
        repo: "test-repo",
      },
      actor: "testuser",
    });

    const context = parseGitHubContext();

    expect(context.eventName).toBe("workflow_dispatch");
    expect(context.entityNumber).toBe(1186);
    expect(context.isPR).toBe(false);
  });

  it("should parse issue number from workflow inputs if ISSUE_DATA is not available", () => {
    // Setup environment
    process.env.GITHUB_RUN_ID = "12345";
    
    // Mock GitHub context for workflow_dispatch with issue_number in inputs
    Object.assign(github.context, {
      eventName: "workflow_dispatch",
      payload: {
        inputs: {
          issue_number: "789",
        },
        ref: "refs/heads/main",
        repository: {
          name: "test-repo",
          full_name: "owner/test-repo",
          owner: {
            login: "owner",
          },
        },
        sender: {
          login: "testuser",
        },
      },
      repo: {
        owner: "owner",
        repo: "test-repo",
      },
      actor: "testuser",
    });

    const context = parseGitHubContext();

    expect(context.eventName).toBe("workflow_dispatch");
    expect(context.entityNumber).toBe(789);
    expect(context.isPR).toBe(false);
  });

  it("should detect PR from ISSUE_DATA", () => {
    // Setup environment
    process.env.GITHUB_RUN_ID = "12345";
    process.env.ISSUE_DATA = JSON.stringify({
      number: 456,
      title: "Test PR",
      body: "Test PR body",
      pull_request: {
        url: "https://api.github.com/repos/owner/repo/pulls/456",
      },
    });

    // Mock GitHub context for workflow_dispatch
    Object.assign(github.context, {
      eventName: "workflow_dispatch",
      payload: {
        inputs: {},
        ref: "refs/heads/main",
        repository: {
          name: "test-repo",
          full_name: "owner/test-repo",
          owner: {
            login: "owner",
          },
        },
        sender: {
          login: "testuser",
        },
      },
      repo: {
        owner: "owner",
        repo: "test-repo",
      },
      actor: "testuser",
    });

    const context = parseGitHubContext();

    expect(context.eventName).toBe("workflow_dispatch");
    expect(context.entityNumber).toBe(456);
    expect(context.isPR).toBe(true);
  });

  it("should default to 0 if no issue number is found", () => {
    // Setup environment
    process.env.GITHUB_RUN_ID = "12345";

    // Mock GitHub context for workflow_dispatch without issue data
    Object.assign(github.context, {
      eventName: "workflow_dispatch",
      payload: {
        inputs: {},
        ref: "refs/heads/main",
        repository: {
          name: "test-repo",
          full_name: "owner/test-repo",
          owner: {
            login: "owner",
          },
        },
        sender: {
          login: "testuser",
        },
      },
      repo: {
        owner: "owner",
        repo: "test-repo",
      },
      actor: "testuser",
    });

    const context = parseGitHubContext();

    expect(context.eventName).toBe("workflow_dispatch");
    expect(context.entityNumber).toBe(0);
    expect(context.isPR).toBe(false);
  });

  it("should handle invalid JSON in ISSUE_DATA gracefully", () => {
    // Setup environment
    process.env.GITHUB_RUN_ID = "12345";
    process.env.ISSUE_DATA = "invalid json";

    // Mock GitHub context for workflow_dispatch
    Object.assign(github.context, {
      eventName: "workflow_dispatch",
      payload: {
        inputs: {
          issue_number: "999",
        },
        ref: "refs/heads/main",
        repository: {
          name: "test-repo",
          full_name: "owner/test-repo",
          owner: {
            login: "owner",
          },
        },
        sender: {
          login: "testuser",
        },
      },
      repo: {
        owner: "owner",
        repo: "test-repo",
      },
      actor: "testuser",
    });

    const context = parseGitHubContext();

    // Should fall back to workflow inputs
    expect(context.eventName).toBe("workflow_dispatch");
    expect(context.entityNumber).toBe(999);
    expect(context.isPR).toBe(false);
  });
});
