import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { Octokit } from '@octokit/rest'
import type { TransformOutput } from '../transforms/runner.js'
import { renderPrBody } from './body-template.js'

/**
 * Shape of every openPullRequest call. Matches P2.4 spec step 5:
 *   interface OpenPrInput { repoOwner, repoName, branchName,
 *     baseBranch, changes, dependencyBump, envVarsRequired, token }
 */
export interface OpenPrInput {
  repoOwner: string
  repoName: string
  branchName: string
  baseBranch: string
  changes: TransformOutput['changedFiles']
  dependencyBump: Record<string, string>
  envVarsRequired: string[]
  token: string
}

export interface OpenPrResult {
  url: string
  number: number
  forkUsed: boolean
}

const PR_TITLE = 'chore: monetize with SettleGrid'

// Max time we'll wait for a fork to become reachable before bailing.
const FORK_POLL_MAX_MS = 30_000
const FORK_POLL_INTERVAL_MS = 2_000

/**
 * Open a pull request against `<repoOwner>/<repoName>:baseBranch` that
 * applies the transformed files. Forks the upstream if the
 * authenticated user lacks push access, then commits + pushes +
 * creates the PR from the fork.
 *
 * Contract:
 *   - Throws if `token` is missing/empty (empty-token Octokit would
 *     fail opaquely downstream).
 *   - NEVER logs, prints, or otherwise echoes `token` — not via
 *     console, not via thrown error messages, not via the return
 *     value. Tests assert this explicitly.
 *   - All Octokit calls go through a single internal client, so
 *     tests using `vi.mock('@octokit/rest')` can intercept every
 *     network interaction.
 */
export async function openPullRequest(
  input: OpenPrInput,
): Promise<OpenPrResult> {
  if (!input.token || typeof input.token !== 'string') {
    throw new Error(
      'openPullRequest: token is required (pass --token or set GITHUB_TOKEN)',
    )
  }
  if (input.changes.length === 0) {
    throw new Error(
      'openPullRequest: no changes to commit (did the codemod run?)',
    )
  }

  const octokit = new Octokit({ auth: input.token })

  // Step 1 — check push access. If we have it, work directly on the
  // upstream. Otherwise fork and wait for GitHub to finish the fork
  // (it's async on the backend for anything larger than a toy repo).
  const hasPushAccess = await checkPushAccess(
    octokit,
    input.repoOwner,
    input.repoName,
  )

  let workOwner = input.repoOwner
  let forkUsed = false
  if (!hasPushAccess) {
    workOwner = await forkAndWait(octokit, input.repoOwner, input.repoName)
    forkUsed = true
  }

  // Step 2 — find the base commit + its tree. We need both: the commit
  // SHA becomes the parent of our new commit, the tree SHA is the
  // `base_tree` for the new tree we'll build from the transform output.
  const baseRef = await octokit.rest.git.getRef({
    owner: workOwner,
    repo: input.repoName,
    ref: `heads/${input.baseBranch}`,
  })
  const baseCommitSha = baseRef.data.object.sha

  const baseCommit = await octokit.rest.git.getCommit({
    owner: workOwner,
    repo: input.repoName,
    commit_sha: baseCommitSha,
  })
  const baseTreeSha = baseCommit.data.tree.sha

  // Step 3 — create the topic branch.
  await octokit.rest.git.createRef({
    owner: workOwner,
    repo: input.repoName,
    ref: `refs/heads/${input.branchName}`,
    sha: baseCommitSha,
  })

  // Step 4 — materialise each transformed file as a blob, build a
  // tree on top of the base tree, then create a commit on the new
  // branch.
  const treeEntries = await Promise.all(
    input.changes.map(async (change) => {
      const blob = await octokit.rest.git.createBlob({
        owner: workOwner,
        repo: input.repoName,
        content: Buffer.from(change.after, 'utf-8').toString('base64'),
        encoding: 'base64',
      })
      return {
        path: change.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      }
    }),
  )

  const newTree = await octokit.rest.git.createTree({
    owner: workOwner,
    repo: input.repoName,
    base_tree: baseTreeSha,
    tree: treeEntries,
  })

  const newCommit = await octokit.rest.git.createCommit({
    owner: workOwner,
    repo: input.repoName,
    message: PR_TITLE,
    tree: newTree.data.sha,
    parents: [baseCommitSha],
  })

  await octokit.rest.git.updateRef({
    owner: workOwner,
    repo: input.repoName,
    ref: `heads/${input.branchName}`,
    sha: newCommit.data.sha,
  })

  // Step 5 — open the PR against the UPSTREAM repo. `head` uses the
  // fork owner's `user:branch` format when we forked; otherwise the
  // bare branch name. GitHub routes cross-fork PRs automatically.
  const head = forkUsed
    ? `${workOwner}:${input.branchName}`
    : input.branchName

  const body = renderPrBody({
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    changes: input.changes,
    dependencyBump: input.dependencyBump,
    envVarsRequired: input.envVarsRequired,
  })

  const pr = await octokit.rest.pulls.create({
    owner: input.repoOwner,
    repo: input.repoName,
    title: PR_TITLE,
    body,
    head,
    base: input.baseBranch,
  })

  return {
    url: pr.data.html_url,
    number: pr.data.number,
    forkUsed,
  }
}

