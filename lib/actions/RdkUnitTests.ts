import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { RdkProps } from '../StandardizedCodeBuildProjectProps';

export class RdkAction extends CodeBuildAction {
    constructor(scope: Construct, id: string, props: RdkProps) {
        const action_details: ActionDetails = {
            actionName: id,
            project: new StandardizedCodeBuildProject(
                scope,
                id,
                Object.assign({}, props, {
                    projectName: id,
                    description:
                        'Runs unit tests for the Config rules within the Config Rules folder',
                    installCommands: ['pip install rdk', 'pip install rdklib'],
                    buildCommands: [
                        `cwd=$(pwd)`,
                        [
                            `ALL_PATHS=${props.configRulesPath}`,
                            `IFS=',' read -ra RDKPATH <<< "$ALL_PATHS"`, // This will split the input using the separator (IFS) of comma so each path can be scanned
                            `for i in "\${RDKPATH[@]}"; do`,
                            // The commands below will run unit tests for all config rules in the Config rules folder(s)
                            // The unit tests need to be defined in a <RULENAME>_test.py file, per standard RDK output
                            `    cd $i`,
                            // Run unit tests for all subdirectories in the config_rules folder
                            `    if [ $(find -L . -mindepth 1 -maxdepth 1 -type d | wc -l) -gt 0 ]; then`,
                            `        echo Unit testing RDK rules in directory $i | tee -a ${id}.tmp`,
                            `        OUTPUT=$(rdk test-local --all)`,
                            `        ((EXITCODE |= $?))`,
                            `        echo "$OUTPUT" | tee -a ${id}.tmp`,
                            '    else',
                            `        echo "No rule directories found" | tee -a ${id}.tmp`,
                            '    fi',
                            '    cd $cwd', // Back to the original directory so we can cd to the next path without issue
                            `done`
                        ].join('\n'),
                        `echo End of RDK unit testing | tee -a ${id}.tmp`,
                        `mv ${id}.tmp ${id}.log`
                    ]
                })
            )
        };
        super(Object.assign({}, props, ActionDefaultSettings, action_details));
    }
}
