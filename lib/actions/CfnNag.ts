import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { CfnNagProps } from '../StandardizedCodeBuildProjectProps';

export class CfnNagAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: CfnNagProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Runs cfn_nag on CloudFormation templates in the repository',
                    installCommands: ['gem install cfn-nag'],
                    buildCommands: [
                        [
                            `ALL_PATHS=${props.cfnTemplatesPath || '.'}`,
                            `IFS=',' read -ra CFNPATH <<< "$ALL_PATHS"`, // This will split the input using the separator (IFS) of comma so each path can be scanned
                            `for i in "\${CFNPATH[@]}"; do`,
                            `    echo Scanning CloudFormation Templates in $i | tee -a ${id}.tmp`,
                            `    OUTPUT=$(cfn_nag_scan --input-path "$i")`,
                            `    ((EXITCODE |= $?))`, // Bitwise OR so that any failure exit status gets added to exitcode
                            `    echo "$OUTPUT" | tee -a ${id}.tmp`, // Split output into STDOUT and file output
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
