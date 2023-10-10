# Simple Code Scanning Pipeline (SCSP)

## Current Tools

### SAST

-   `bandit`
-   `cfnNag`
-   `checkov` (for Terraform)
-   ~~`shellcheck`~~ (removed due to licensing issues)
-   `gitleaks`
-   `trivy`
-   `tfsec`
-   `semgrep`
-   `cdknag` (for CDK)
-   `cdknag` (for CFT)
-   `jshint`

### Style-specific tools:

-   `flake8`
-   `sqlfluff`

### Misc

-   `rdk` unit test runner

## Usage

The pipeline can be deployed as a CloudFormation template in any account
(Isengard as well as Customer account) using this link (just open the AWS
Console and choose the region where you intend to deploy the stack):
https://console.aws.amazon.com/cloudformation/home?#/stacks/create/review?templateURL=https://proservetools.s3.amazonaws.com/cft/scsp-pipeline-stack.template.json&stackName=SimpleCodeScanningPipeline

Parameter descriptions should provide sufficient guidance to set up the
pipeline. If they don't, raise an Issue in this repo!

After the pipeline is created, you can upload your code using git to be scanned.

Clone the repository using the HTTPS (GRC) link, not HTTPS. GRC allows you to
access the repository using your local AWS credentials. HTTPS without GRC will
prompt for username/password credentials that you should not provide.
Alternatively, you can adapt this code snippet to configure and clone your repo:

```bash
# Set these to your preferred values
region=us-west-2
repo_name=scsp-repo
# Boilerplate
pip3 install git-remote-codecommit
aws sso login --profile security
git clone codecommit::${region}://${repo_name} # this codecommit prefixed URL is equivalent to copying the HTTPS (GRC) link from CodeCommit
cd ${repo_name}
git defender --setup # one-time task to set up Git Defender, required for all internal git usage
```

### Adding code

Certain tools are too specific to run against the entire repo. Specific
directories are required so that specific tools aren't run on general files. For
example, we don't want a `settings.json` file to be scanned by `cfn_nag`. You
will need to upload specific types of code to specific directories in order to
get scan results:

-   Cloudformation templates (default directory: `cfn_templates`)
-   Terraform code (default directory: `terraform_files`)
-   RDK Config rules (default directory: `config_rules`)

The default values can be changed using CloudFormation parameters.

These are the typical commands used to push code from your local repository to
the remote repository:

```bash
git add . # tells git to include all changed files in the commit (alternatively, instead of . you can specify file/directory names)
git commit -m "summary of the changes you're making"
git push # sends the commit to the remote repository
```

### Known issues

-   “Project-level concurrent build limit cannot exceed the account-level
    concurrent build limit of 1”

    -   Try re-running the pipeline using the **Release Change** button in the
        CodePipeline console. This is a known issue that seems to be most common
        during the first few executions of the pipeline.

-   S3 upload times out

    -   This is likely due to a security tool failing to upload its results to
        S3. Submit an issue with details to this repository.

-   Other issues?

    -   Submit an Issue!

## Description

The Simple Code Scanning Pipeline project creates a pipeline that AWS users can
use to automatically scan a wide variety of code for security and syntax issues.

This project enables consultants to stand up a review of their deliverables
without installing individual scanning tools.

This artifact sets up a ready-to-use development environment integrated with a
CI pipeline with security and DevOps best practices. Upon successful deployment,
you will have:

-   An AWS CodeCommit Git repository (by default called `scsp-repo` with default
    branch `main`) where you can add code to be scanned. You can also bring your
    own CodeCommit repo by specifying the repo ARN and branch.
-   A multi-stage CI pipeline integrated with the code repository
-   Pipeline integration for the following tools:
    -   Bandit for finding common security issues in Python code
    -   Flake8 for ensuring well-formatted Python code.
    -   cfn_nag for CloudFormation template linting and security checks
    -   Checkov for Terraform linting
    -   Gitleaks for secret detection
    -   ~~Shellcheck for Shell script linting~~ (removed due to licensing issues)
    -   SqlFluff for SQL linting
    -   Unit testing of RDK Custom Config rules

## Contributing

If there's an additional feature you would like to add, you can either create an
Issue in this repository or create a fork.

If updating the CDK source code. The `StandardizedCodeBuildProject` class makes
it straightforward to add actions. Just provide the name, description, and
install/build commands and the class will create the CodeBuild Project using
sensible default values.

### Tool output standards

-   New Action classes should be added into the `/lib/actions` folder, and an
    object built from that class should be added to the `scanActions` list in
    the main Stack file (`scsp-pipeline-stack.ts`).

-   Build Actions should FAIL (exit non-zero) if there are problems detected by
    the scanning tool (or if the scanning tool fails to run). Build Actions
    should PASS (exit 0) if there are no problems detected by the scanning tool.
    `StandardizedCodeBuildProject` creates a variable

-   Test using both known-good and known-bad inputs -- some tools may return
    successful exit statuses despite finding issues! If you are developing a
    tool for a new language, add known-good and known-bad test files to the
    `initial_repos` folder.

-   Each tool must write **one** file (named \<projectName\>.log) with any
    actionable findings to the root directory where the Action is running. A log
    file should be created even if the scan is clean. This will allow the
    default `post_build` steps to upload that single file to S3. Tools must
    **also** write their actionable output to CodeBuild logs. This can be
    accomplished by piping tool output to ` | tee -a <projectName>.log` or by
    using a tool's built-in options to save to a file (and then `cat` that file
    in the post-build steps so that it outputs to CodeBuild logs).

-   If a tool has automatic fix options, the Action should print information on
    how to automatically fix the codebase. If a tool has options to suppress
    false positives, those should also be listed (with an emphasis on clearly
    documenting the reason for the suppression)

## Developer testing commands

Deploy with a set of known-good files

```bash
cdk deploy --context starting-files=good # --require-approval never
```

Deploy with a set of known-bad files

```bash
cdk deploy --context starting-files=bad # --require-approval never
```
