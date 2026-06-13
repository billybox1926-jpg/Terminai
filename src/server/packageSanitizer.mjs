const PACKAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9.+-]*$/;

export function sanitizePackageName(name) {
  if (typeof name !== "string") {
    throw new Error("Package name must be a string");
  }
  const cleaned = name.trim().toLowerCase();
  if (!PACKAGE_NAME_PATTERN.test(cleaned)) {
    throw new Error(`Invalid package name: ${name}`);
  }
  return cleaned;
}

export function sanitizePackageNames(names) {
  if (!Array.isArray(names)) {
    throw new Error("Package names must be an array");
  }
  return names.map(sanitizePackageName);
}

export function splitAndSanitizePackageNames(value) {
  if (typeof value !== "string") {
    throw new Error("Package list must be a string");
  }
  return sanitizePackageNames(value.split(/\s+/).filter(Boolean));
}

export function selectManifestPackages(packageIds, packageBaseline, packageField = "aptPackages") {
  if (!Array.isArray(packageIds) || packageIds.length === 0) {
    throw new Error("packageIds array is required");
  }
  if (!Array.isArray(packageBaseline)) {
    throw new Error("Package baseline must be an array");
  }

  const packageMap = new Map(packageBaseline.map((entry) => [entry.id, entry]));
  const packageNames = [];

  for (const id of packageIds) {
    const entry = packageMap.get(id);
    if (!entry) {
      throw new Error(`Unknown package: ${id}`);
    }
    if (entry[packageField]) {
      packageNames.push(...splitAndSanitizePackageNames(entry[packageField]));
    }
  }

  if (packageNames.length === 0) {
    throw new Error(`No valid ${packageField} packages found for the given IDs`);
  }

  return packageNames;
}
