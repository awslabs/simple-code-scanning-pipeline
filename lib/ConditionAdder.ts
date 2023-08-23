import { CfnCondition, CfnResource, Fn, IAspect } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export class ConditionAdder implements IAspect {
    condition: CfnCondition;

    constructor(condition: CfnCondition) {
        this.condition = condition;
    }

    public visit(node: IConstruct): void {
        if (node instanceof CfnResource) {
            const resourceItem = node as CfnResource;
            if (resourceItem.cfnOptions.condition) {
                resourceItem.cfnOptions.condition = new CfnCondition(
                    node,
                    'compositeCondition',
                    {
                        expression: Fn.conditionAnd(
                            this.condition,
                            resourceItem.cfnOptions.condition
                        )
                    }
                );
            } else {
                resourceItem.cfnOptions.condition = this.condition;
            }
        }
    }
}
