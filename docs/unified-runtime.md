# Unified Runtime Architecture

TerminAI is designed as a secure, fast, and optimized single-dashboard developer terminal sandbox. To ensure a predictable development experience, TerminAI establishes a baseline suite of standard terminal packages, utility scripts, and programming language runtimes.

## Package Baseline Manifest

The core set of required terminal utilities is formally declared in:
`/runtime/package-baseline.json`

This manifest acts as the **single source of truth** for both the backend checks and the frontend monitor UI.

### Manifest Configuration Schema
The manifest defines a series of package descriptors with the following properties:

- `id` (string): Unique identifier for the baseline utility (e.g., `"ripgrep"`).
- `displayName` (string): Presentable GUI title (e.g., `"Ripgrep"`).
- `aptPackages` (string): The native space-separated Debian/APT packages required (e.g., `"ripgrep"` or `"openssh-client openssh-server"`).
- `queryCommand` (string): The command binary to look up on the carrier system (e.g., `"rg"` or `"ssh"`).
- `category` (string): Decorative classification (e.g., `"Utility"`, `"Network"`, `"Runtime"`).
- `description` (string): Human-readable explanation of utility capabilities.
- `required` (boolean): Setting to demand first-class workspace readiness.

### Benefits of the Unified Manifest Design
1. **No Frontend Hardcoding:** The user-facing dashboard queries `/api/package-manager/list` which reads directly from `runtime/package-baseline.json`. Client apps automatically adapt if new packages are registered.
2. **Deterministic Commands:** Auto-install commands are assembled directly from `aptPackages` properties instead of arbitrary mapping files, guaranteeing that custom packages can be added inside the manifest and fully managed.
3. **Execution Safety/Sanitization:** Package names are strictly sanitized using regex validators (`^[a-z0-9][a-z0.+-]*$`), ensuring container protection.
4. **Readiness Summary:** The `/api/package-manager/list` route returns a `readiness` object (`total`, `installed`, `missing`, `ready`) computed from the manifest, driving the Runtime Readiness panel in the dashboard.
5. **Dedicated Endpoints:** `/api/package-manager/baseline` exposes the raw manifest; `/api/package-manager/install` builds sanitized install commands from manifest package IDs.
