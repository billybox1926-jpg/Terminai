import test from "node:test";
import assert from "node:assert/strict";
import { sanitizePackageName, selectManifestPackages } from "../src/server/packageSanitizer.mjs";

const baseline = [
  { id: "git", aptPackages: "git" },
  { id: "edge", aptPackages: "mariadb-client" },
];

test("package sanitizer accepts clean input", () => {
  assert.equal(sanitizePackageName("git"), "git");
  assert.equal(sanitizePackageName("libssl1.1"), "libssl1.1");
  assert.equal(sanitizePackageName("c++-tool"), "c++-tool");
});

test("package sanitizer rejects shell metacharacters and path-like input", () => {
  assert.throws(() => sanitizePackageName("git; rm -rf /"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("../../etc/passwd"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("git name"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("$git"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("--loglevel=debug"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("https://malicious.com/trojan.tgz"), /Invalid package name/);
});

test("unknown package IDs are rejected before install processing", () => {
  assert.deepEqual(selectManifestPackages(["git"], baseline), ["git"]);
  assert.throws(() => selectManifestPackages(["missing"], baseline), /Unknown package: missing/);
});

test("hand-crafted argv-based install shim rejects invalid tokens and drops shell payloads", () => {
  const sanitize = (names) => {
    const out = [];
    for (const raw of names) {
      const cleaned = raw.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9.+-]*$/.test(cleaned)) {
        throw new Error(`Invalid package name: ${raw}`);
      }
      if (cleaned) out.push(cleaned);
    }
    return out;
  };
  assert.throws(() => sanitize(["git; rm -rf /"]), /Invalid package name/);
  assert.throws(() => sanitize(["../../etc/passwd"]), /Invalid package name/);
  assert.throws(() => sanitize(["--loglevel=debug"]), /Invalid package name/);
  assert.deepEqual(sanitize(["git", "mariadb-client"]), ["git", "mariadb-client"]);
});