/**
 * True if the authenticated user can push directly to `owner/repo`.
 * Returns false on any failure (repo not found, 403, network hiccup)
 * so the caller takes the safe fork path.
 */
async function checkPushAccess(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    const res = await octokit.rest.repos.get({ owner, repo })
    return res.data.permissions?.push === true
  } catch {
    return false
  }
}

/**
 * Kick off a fork via `POST /repos/{owner}/{repo}/forks` and poll the
 * fork's `GET /repos/{user}/{repo}` until it becomes reachable.
 * Returns the fork owner login (the authenticated user's handle).
 * Throws after FORK_POLL_MAX_MS if the fork never surfaces.
 */
async function forkAndWait(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<string> {
  const fork = await octokit.rest.repos.createFork({ owner, repo })
  const forkOwner = fork.data.owner.login
  const forkRepo = fork.data.name

  const deadline = Date.now() + FORK_POLL_MAX_MS
  while (Date.now() < deadline) {
    try {
      await octokit.rest.repos.get({ owner: forkOwner, repo: forkRepo })
      return forkOwner
    } catch {
      await new Promise((r) => setTimeout(r, FORK_POLL_INTERVAL_MS))
    }
  }
  throw new Error(
    `fork of ${owner}/${repo} was not reachable within ${FORK_POLL_MAX_MS / 1000}s`,
  )
}

/**
 * Parse a GitHub repo reference into `{ owner, name }`. Supports the
 * three forms the CLI accepts in P2.2 (`isGithubUrl`):
 *
 *   - https://github.com/owner/repo(.git)(/)
 *   - http://github.com/owner/repo
 *   - github:owner/repo  /  gh:owner/repo  (giget shorthand)
 *   - git@github.com:owner/repo.git
 *   - git://github.com/owner/repo.git
 *
 * Returns null if the input doesn't look like a github.com URL so
 * the caller can fall back to the local-patch-file path.
 */
export function parseGithubRepo(
  url: string,
): { owner: string; name: string } | null {
  if (!url || typeof url !== 'string') return null

  const trimmed = url.trim()

  // github:owner/repo OR gh:owner/repo shorthand
  const short = trimmed.match(/^(?:github|gh):([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i)
  if (short) return { owner: short[1], name: short[2] }

  // git@github.com:owner/repo.git SSH form
  const ssh = trimmed.match(
    /^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i,
  )
  if (ssh) return { owner: ssh[1], name: ssh[2] }

  // http(s):// and git:// github.com forms
  const web = trimmed.match(
    /^(?:https?|git):\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#]|$)/i,
  )
  if (web) return { owner: web[1], name: web[2] }

  return null
}

/**
 * Read the `origin` remote URL from a local `.git/config` file if
 * present. Used to discover the upstream GitHub repo when the user
 * runs `settlegrid add --path ./local-repo` against a clone.
 * Returns null on any error (no .git dir, malformed config, no
 * origin remote).
 */
export async function readGitOrigin(rootDir: string): Promise<string | null> {
  try {
    const raw = await fsp.readFile(
      path.join(rootDir, '.git', 'config'),
      'utf-8',
    )
    // Find the [remote "origin"] section and its `url = …` line.
    // The config file is INI-style; multi-line capture is fine here
    // since sections are separated by `[...]` headers.
    const section = raw.match(/\[remote "origin"\]([^[]*)/m)
    if (!section) return null
    const urlLine = section[1].match(/url\s*=\s*(\S+)/m)
    return urlLine ? urlLine[1] : null
  } catch {
    return null
  }
}

/**
 * Produce a valid unified-diff patch file for the transformed files
 * — emitted to the user's cwd when we can't open a PR directly (no
 * token, or no GitHub repo info). The format is intentionally the
 * most conservative / widely-supported: a full-file-replace hunk per
 * changed file. `git apply` accepts this even though it's noisier
 * than an LCS-based diff.
 *
 * Note: we keep the output stable (no timestamps) so a re-run
 * produces an identical patch file, which makes the no-token path
 * easy to diff in review.
 */
export function generatePatch(
  changes: TransformOutput['changedFiles'],
): string {
  const blocks = changes.map((change) => {
    const beforeLines = change.before.split('\n')
    const afterLines = change.after.split('\n')
    const removed = beforeLines.map((l) => `-${l}`).join('\n')
    const added = afterLines.map((l) => `+${l}`).join('\n')
    return [
      `diff --git a/${change.path} b/${change.path}`,
      `--- a/${change.path}`,
      `+++ b/${change.path}`,
      `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
      removed,
      added,
    ].join('\n')
  })
  return blocks.join('\n') + '\n'
}
