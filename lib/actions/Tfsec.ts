import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { TfsecProps } from '../StandardizedCodeBuildProjectProps';

export class TfsecAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: TfsecProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Runs Tfsec, a static analysis security scanner for Terraform code.',
                    installCommands: [
                        `LATEST_RELEASE=$(curl -sL https://api.github.com/repos/aquasecurity/tfsec/releases/latest | jq -r ".tag_name")`,
                        `curl -s https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh | bash`
                        // Switched to the generic Linux install script -- previous method included for posterity
                        // `curl --silent -L -o "tfsec" "https://github.com/aquasecurity/tfsec/releases/download/$LATEST_RELEASE/tfsec-linux-amd64"`,
                        // `install -c -v tfsec /usr/local/bin`,
                        // `rm tfsec`
                    ],
                    buildCommands: [
                        `tfsec -f json -m ${props.tfsecSeverity}${props.tfsecExclude} -s -O ${id}.log . `,
                        //`tfsec -f json -m ${props.tfsecSeverity} ${Fn.conditionIf(TfsecCondition.toString(), Fn.ref("AWS::NoValue") ,Fn.join(" ", ["-e",props.tfsecExclude])).toString()} -s -O ${TfsecName}.log .`,
                        `cat ${id}.log`,
                        [
                            `if [ \`cat ${id}.log | jq '.results[0].severity'\` = null ]; then`,
                            `    echo "No misconfigurations spotted."`,
                            `else`,
                            `    echo "Misconfigurations spotted." && EXITCODE=1`,
                            `fi`
                        ].join('\n')
                        // I'd use docker container instead of installing trivy using script but,
                        // sometimes it hits docker rate limit if you have not signed in to docker.
                        // GitHub also has rate limit so go figure
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
