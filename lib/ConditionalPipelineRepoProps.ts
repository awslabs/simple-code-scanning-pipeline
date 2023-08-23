import { RemovalPolicy } from 'aws-cdk-lib';

export interface ConditionalPipelineRepoProps {
    repoStarter: string;
    initialRepoContentsBucketName: string;
    newRepoName: string;
    existingRepoArn: string;
    removalPolicy: RemovalPolicy;
}
