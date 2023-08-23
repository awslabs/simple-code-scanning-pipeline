import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { StandardizedCodeBuildProjectProps } from '../StandardizedCodeBuildProjectProps';

export class TrivyAction extends CodeBuildAction {
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
                        'Runs Trivy vulnerability, secret, and config scanner',
                    installCommands: [
                        `LATEST_RELEASE=$(curl -sL https://api.github.com/repos/aquasecurity/trivy/releases/latest | jq -r ".tag_name")`,
                        `curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin $LATEST_RELEASE`
                    ],
                    buildCommands: [
                        `trivy fs --security-checks vuln --severity HIGH,CRITICAL --ignore-unfixed --no-progress --format json --exit-code 0 . > ${id}.log`,
                        `cat ${id}.log`,
                        [
                            `if [ \`cat ${id}.log | jq '.Results[0].Target'\` = null ]; then`,
                            `    echo "No Vulnerabilities found"`,
                            `else`,
                            `    echo "Vulnerabilities found" && EXITCODE=1`,
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
