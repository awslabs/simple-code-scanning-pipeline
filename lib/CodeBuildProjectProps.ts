import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface CodeBuildProjectProps {
    projectName: string;
    description: string;
    installCommands: string[];
    buildCommands: string[];
    pipelineName: string;
    removalPolicy: RemovalPolicy;
    artifactBucket: Bucket;
    prePostBuildCommands?: string[]; // These commands will be prepended to the post-build commands. Useful for printing file output immediately prior to uploading to S3.
    TIMEOUT_MINUTES?: number;
}
