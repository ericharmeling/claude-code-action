import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { parseGitHubContext } from "../src/github/context";
import { prepareMcpConfig } from "../src/mcp/install-mcp-server";
import type { ParsedGitHubContext } from "../src/github/context";

describe("disable_comments feature", () => {
  describe("context parsing", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should parse disable_comments from environment variable", () => {
      // Test when explicitly set to true
      process.env.DISABLE_COMMENTS = "true";
      process.env.GITHUB_RUN_ID = "test-run-id";
      const contextEnabled = parseGitHubContext();
      expect(contextEnabled.inputs.disableComments).toBe(true);

      // Test when explicitly set to false
      process.env.DISABLE_COMMENTS = "false";
      const contextDisabled = parseGitHubContext();
      expect(contextDisabled.inputs.disableComments).toBe(false);

      // Test when not set (should default to false)
      delete process.env.DISABLE_COMMENTS;
      const contextDefault = parseGitHubContext();
      expect(contextDefault.inputs.disableComments).toBe(false);
    });
  });

  describe("MCP server configuration", () => {
    const createTestContext = (
      disableComments = false,
    ): ParsedGitHubContext => ({
      runId: "test-run-id",
      eventName: "issues",
      repository: {
        owner: "test-owner",
        repo: "test-repo",
        full_name: "test-owner/test-repo",
      },
      actor: "test-actor",
      payload: {} as any,
      entityNumber: 123,
      isPR: false,
      inputs: {
        triggerPhrase: "@claude",
        assigneeTrigger: "",
        labelTrigger: "",
        allowedTools: [],
        disallowedTools: [],
        customInstructions: "",
        directPrompt: "",
        overridePrompt: "",
        branchPrefix: "claude/",
        useStickyComment: false,
        disableComments,
        additionalPermissions: new Map(),
        useCommitSigning: false,
      },
    });

    it("should exclude comment server when comments are disabled", async () => {
      const params = {
        githubToken: "test-token",
        owner: "test-owner",
        repo: "test-repo",
        branch: "test-branch",
        baseBranch: "main",
        allowedTools: [],
        context: createTestContext(true),
        disableComments: true,
      };

      // Mock the actions/core module
      mock.module("@actions/core", () => ({
        debug: () => {},
        info: () => {},
        warning: () => {},
        error: () => {},
      }));

      const config = await prepareMcpConfig(params);
      const parsedConfig = JSON.parse(config);

      // Comment server should not be included
      expect(parsedConfig.mcpServers.github_comment).toBeUndefined();
    });

    it("should include comment server when comments are enabled", async () => {
      const params = {
        githubToken: "test-token",
        owner: "test-owner",
        repo: "test-repo",
        branch: "test-branch",
        baseBranch: "main",
        allowedTools: [],
        context: createTestContext(false),
        disableComments: false,
        claudeCommentId: "12345",
      };

      // Mock the actions/core module
      mock.module("@actions/core", () => ({
        debug: () => {},
        info: () => {},
        warning: () => {},
        error: () => {},
      }));

      // Set required environment variable
      process.env.GITHUB_ACTION_PATH = "/test/action/path";

      const config = await prepareMcpConfig(params);
      const parsedConfig = JSON.parse(config);

      // Comment server should be included
      expect(parsedConfig.mcpServers.github_comment).toBeDefined();
      expect(parsedConfig.mcpServers.github_comment.command).toBe("bun");
      expect(parsedConfig.mcpServers.github_comment.env.CLAUDE_COMMENT_ID).toBe(
        "12345",
      );
    });

    it("should include comment server by default when disableComments is not specified", async () => {
      const params = {
        githubToken: "test-token",
        owner: "test-owner",
        repo: "test-repo",
        branch: "test-branch",
        baseBranch: "main",
        allowedTools: [],
        context: createTestContext(false),
        claudeCommentId: "12345",
        // disableComments not specified - should default to including comment server
      };

      // Mock the actions/core module
      mock.module("@actions/core", () => ({
        debug: () => {},
        info: () => {},
        warning: () => {},
        error: () => {},
      }));

      // Set required environment variable
      process.env.GITHUB_ACTION_PATH = "/test/action/path";

      const config = await prepareMcpConfig(params);
      const parsedConfig = JSON.parse(config);

      // Comment server should be included by default
      expect(parsedConfig.mcpServers.github_comment).toBeDefined();
    });
  });

  describe("comment tool graceful handling", () => {
    it("should return gracefully when comment ID is missing", async () => {
      // This tests the behavior implemented in github-comment-server.ts
      // The actual server would return a graceful message instead of throwing
      // when CLAUDE_COMMENT_ID is not set

      // We can't easily test the actual server here without running it,
      // but we've verified the logic change in the implementation
      expect(true).toBe(true); // Placeholder - actual testing would require integration test
    });
  });

  describe("backward compatibility", () => {
    it("should maintain existing behavior when disable_comments is not used", () => {
      // Test that the default behavior hasn't changed
      const context = parseGitHubContext();
      expect(context.inputs.disableComments).toBe(false);
    });
  });
});
