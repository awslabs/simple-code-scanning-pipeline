import { Stack, StackProps } from 'aws-cdk-lib';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';

export class CdkNagFrameworkStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const templateFilename = this.node.tryGetContext('cfnTemplateFilename');
        if (templateFilename) {
            new CfnInclude(this, 'Template', {
                templateFile: templateFilename
            });
        }
    }
}
