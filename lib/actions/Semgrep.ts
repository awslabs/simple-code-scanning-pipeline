import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { SemgrepProps } from '../StandardizedCodeBuildProjectProps';

export class SemgrepAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: SemgrepProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Static analysis engine for finding bugs, detecting dependency vulnerabilities, and enforcing code standards.',
                    installCommands: [`pip install semgrep`],
                    buildCommands: [
                        `semgrep --config ${props.SemgrepConfig} --no-error --enable-nosem --severity ${props.SemgrepSeverity} --quiet --json --output ${id}.log .`,
                        `python -m json.tool ${id}.log`,
                        [
                            `if [ \`cat ${id}.log | jq '.results[0].path'\` = null ]; then`,
                            `    echo "No results found"`,
                            `else`,
                            `    echo "Results found" && EXITCODE=1`,
                            `fi`
                        ].join('\n')
                        // I'd use docker container instead of installing trivy using script but,
                        // sometimes it hits docker rate limit if you have not signed in to docker.
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
