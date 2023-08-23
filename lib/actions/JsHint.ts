import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { JsHintProps } from '../StandardizedCodeBuildProjectProps';

export class JsHintAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: JsHintProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Runs JSHint, a community-driven tool that detects errors and potential problems in JavaScript code.',
                    installCommands: [`npm install -g jshint`],
                    buildCommands: [
                        `echo ${props.JSHintConfigFile} | awk '{ gsub(/-/,":"); print}' > config.json`, //"-" needs to be replaced with ":" at this stage other wise codebuild assumes you're mapping values in your build spec
                        `jshint${props.JSHintConfigFlag} .${props.JSHintExclude} 2>&1 || true > ${id}.log`, //"2>&1 || true" forces JSHint to exit 0
                        [
                            `if [ -f ${id}.log ]; then`,
                            `    echo "Errors and potential problems spotted in JavaScript code." && EXITCODE=1`,
                            `else`,
                            `    echo "No errors and potential problems spotted in JavaScript code." && touch ${id}.log`,
                            `fi`
                        ].join('\n')
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
