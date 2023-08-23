import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { CdkNagProps } from '../StandardizedCodeBuildProjectProps';

export class CdkNagForCdkAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: CdkNagProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Runs CDK Nag on CDK projects in the repo. To exclude checks, either include CDK Nag suppressions directly to your project or fix the findings.',
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
                        `# Find all cdk.json files and get their parent directories`,
                        `CWD=$(pwd)`,
                        `CDK_PROJECT_NAMES_FILE=$CWD/cdk_projects_list.txt # the While pipe executes a separate process, need to save to disk`,
                        `touch $CDK_PROJECT_NAMES_FILE`,
                        `# Find all directories that contain a 'cdk.json' file.`,
                        `# https://askubuntu.com/questions/444551/get-absolute-path-of-files-using-find-command - tilde-plus gives full path`,
                        [
                            `find ~+ -type f -name 'cdk.json' -a -not -path '*/node_modules/*' -print0 | while read -d '' -r CDK_JSON_FILE; do`,
                            `    dirname "$CDK_JSON_FILE" >> $CDK_PROJECT_NAMES_FILE`,
                            `done`
                        ].join('\n'),
                        `NAG_REPORTS_FILE=$CWD/nag_reports_list.txt`,
                        `# Install the CDK-NAG-IFY CDK Project`,
                        `curl -s https://proservetools.s3.us-west-2.amazonaws.com/res/cdk-nag-ify.zip -o $CWD/cdk-nag-ify.zip`,
                        `unzip -n $CWD/cdk-nag-ify.zip`,
                        [
                            `for CDK_PROJECT in $(cat $CDK_PROJECT_NAMES_FILE); do`,
                            `    BASE_NAME=$(basename \${CDK_PROJECT})`,
                            `    if [[ "$BASE_NAME" == "cdk-nag-ify" ]]; then`,
                            `        continue`,
                            `    fi`,
                            `    cd $CDK_PROJECT`,
                            `    # Remove any existing CDK outputs`,
                            `    rm -rf cdk.out`,
                            `    # If a requirements.txt file is present, install its contents`,
                            `    if [[ -f "requirements.txt" ]]`,
                            `    then`,
                            `        pip install -r requirements.txt`,
                            `    fi`,
                            `    echo "Starting synth of CDK Project $BASE_NAME"`,
                            `    cdk synth --quiet # Only supports argumentless synth for now, context can be provided as default arguments`,
                            `    if [[ $? -ne 0 ]]; then`,
                            `       echo "Error when CDK synthesizing project $BASE_NAME" | tee -a $CWD/${id}.tmp`,
                            `       ((EXITCODE |= 1))`,
                            `       cd $CWD`,
                            `       continue`,
                            `    fi`,
                            `    # If there is a Nag report CSV, add its location to the list of Nag Reports`,
                            `    if compgen -G "\${CDK_PROJECT}/cdk.out/AwsSolutions-*NagReport.csv" >> $NAG_REPORTS_FILE; then`,
                            `        echo "Found a CDK nag report, project $BASE_NAME has CDK Nag Aspects in place" | tee -a $CWD/${id}.tmp`,
                            `    else`,
                            `        # Since no Nag report was found, run this through cdk-nag-ify`,
                            `        for CDK_GENERATED_CFT in \${CDK_PROJECT}/cdk.out/*.template.json; do`,
                            `            cd $CWD/cdk-nag-ify`,
                            `            echo "No Nag report was found for CDK Project $BASE_NAME. Assuming CDK Nag is not present and attempting to add it."`,
                            `            echo "Starting CDK synth of CDK-Nag-Ify stack using synthesized CFTs from Project $BASE_NAME as input"`,
                            `            cat $CDK_GENERATED_CFT | jq 'del(.Rules.CheckBootstrapVersion) | del(.Conditions.CDKMetadataAvailable) | del(.Resources.CDKMetadata) | del(.Parameters.BootstrapVersion)' > $CDK_GENERATED_CFT.temp # Remove CDK specific resources so this can be re-synthed`,
                            `            cdk synth --context cdkNagScanning=on --context cfnTemplateFilename=$CDK_GENERATED_CFT.temp --quiet`,
                            `            if [[ $? -ne 0 ]]; then`,
                            `                echo "Error when synthesizing $BASE_NAME with CDK Nag checks added on" | tee -a $CWD/${id}.tmp`,
                            `                ((EXITCODE |= 1))`,
                            `                # Errors can be caused by either problems in the code identified by CDK Nag or by gremlins -- handle each case`,
                            `                if [[ -f "cdk.out/AwsSolutions-cdkNag-ified-Stack-NagReport.csv" ]]; then`,
                            `                    echo "$BASE_NAME failed CDK Nag checks and requires review." | tee -a $CWD/${id}.tmp`,
                            `                else`,
                            `                    echo "Unable to generate CDK Nag report of $BASE_NAME, skipping it and failing this action." | tee -a $CWD/${id}.tmp`,
                            `                    continue`,
                            `                fi`,
                            `            fi`,
                            `            # Copy the Nag report and save its location into $NAG_REPORTS_FILE`,
                            `            CDK_NAG_OUTPUT=$(find ~+/cdk.out/AwsSolutions-*NagReport.csv)`,
                            `            if [[ $CDK_NAG_OUTPUT == "" ]]; then`,
                            `                echo "Unable to find Nag report for $BASE_NAME; skipping." | tee -a $CWD/${id}.tmp`,
                            `                continue`,
                            `            fi`,
                            `            RENAMED_OUTPUT=$(echo $CDK_NAG_OUTPUT | sed "s/.csv/_$BASE_NAME.csv/")`,
                            `            # Move the CDK Nag report into a unique location and index it`,
                            `            mv $CDK_NAG_OUTPUT $CDK_PROJECT/$(basename \${RENAMED_OUTPUT})`,
                            `            echo $CDK_PROJECT/$(basename \${RENAMED_OUTPUT}) >> $NAG_REPORTS_FILE`,
                            `            ((EXITCODE |= $?))`,
                            `        done`,
                            `    fi`,
                            `    cd $CWD`,
                            `done`
                        ].join('\n'),
                        `echo $'\\n' >> ${id}.tmp`, // Newline for readability
                        `# Review the CDK Nag reports and see if there are any Non-Compliant items`,
                        [
                            `if [[ -f $NAG_REPORTS_FILE ]]; then`,
                            `    for NAG_REPORT in $(cat $NAG_REPORTS_FILE); do`,
                            `        echo ""`,
                            `        echo $NAG_REPORT | tee -a ${id}.tmp`,
                            `        cat $NAG_REPORT | tee -a ${id}.tmp`,
                            `        tail -n +2 $NAG_REPORT | gawk -F, '{ if ($3 ~ /Non-Compliant/) print "ERROR: Found Non-Compliant resource " $2 " violating rule " $1 " with rule info " $6; }' >> violations.tmp`,
                            `        if [[ -s violations.tmp ]]; then`,
                            `            cat violations.tmp >> ${id}.tmp`,
                            `            ((EXITCODE |= 1))`,
                            `        else`,
                            `            echo "No non-compliant findings detected in $NAG_REPORT." | tee -a ${id}.tmp`,
                            `            echo $'\\n' >> ${id}.tmp`, // Newline for readability`
                            `         fi`,
                            `        rm violations.tmp`,
                            `    done`,
                            `else`,
                            `    echo "No CDK Nag reports found." | tee -a ${id}.tmp`,
                            `fi`
                        ].join('\n'),
                        `mv ${id}.tmp ${id}.log`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
