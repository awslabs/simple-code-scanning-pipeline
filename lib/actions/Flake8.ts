import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { StandardizedCodeBuildProjectProps } from '../StandardizedCodeBuildProjectProps';

export class FlakeAction extends CodeBuildAction {
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
                        'Runs the Flake8 Python syntax checker on all Python files in the repository',
                    installCommands: [
                        'pip install flake8'
                        // "pip install black>=22.3.0"
                    ],
                    buildCommands: [
                        // Just save to a report
                        `python -m flake8 . --output-file ${id}.log --max-line-length=120`
                    ],
                    prePostBuildCommands: [
                        `cat ${id}.log`,
                        `echo "To automatically fix formatting-related issues, consider installing black with *pip install black* and running it locally using *black <filename>*"`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
