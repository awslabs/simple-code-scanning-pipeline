import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { StandardizedCodeBuildProjectProps } from '../StandardizedCodeBuildProjectProps';

export class BanditAction extends CodeBuildAction {
    constructor(
        scope: Construct,
        id: string,
        props: StandardizedCodeBuildProjectProps
    ) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Runs the Bandit Python security tool on all Python files in the repository',
                    installCommands: ['pip install bandit'],
                    buildCommands: [
                        // Save to report using built-in functionality
                        `python -m bandit -v -r . -o ${id}.log`
                    ],
                    prePostBuildCommands: [
                        `cat ${id}.log`,
                        `echo "If there are any security issues, fix them and commit your new code. If there is a false positive, you can suppress it by adding a comment beginning with '# nosec - ' and ending with the reason why it is a false positive"`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
