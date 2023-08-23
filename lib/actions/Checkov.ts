import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { CheckovProps } from '../StandardizedCodeBuildProjectProps';

export class CheckovAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: CheckovProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Runs the Checkov linter on all Terraform files in the specified subfolder',
                    installCommands: [
                        // TODO - skip out early if there are no TF files? Could speed things up
                        'pip install checkov'
                    ],
                    buildCommands: [
                        [
                            `ALL_PATHS=${props.terraformCodePath}`,
                            `IFS=',' read -ra TFPATH <<< "$ALL_PATHS"`, // This will split the input using the separator (IFS) of comma so each path can be scanned
                            `for i in "\${TFPATH[@]}"; do`,
                            `    echo Scanning Terraform Code in $i using Checkov | tee -a ${id}.tmp`,
                            `    OUTPUT=$(checkov --hard-fail-on ${props.checkovSeverityTrigger} --directory "$i")`,
                            `    ((EXITCODE |= $?))`,
                            `    echo "$OUTPUT" | tee -a ${id}.tmp`,
                            `    # Handle case where output is too long for tee by using quiet mode`,
                            `    if (( $? )); then`,
                            `        OUTPUT=$(checkov --quiet --hard-fail-on ${props.checkovSeverityTrigger} --directory "$i")`,
                            `        ((EXITCODE |= $?))`,
                            `        echo "$OUTPUT" | tee -a ${id}.tmp`,
                            `    fi`,
                            `done`
                        ].join('\n'),
                        `mv ${id}.tmp ${id}.log`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
