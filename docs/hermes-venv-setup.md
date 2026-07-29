# Hermes venv — manual artifact build & commit checklist

Use this when you have write access to the repo and can trigger/download GitHub Actions artifacts.

## Prerequisites

- `gh` CLI installed and authenticated: `gh auth login -h github.com`
- `092-phase-2` is up to date locally

## 1. Trigger the workflow

```bash
cd /path/to/Terminai
git checkout 092-phase-2
git pull --rebase

gh workflow run build-hermes-venv.yml --ref 092-phase-2 --repo billybox1926-jpg/Terminai
```

Record the run ID from the output, or find it at:
https://github.com/billybox1926-jpg/Terminai/actions/workflows/build-hermes-venv.yml

Wait for it to complete.

## 2. Download the artifact

```bash
RUN_ID=<run-id-from-step-1>
ARTIFACT=hermes-arm64-venv

gh run download "$RUN_ID" --name "$ARTIFACT" --repo billybox1926-jpg/Terminai --dir ./.hermes-artifact
```

The contents land in `.hermes-artifact/hermes-arm64-venv/`.

## 3. Verify it’s ARM64

Inside the downloaded tree, the key check is the Python interpreter:

```bash
file .hermes-artifact/hermes-arm64-venv/bin/python3
```

Expected: `ELF 64-bit LSB executable, ARM aarch64` (or similar ARM64 wording).

If it says `x86-64`, the wrong architecture was built — do not commit it.

## 4. Stage and commit

```bash
# Replace the empty placeholder with the real artifact
rm -rf runtime/assets/bin/hermes-venv
mv .hermes-artifact/hermes-arm64-venv runtime/assets/bin/hermes-venv
rm -rf .hermes-artifact

# Confirm executability
find runtime/assets/bin/hermes-venv -type f \( -name "python*" -o -name "hermes" \) -exec ls -l {} \;

git add runtime/assets/bin/hermes-venv
git diff --cached --stat
git ls-files -s runtime/assets/bin/hermes-venv/bin/python3 | awk '{print $1}'  # should start with 100755
git ls-files -s runtime/assets/bin/hermes-venv/bin/hermes  | awk '{print $1}'  # should start with 100755
git commit -m "chore(runtime): vendor ARM64 hermes-venv artifact for #98"
```

## 5. Push and next actions

```bash
git push origin 092-phase-2
```

Then:
- Build the APK with the committed artifact
- Run the #99 smoke test on ARM64 hardware
- Update `docs/hermes-packaging.md` with the real APK size delta
- Close #98 and #99 with the verification evidence

## .gitignore sanity check

Make sure nothing in the venv is being ignored:

```bash
git check-ignore -v runtime/assets/bin/hermes-venv/bin/python3
git check-ignore -v runtime/assets/bin/hermes-venv/bin/hermes
```

If either returns a rule, fix `.gitignore` before committing.
