import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("cli flag validation", () => {
  test("search without --location fails with NO_LOCATION", async () => {
    const result = await runCLI(["search", "-q", "product manager"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("NO_LOCATION")
  })

  test("search with an invalid --location fails with BAD_LOCATION", async () => {
    const result = await runCLI(["search", "-l", "germany"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("BAD_LOCATION")
  })

  test("an unknown flag is rejected rather than silently ignored", async () => {
    const result = await runCLI(["search", "-l", "usa", "--city", "Toronto"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("UNKNOWN_FLAG")
  })

  test("detail without an id fails with NO_ID", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("NO_ID")
  })

  test("detail with a bare numeric id (not a URL) fails with BAD_ID", async () => {
    const result = await runCLI(["detail", "12345"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("BAD_ID")
  })

  test("no command prints help and exits 1", async () => {
    const result = await runCLI([])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain("builtin-cli")
  })
})
