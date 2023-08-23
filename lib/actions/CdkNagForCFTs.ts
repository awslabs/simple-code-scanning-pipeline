import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { CdkNagProps } from '../StandardizedCodeBuildProjectProps';

export class CdkNagForCFTsAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: CdkNagProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        "Runs CDK Nag on CFTs in the repo. Exclusions can be added using the 'CloudFormation template with granular suppressions' instructions from https://github.com/cdklabs/cdk-nag",
                    installCommands: [
                        `# install CDK`,
                        `curl --silent -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash >> /dev/null`,
                        `export NVM_DIR="$HOME/.nvm"`,
                        `[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm`,
                        `[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"  # This loads nvm bash_completion`,
                        `. ~/.nvm/nvm.sh`,
                        `npm install aws-cdk-lib --silent`,
                        `npm install -g aws-cdk --silent`,
                        `npm install cdk-nag --silent`,
                        `# Install jq for JSON parsing`,
                        `yum install jq --quiet -y`,
                        `# Install YQ for YAML parsing`,
                        `YQ_VER=${props.YQ_VERSION}`,
                        `YQ_BIN="yq_linux_amd64"`,
                        'wget -q https://github.com/mikefarah/yq/releases/download/${YQ_VER}/${YQ_BIN} -O /usr/bin/yq && chmod +x /usr/bin/yq'
                    ],
                    buildCommands: [
                        `# Get all CFTs in repo`,
                        `# The logic here is that if you're a yaml/yml/json with a top-level Resources key, you're a CFT`,
                        `CWD=$(pwd)`,
                        `CFT_NAMES_FILE=$CWD/cft_list.txt # the While pipe executes a separate process, need to save to disk`,
                        `NAG_REPORT_LOCATION=$CWD/nag_reports.tmp`,
                        `# Find all YAML/YML/JSON files not in node_modules or cdk.out and save their locations to a file`,
                        `# https://askubuntu.com/questions/444551/get-absolute-path-of-files-using-find-command - note: tilde-plus gives full path`,
                        // Find's and/or logic needs to be grouped using escaped parentheses
                        [
                            `find ~+ -type f \\( -name '*.json' -o -name '*.yaml' -o -name '*.yml' \\) -a -not -path '*/node_modules/*' -a -not -path '*/cdk.out/*' -print0 | while read -d '' -r CFTFILE; do`,
                            `    QUERY_COMMAND="yq"`,
                            `    if [[ $CFTFILE =~ .json$ ]]; then `,
                            `        QUERY_COMMAND="jq"`,
                            `    fi`,
                            `    QUOTED_NAME="$CFTFILE"`,
                            `    CONTENTS=$(cat "$QUOTED_NAME" | $QUERY_COMMAND 'select(.Resources != null)' 2> /dev/null)`,
                            `    if [[ $? && $CONTENTS ]]; then`,
                            `        echo $CFTFILE >> $CFT_NAMES_FILE`,
                            `    fi`,
                            `done`
                        ].join('\n'),
                        [
                            `if [[ ! -f $CFT_NAMES_FILE ]]; then`,
                            `    echo "No CFTs found in repo." | tee -a $CWD/${id}.log`,
                            `else`,
                            `    # Run CDK Nag on them`,
                            `    # Install the CDK-NAG-IFY CDK Project`,
                            `    curl -s https://proservetools.s3.us-west-2.amazonaws.com/res/cdk-nag-ify.zip -o $CWD/cdk-nag-ify.zip`,
                            `    unzip -n $CWD/cdk-nag-ify.zip`,
                            `    cd cdk-nag-ify`,
                            `    touch $CWD/${id}.tmp`,
                            `    for CFT in $(cat $CFT_NAMES_FILE); do`,
                            `        echo $CFT | tee -a $CWD/${id}.tmp`,
                            `        cdk synth --quiet --context cdkNagScanning=on --context cfnTemplateFilename=$CFT`,
                            `        ((EXITCODE |= $?))`, // Fail action if synth fails
                            `        # There should now be a CDK Nag Summary CSV, so copy that into the output file.`,
                            //       There should only be one stack since we're synthing a CFT stack // TODO - nested stack handling
                            `        NAG_REPORT=$(find ~+/cdk.out/AwsSolutions*.csv)`,
                            `        # Use Bash's tail magic to skip the header`,
                            `        tail -n +2 $NAG_REPORT | gawk -F, '{ if ($3 ~ /Non-Compliant/) print "ERROR: Found Non-Compliant resource " $2 " violating rule " $1 " with rule info " $6; }' >> violations.tmp`,
                            `        if [[ -s violations.tmp ]]; then`,
                            `            cat violations.tmp >> $CWD/${id}.tmp`,
                            `            ((EXITCODE |= 1))`,
                            `        else`,
                            `            echo "No non-compliant findings detected in $NAG_REPORT." | tee -a $CWD/${id}.tmp`,
                            `        fi`,
                            `        rm violations.tmp`,
                            `        echo $'\\n\\n' >> $CWD/${id}.tmp`, // Newlines for readability
                            `    done`,
                            `    mv $CWD/${id}.tmp $CWD/${id}.log`,
                            `fi`
                        ].join('\n'),
                        `cd $CWD`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
