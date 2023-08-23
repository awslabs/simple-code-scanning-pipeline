import { Construct } from 'constructs';
import { SimpleCodeScanningPipelineResources } from './scsp-pipeline-stack';
import { ConditionAdder } from './ConditionAdder';
import { Aspects } from 'aws-cdk-lib';
import { ConditionalSimpleCodeScanningPipelineResourceProps } from './ConditionalSimpleCodeScanningPipelineResourcesProps';

export class ConditionalSimpleCodeScanningPipelineResources extends Construct {
    constructor(
        scope: Construct,
        id: string,
        props: ConditionalSimpleCodeScanningPipelineResourceProps
    ) {
        super(scope, id);

        new SimpleCodeScanningPipelineResources(this, 'PipelineResources', {
            branchName: props.branchName,
            removalPolicy: props.removalPolicy,
            existingRepoARN: props.existingRepoARN,
            createNewRepo: props.createNewRepo,
            NewRepoName: props.NewRepoName,
            sqlDialect: props.sqlDialect,
            starterZip: props.starterZip,
            cfnTemplatesPath: props.cfnTemplatesPath,
            terraformCodePath: props.terraformCodePath,
            configRulesPath: props.configRulesPath,
            tfsecExclude: props.tfsecExclude,
            tfsecSeverity: props.tfsecSeverity,
            SemgrepConfig: props.SemgrepConfig,
            SemgrepSeverity: props.SemgrepSeverity,
            checkovSeverityTrigger: props.checkovSeverityTrigger,
            JSHintExclude: props.JSHintExclude,
            JSHintConfigFile: props.JSHintConfigFile,
            JSHintConfigFlag: props.JSHintConfigFlag
        });

        // Add the condition to all resources in this Construct
        Aspects.of(this).add(new ConditionAdder(props.condition));
    }
}
