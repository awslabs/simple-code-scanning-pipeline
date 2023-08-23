import { CfnCondition } from 'aws-cdk-lib';
import { SimpleCodeScanningPipelineResourceProps } from './SimpleCodeScanningPipelineResourceProps';

export interface ConditionalSimpleCodeScanningPipelineResourceProps
    extends SimpleCodeScanningPipelineResourceProps {
    condition: CfnCondition;
    existingRepoARN: string;
    createNewRepo: CfnCondition;
    NewRepoName: string;
}
