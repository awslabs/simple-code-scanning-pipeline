import { Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildActionType } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';

export interface ActionDetails {
    actionName: string;
    project: StandardizedCodeBuildProject;
}

export const sourceOutput = new Artifact('Artifact_Source');

export const ActionDefaultSettings = {
    input: sourceOutput,
    type: CodeBuildActionType.TEST,
    environmentVariables: {
        PIPELINE_RUN_ID: { value: '#{codepipeline.PipelineExecutionId}' },
        START_TIME: { value: '#{SourceVariables.CommitterDate}' }
    },
    runOrder: 1
};
