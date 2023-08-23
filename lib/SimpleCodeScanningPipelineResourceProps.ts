import { CfnCondition, RemovalPolicy, StackProps } from 'aws-cdk-lib';

export interface SimpleCodeScanningPipelineResourceProps extends StackProps {
    branchName: string;
    removalPolicy: RemovalPolicy;
    createNewRepo: CfnCondition;
    existingRepoARN: string;
    NewRepoName: string;
    sqlDialect: string;
    starterZip: string;
    cfnTemplatesPath: string;
    terraformCodePath: string;
    configRulesPath: string;
    tfsecExclude: string;
    tfsecSeverity: string;
    SemgrepConfig: string;
    SemgrepSeverity: string;
    checkovSeverityTrigger: string;
    JSHintExclude: string;
    JSHintConfigFile: string;
    JSHintConfigFlag: string;
}
