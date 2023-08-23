import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { StandardizedCodeBuildProjectProps } from '../StandardizedCodeBuildProjectProps';

export class GitLeaksAction extends CodeBuildAction {
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
                        'Runs GitLeaks to look for potential secrets in the commit. From https://github.com/zricethezav/gitleaks.',
                    installCommands: [
                        `VERSION=$(curl https://api.github.com/repositories/119190187/releases/latest | jq .tag_name -r | sed 's/v//')`,
                        `FILENAME=gitleaks_\${VERSION}_linux_x64.tar.gz`,
                        `wget https://github.com/zricethezav/gitleaks/releases/download/v$VERSION/$FILENAME`,
                        `tar -zxvf $FILENAME gitleaks`,
                        `chmod +x gitleaks`
                    ],
                    buildCommands: [
                        `./gitleaks detect --source . --no-git --redact -v -r ${id}.log # no-git because the remote branch won't have a .git folder. Note that --exit-code 0 can be used to make this pass regardless of secrets.`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
