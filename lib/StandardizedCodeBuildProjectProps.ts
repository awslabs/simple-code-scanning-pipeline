import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';

// Some basic settings that get used by almost all projects. They can be overridden at the StandardizedCodeBuildProject level.
// This does make some of the developer experience worse by neutering TypeScript's ability to know what properties exist on the class, but it's worth it
export interface StandardizedCodeBuildProjectProps {
    pipelineName: string;
    removalPolicy: RemovalPolicy;
    artifactBucket: Bucket;
}

export interface CfnNagProps extends StandardizedCodeBuildProjectProps {
    cfnTemplatesPath: string;
}

export interface CheckovProps extends StandardizedCodeBuildProjectProps {
    checkovSeverityTrigger: string;
    terraformCodePath: string;
}

export interface JsHintProps extends StandardizedCodeBuildProjectProps {
    JSHintExclude: string;
    JSHintConfigFile: string;
    JSHintConfigFlag: string;
}

export interface RdkProps extends StandardizedCodeBuildProjectProps {
    configRulesPath: string;
}

export interface SemgrepProps extends StandardizedCodeBuildProjectProps {
    SemgrepSeverity: string;
    SemgrepConfig: string;
}

export interface SqlFluffProps extends StandardizedCodeBuildProjectProps {
    sqlDialect: string;
}

export interface TfsecProps extends StandardizedCodeBuildProjectProps {
    tfsecSeverity: string;
    tfsecExclude: string;
}

export interface CdkNagProps extends StandardizedCodeBuildProjectProps {
    YQ_VERSION: string;
}

export interface ZipProps extends StandardizedCodeBuildProjectProps {
    scanActionCount: number;
    repoName: string;
    branchName: string;
    TIMEOUT_MINUTES: number;
}
