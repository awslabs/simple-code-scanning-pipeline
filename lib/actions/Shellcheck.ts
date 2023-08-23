import { CodeBuildAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { StandardizedCodeBuildProject } from '../StandardizedCodeBuildProject';
import { ActionDefaultSettings, ActionDetails } from './ActionDefaultSettings';
import { Construct } from 'constructs';
import { StandardizedCodeBuildProjectProps } from '../StandardizedCodeBuildProjectProps';

// NOTE - SHELLCHECK DOES NOT MEET THE AWS LICENSE CRITERIA FOR INCLUSION HERE AND SHOULD NOT BE USED
// THIS ACTION IS PROVIDED ONLY AS REFERENCE, THE CONSTRUCT IS NOT USED IN THE PIPELINE
export class ShellCheckAction extends CodeBuildAction {
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
                        'Runs the Shellcheck scanner on all files in the repository',
                    installCommands: [
                        'pip install identify',
                        'pip install shellcheck-py'
                    ],
                    buildCommands: [
                        // The commands below find all files in the repo,
                        // determine, using the identify-cli command, whether the file
                        // is a shell program, and then run the shellcheck
                        // command (with severity level "warning") against all
                        // shell programs found in the repository.
                        //
                        // Any non-zero return-code will cause the result of the build
                        // to end with a non-zero return-code.  As implemented, the last
                        // observed non-zero return-code will be returned if any
                        // non-zero return code is observed.  Otherwise, 0 is returned.
                        [
                            `for file in $(find . -type f); do`,
                            `    chmod u+x $file # required for identify-cli to see shell scripts as executable`,
                            `    identify-cli $file | grep shell >/dev/null;`,
                            `    if [[ $? -eq 0 ]]; then`,
                            `        echo "Checking $file..." | tee -a ${id}.tmp;`,
                            `        OUTPUT=$(shellcheck --severity=warning $file)`,
                            `        ((EXITCODE |= $?))`,
                            `        echo "$OUTPUT" | tee -a ${id}.tmp;`,
                            `    else`,
                            `        echo "Skipping $file" | tee -a ${id}.tmp;`,
                            `    fi;`,
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
