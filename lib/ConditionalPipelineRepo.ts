import { Aspects, CfnCondition, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConditionalPipelineRepoProps } from './ConditionalPipelineRepoProps';
import { CfnRepository } from 'aws-cdk-lib/aws-codecommit';
import { ConditionAdder } from './ConditionAdder';

export class ConditionalPipelineRepo extends Construct {
    newRepoArn: string;
    newRepoExists: CfnCondition;
    constructor(
        scope: Construct,
        id: string,
        props: ConditionalPipelineRepoProps
    ) {
        super(scope, id);

        const NewRepoExists = new CfnCondition(this, 'NewRepoExists', {
            expression: Fn.conditionNot(
                Fn.conditionEquals(props.newRepoName, '')
            )
        });
        this.newRepoExists = NewRepoExists;
        const newCodeCommitRepository = new CfnRepository(
            this,
            'CodeCommitRepository',
            {
                repositoryName: props.newRepoName,
                // Initialize the code repo with an empty cfn_templates folder
                code: {
                    s3: {
                        bucket: props.initialRepoContentsBucketName,
                        key: props.repoStarter
                    }
                }
            }
        );
        newCodeCommitRepository.applyRemovalPolicy(props.removalPolicy);
        // Only create the repository if we're given a name for it -- otherwise, assume there is an ARN provided.
        Aspects.of(newCodeCommitRepository).add(
            new ConditionAdder(NewRepoExists)
        );
        this.newRepoArn = newCodeCommitRepository.attrArn;
    }
}
